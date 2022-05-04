import { HttpClient } from '@angular/common/http';
import { Component, Input } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { of, ReplaySubject } from 'rxjs';
import { finalize, map, switchMap, take, tap } from 'rxjs/operators';
import { AddLabelAction, AddPolygon, JointAction, RemovePolygon } from 'src/app/models/action';
import { Drawer, Pencil, Tool } from 'src/app/models/drawing';
import { Polygon } from 'src/app/models/geometry';
import { AnnotationLabel } from 'src/app/models/segmentation-data';
import { GlobalSegmentationModel, LocalSegmentationModel, SegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { UIUtils, Utils } from 'src/app/models/utils';
import { SegmentationData, SegmentationService, SegmentationServiceDef, ServiceResult } from 'src/app/services/segmentation.service';

@Component({
  selector: 'app-flexible-segmentation',
  templateUrl: './flexible-segmentation.component.html',
  styleUrls: ['./flexible-segmentation.component.scss'],
})
export class FlexibleSegmentationComponent extends Tool implements Drawer {

  // input the current segmentation model and ui
  _localSegModel: LocalSegmentationModel;
  _globalSegModel: GlobalSegmentationModel;
  _segUI: SegmentationUI;

  /** Name of the AI model */
  selectedModel: string;


  updateInputs() {
    this.temporarySegModel = new SegmentationModel();
    this.data = []
  }

  @Input() set localSegModel(lsg: LocalSegmentationModel) {
    this._localSegModel = lsg;
  }

  @Input() set globalSegModel(gsm: GlobalSegmentationModel) {
    this._globalSegModel = gsm;
  }

  @Input() set segUI(sUI: SegmentationUI) {
    this._segUI = sUI;
    // notify frame change
    this.createLocalSegModel();
  }

  get localSegModel() {
    return this._localSegModel;
  }

  get globalSegModel() {
    return this._globalSegModel;
  }

  get segUI() {
    return this._segUI;
  }

  // the local segmentation model that is temporal and independent of the real one
  temporarySegModel: SegmentationModel;

  // the pencil for drawing
  oldPencil: Pencil;

  data: Array<SegmentationData> = [];
  polyMeta: {} = {};

  // dialog properties
  showOverlay = true;
  showNewOverlay = true;
  scoreThreshold = 0.4;
  simplifyError = 0.1;
  filterOverlaps = true;
  useLabels = false;
  segmentationModels$ = new ReplaySubject<Array<SegmentationServiceDef>>();

  // cache for filtering detections
  _cachedFilterDets: Array<[string, Polygon]> = null;

  constructor(private loadingCtrl: LoadingController,
              private httpClient: HttpClient,
              private segmentationService: SegmentationService,
              private toastController: ToastController) {
    super("FlexSegmentationTool");
  }

  /**
   * Prepare for Drawing (Drawer)
   */
  prepareDraw() {
    return this.segUI.prepareDraw().pipe(
      switchMap(() => of(this))
    );
  }

  /**
   * Update the canvas
   * @param pencil the canvas pencil
   */
  draw(pencil: Pencil): void {
    // TODO: Why can the pencil be null?
    if(!pencil) {
      return;
    }

    // clear the canvas
    pencil.clear();

    this.oldPencil = pencil;

    // display the old overlay
    if (this.showOverlay) {
      this.segUI.draw(pencil, false);//drawPolygons(pencil.canvasCtx, false);
    }

    // display the new overlay
    if (this.showNewOverlay && this.temporarySegModel) {
      this.filteredDets.map(([uuid, poly]) => {
        poly.draw(pencil.canvasCtx, false);
      })
    }
    
    
    // draw the image in the background
    this.segUI.drawImage(pencil.canvasCtx);
  }

  /**
   * Filter new detections based on filter parameters
   */
  get filteredDets(): Array<[string, Polygon]> {
    if (this._cachedFilterDets) {
      return this._cachedFilterDets;
    }

    // filter by score threshold (there might also be empty items in the localSegModel)
    const thresholdFiltered = Array.from(this.temporarySegModel.segmentationData.getPolygonEntries()).filter(
      ([uuid, poly]) => {
        return uuid in this.polyMeta &&  (!this.polyMeta[uuid]['score'] || this.polyMeta[uuid]['score'] >= this.scoreThreshold);
      });

    // filter by overlaps (if bbox center is in other bbox only keep max-scored)
    if (this.filterOverlaps) {
      // check whether polygon center is within other polygon
      const overlapFiltered = thresholdFiltered.filter(([rootUuid, rootPoly]) => {
        if (!this.polyMeta[rootUuid]['score']) {
          return true;
        }
        // get candidates that have their center inside the polygon's bbox
        const bboxCandidates = thresholdFiltered.filter(([uuid, poly]) => uuid !== rootUuid && poly.boundingBox.isInside(rootPoly.center));
        // get candidates that have their center inside the polygon
        const candidates = bboxCandidates.filter(([uuid, poly]) => uuid !== rootUuid && poly.isInside(rootPoly.center));
        // compute the max score of candidates
        const maxScore = Math.max(...candidates.map(([uuid, poly]) => this.polyMeta[uuid]['score']))
        // compare poly score to max candidate score
        return this.polyMeta[rootUuid]['score'] > maxScore
      });
      this._cachedFilterDets = overlapFiltered;
    } else {
      this._cachedFilterDets = thresholdFiltered;
    }

    // return the filter cache
    return this._cachedFilterDets;
  }

  get numFilteredDets(): number {
    return this.filteredDets.length;
  }

  update(e) {
    //console.log(this.showOverlay)
    if (this.oldPencil) {
      // if we have a cached pencil, we can redraw
      this.draw(this.oldPencil);
    }
  }

  ngOnInit() {
    this.segmentationService.getSegmentationServices().pipe(
      tap(services => {
        this.segmentationModels$.next(services)
      })
    ).subscribe();
  }

  /**
   * set the segmentation model and UI (e.g. when slider changes the image timepoint)
   * @param curSegModel 
   * @param curSegUI 
   */
  setModel(curSegModel: LocalSegmentationModel, curSegUI: SegmentationUI) {
    this.localSegModel = curSegModel;
    this.segUI = curSegUI;

    this.temporarySegModel = new SegmentationModel();
    this.data = []
  }

  /**
   * Request segmentation proposals from backend
   */
  requestProposals() {
    if (!this.selectedModel) {
      //console.log('Select model first');
      return;
    }

    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Please wait while AI is doing the job...  <br /><br /><b>Hint:</b>The execution may take a while for the first time because the server needs to install the segmentation software!',
      backdropDismiss: true,
    });

    //console.log('show loading');
    loading.then(l => l.present());

    const segUI = this.segUI;
    const segModel = this.localSegModel;

    // start http request --> get image urls
    const sub = of(segUI.imageUrl).pipe(
      take(1),
      tap(() => {
      }),
      // read the image in binary format
      switchMap((url: string) => {
        // console.log(url);
        return this.httpClient.get<Blob>(url, {responseType: 'blob' as 'json'});
      }),
      switchMap(image_data => {
        // console.log('have the binary data!');
        // console.log(image_data);

        return this.segmentationModels$.pipe(
          take(1),
          switchMap(services => {
            return this.segmentationService.requestSegmentationProposal(image_data, services[Number(this.selectedModel)])
          })
        );
      }),
      map(
        (data: ServiceResult) => {
          if (data.format_version != "0.2") {
            console.warn(`Working with unsupported segmentation format: ${data.format_version}`)
          }

          // console.log(`Number of proposal detections ${data.segmentation_data[0].length}`);

          // set data and create new local segmetnation model
          this.data = data.segmentation_data[0];
          this.createLocalSegModel();
          
          return data.model;
        }
      ),
      finalize(() => {
        loading.then(l => l.dismiss());
      })
    ).subscribe(
      (model: string) => {
        // segmentation proposals have been applied successfully
        this.toastController.create({
          message: `Successfully requested segmentation proposals using ${model}`,
          duration: 2000
        }).then(toast => toast.present());

        this.draw(this.oldPencil);
      },
      (error) => {
        this.toastController.create({
          message: 'Requesting segmentation proposals failed!',
          duration: 2000,
          color: 'warning'
        }).then(toast => {toast.present();});
        console.error(error);
      }
    );
  }

  /**
   * create a local (temporal) segmentation model that contains the automated segmentations
   * @returns 
   */
  createLocalSegModel() {
    if (!this.data) {
      return;
    }

    this.temporarySegModel = new SegmentationModel();
    this.polyMeta = {};
    this._cachedFilterDets = null;

    const actions = [];

    // loop over every detection
    for (const det of this.data) {
      const label = det.label; // Should be cell
      //const bbox = det.bbox;
      // TODO: This should not be necessary
      const contour = det.contour_coordinates;

      if (contour.length < 3) {
        // check minimum requirement for contour
        continue;
      }


      const simplifiedPoints = Utils.simplifyPointList(contour, this.simplifyError);

      // create a polygon from points and set random color
      const poly = new Polygon(...simplifiedPoints);
      poly.setColor(UIUtils.randomBrightColor());

      // collection new polygon actions
      const addAction = new AddPolygon(poly, 0);
      actions.push(addAction);

      // save the detection score
      this.polyMeta[addAction.uuid] = {score: det.score, label: det.label};
    }

    // join all the new polygon actions
    const finalAction = new JointAction(...actions);

    // apply the actions to the current segmentation model
    this.temporarySegModel.addAction(finalAction);
  }

  /**
   * Called when the nms slider changed
   * 
   * --> Redraw the frame
   */
  nmsChange() {
    this._cachedFilterDets = null;

    this.draw(this.oldPencil);
  }

  simplifyErrorChanged() {
    // console.log('simplify');
    this.createLocalSegModel();
    this.draw(this.oldPencil);
  }


  /**
   * Commit detections to the main segmentation model
   */
  commit() {
    // collect actions
    const deleteActions = [];
    const addActions = [];
    const addLabelActions = [];

    if (!this.showOverlay) {
      // we need to delete all existing polyongs
      for (const [uuid, poly] of this.localSegModel.segmentationData.getPolygonEntries()) {
        deleteActions.push(new RemovePolygon(uuid));
      }
    }

    if (this.showNewOverlay) {
      const nextFreeLabelId = this.globalSegModel.nextLabelId();
      const labels: string[] = [];

      // loop over every detection
      for (const [uuid, poly] of this.filteredDets) {
        let labelId = 0;
        const label = this.polyMeta[uuid]['label'];

        // determine the label
        if (this.useLabels) {
          if (this.globalSegModel.labels.map(l => l.name).filter(name => name == label).length > 0) {
            // label is already present
            labelId = this.globalSegModel.labels.filter(l => l.name == label)[0].id
          } else {
            if (!labels.includes(label)) {
              // create new label
              labels.push(label);
            }
            // we have already created this label
            labelId = nextFreeLabelId + labels.indexOf(label);

          }
        }

        // collection new polygon actions
        const addAction = new AddPolygon(poly, labelId);

        addActions.push(addAction);
      }
    
      for (const [index, label] of labels.entries()) {
        addLabelActions.push(new AddLabelAction(new AnnotationLabel(nextFreeLabelId + index, label)))
      }
    }

    // join actions
    const jointAction = new JointAction(...deleteActions, ...addActions);
    const jointLocalActions = this.localSegModel.wrapAction(jointAction);
    this.globalSegModel.addAction(new JointAction(...addLabelActions, jointLocalActions));

    // clear segmentation model
    this.data = [];
    this.createLocalSegModel();

    // close the window
    this.close();
  }
}
