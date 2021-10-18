import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { LoadingController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { AddPolygon, JointAction, RemovePolygon } from 'src/app/models/action';
import { Drawer, Pencil, Tool, UIInteraction } from 'src/app/models/drawing';
import { Point, Polygon } from 'src/app/models/geometry';
import { GlobalSegmentationModel, LocalSegmentationModel, SegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { UIUtils, Utils } from 'src/app/models/utils';
import { Detection, SegmentationService } from 'src/app/services/segmentation.service';
import { threadId } from 'worker_threads';

@Component({
  selector: 'app-segmentation',
  templateUrl: './segmentation.component.html',
  styleUrls: ['./segmentation.component.scss'],
})
export class SegmentationComponent extends Tool implements Drawer {

  // input the current segmentation model and ui
  _localSegModel: LocalSegmentationModel;
  _globalSegModel: GlobalSegmentationModel;
  _segUI: SegmentationUI;


  updateInputs() {
    this.temporarySegModel = new SegmentationModel();
    this.data = []
  }

  @Input() set localSegModel(lsg: LocalSegmentationModel) {
    this._localSegModel = lsg;
    this.createLocalSegModel();
  }

  @Input() set globalSegModel(gsm: GlobalSegmentationModel) {
    this._globalSegModel = gsm;
    this.createLocalSegModel();
  }

  @Input() set segUI(sUI: SegmentationUI) {
    this._segUI = this.segUI;
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

  data: Detection[] = [];
  polyMeta: {} = {};

  // dialog properties
  showOverlay = true;
  showNewOverlay = true;
  scoreThreshold = 0.4;
  simplifyError = 0.1;
  filterOverlaps = true;

  // cache for filtering detections
  _cachedFilterDets: Array<[string, Polygon]> = null;

  constructor(private loadingCtrl: LoadingController,
              private httpClient: HttpClient,
              private segmentationService: SegmentationService,
              private toastController: ToastController) {
    super();
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

    // display the new overlay
    if (this.showNewOverlay && this.temporarySegModel) {
      this.filteredDets.map(([uuid, poly]) => {
        poly.draw(pencil.canvasCtx, false);
      })
    }

    // display the old overlay
    if (this.showOverlay) {
      this.segUI.drawPolygons(pencil.canvasCtx, false);
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
    const thresholdFiltered = Array.from(this.temporarySegModel.segmentationData.getPolygonEntries()).filter(([uuid, poly]) => uuid in this.polyMeta && this.polyMeta[uuid]['score'] >= this.scoreThreshold);

    // filter by overlaps (if bbox center is in other bbox only keep max-scored)
    if (this.filterOverlaps) {
      // check whether polygon center is within other polygon
      const overlapFiltered = thresholdFiltered.filter(([rootUuid, rootPoly]) => {
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

  /*ngOnChanges(changes) {
    console.log(changes);
  }*/

  update(e) {
    console.log(this.showOverlay)
    if (this.oldPencil) {
      // if we have a cached pencil, we can redraw
      this.draw(this.oldPencil);
    }
  }

  ngOnInit() {}

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
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Please wait while AI is doing the job...',
      backdropDismiss: true,
    });

    console.log('show loading');
    loading.then(l => l.present());

    const segUI = this.segUI;
    const segModel = this.localSegModel;

    // start http request --> get image urls
    const sub = of(segUI.imageUrl).pipe(
      tap(() => {
      }),
      // read the image in binary format
      switchMap((url: string) => {console.log(url); return this.httpClient.get<Blob>(url, {responseType: 'blob' as 'json'}); }),
      switchMap(data => {
        console.log('have the binary data!');
        console.log(data);

        return this.segmentationService.requestJSSegmentationProposal(data, 0.05);
      }),
      tap(
        (data) => {
          console.log(`Number of proposal detections ${data.length}`);
  
          // drop all segmentations with score lower 0.5
          //const threshold = 0.4;
          //data = data.filter(det => det.score >= threshold);
          //console.log(`Number of filtered detections ${data.length}`);
          console.log(data);
          this.data = data;

          this.createLocalSegModel();       
        }
      ),
      finalize(() => loading.then(l => l.dismiss()))
    ).subscribe(
      () => {
        // segmentation proposals have been applied successfully
        this.toastController.create({
          message: 'Successfully requested segmentation proposals',
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
      },
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
      const bbox = det.bbox;
      const contours = det.contours;

      // loop over all contours
      for (const cont of contours) {
        const points: Point[] = [];

        // merge x and y point lists into [x, y] list
        cont.x.map((xItem, i) => {
          const yItem = cont.y[i];
          points.push([xItem, yItem]);
        });

        const simplifiedPoints = Utils.simplifyPointList(points, this.simplifyError);

        // create a polygon from points and set random color
        const poly = new Polygon(...simplifiedPoints);
        poly.setColor(UIUtils.randomColor());

        // collection new polygon actions
        const addAction = new AddPolygon(poly, 0);
        actions.push(addAction);

        // save the detection score
        this.polyMeta[addAction.uuid] = {score: det.score};
      }
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
    console.log('simplify');
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

    if (!this.showOverlay) {
      // we need to delete all existing polyongs
      for (const [uuid, poly] of this.localSegModel.segmentationData.getPolygonEntries()) {
        deleteActions.push(new RemovePolygon(uuid));
      }
    }

    if (this.showNewOverlay) {
      // add all the polygons here
      for (const [uuid, poly] of this.filteredDets) {
        // TODO: automated prediction labels?
        addActions.push(new AddPolygon(poly, 0));
      }
    }

    // join actions
    const jointAction = new JointAction(...deleteActions, ...addActions);
    this.localSegModel.addAction(jointAction);

    // close the window
    this.close();
  }
}
