import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { LoadingController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { AddPolygon, JointAction, RemovePolygon } from 'src/app/models/action';
import { Drawer, Pencil, UIInteraction } from 'src/app/models/drawing';
import { Point, Polygon } from 'src/app/models/geometry';
import { SegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { UIUtils, Utils } from 'src/app/models/utils';
import { Detection, SegmentationService } from 'src/app/services/segmentation.service';
import { threadId } from 'worker_threads';

@Component({
  selector: 'app-segmentation',
  templateUrl: './segmentation.component.html',
  styleUrls: ['./segmentation.component.scss'],
})
export class SegmentationComponent extends UIInteraction implements Drawer {

  @Output() close = new EventEmitter<void>();
  @Input() segModel: SegmentationModel;
  @Input() segUI: SegmentationUI;

  localSegModel: SegmentationModel;

  oldPencil: Pencil;

  data: Detection[];
  polyMeta: {};

  showOverlay = true;
  showNewOverlay = true;
  threshold = 0.4;
  simplifyError = 0.1;
  filterOverlaps = true;

  _cachedFilterDets;

  constructor(private loadingCtrl: LoadingController,
              private httpClient: HttpClient,
              private segmentationService: SegmentationService,
              private toastController: ToastController) {
    super();
  }

  draw(pencil: Pencil): void {
    pencil.clear();

    this.oldPencil = pencil;
    if (this.showNewOverlay && this.localSegModel) {
      //this.localSegModel.drawPolygons(pencil.canvasCtx, false, ([uuid, poly]) => this.polyMeta[uuid]['score'] >= this.threshold);
      this.filteredDets.map(([uuid, poly]) => {
        poly.draw(pencil.canvasCtx, false);
      })
    }

    if (this.showOverlay) {
      this.segModel.draw(pencil.canvasCtx, false);
    }
    this.segUI.drawImage(pencil.canvasCtx);
  }

  get filteredDets(): Array<[string, Polygon]> {
    if (this._cachedFilterDets) {
      return this._cachedFilterDets;
    }

    const thresholdFiltered = Array.from(this.localSegModel.segmentationData.getPolygonEntries()).filter(([uuid, poly]) => this.polyMeta[uuid]['score'] >= this.threshold);

    if (this.filterOverlaps) {
      // check whether polygon center is within other polygon
      const overlapFiltered = thresholdFiltered.filter(([rootUuid, rootPoly]) => {
        // get candidates that have their center inside the polygon
        const candidates = thresholdFiltered.filter(([uuid, poly]) => uuid !== rootUuid && poly.isInside(rootPoly.center));
        // compute the max score of candidates
        const maxScore = Math.max(...candidates.map(([uuid, poly]) => this.polyMeta[uuid]['score']))
        // compare poly score to max candidate score
        return this.polyMeta[rootUuid]['score'] > maxScore
      });
      this._cachedFilterDets = overlapFiltered;
    } else {
      this._cachedFilterDets = thresholdFiltered;
    }


    return this._cachedFilterDets;
  }

  get numFilteredDets(): number {
    return this.filteredDets.length;
  }

  ngOnChanges(changes) {
    console.log(changes);
  }

  update(e) {
    console.log(this.showOverlay)
    this.draw(this.oldPencil);
  }

  ngOnInit() {}

  setModel(curSegModel: SegmentationModel, curSegUI: SegmentationUI) {
    this.segModel = curSegModel;
    this.segUI = curSegUI;

    this.localSegModel = new SegmentationModel();
    this.data = []
  }

  requestProposals() {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Please wait while AI is doing the job...',
      backdropDismiss: true,
    });

    console.log('show loading');
    loading.then(l => l.present());

    const segUI = this.segUI;
    const segModel = this.segModel;

    // start http request --> get image urls
    const sub = of(segUI.imageUrl).pipe(
      tap(() => {
      }),
      // read the image in binary format
      switchMap((url: string) => {console.log(url); return this.httpClient.get<Blob>(url, {responseType: 'blob' as 'json'}); }),
      switchMap(data => {
        console.log('have the binary data!');
        console.log(data);

        return this.segmentationService.requestJSSegmentationProposal(data);
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
      (error) => console.error(error),
    );
  }

  createLocalSegModel() {
    if (!this.data) {
      return;
    }

    this.localSegModel = new SegmentationModel();
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
        const addAction = new AddPolygon(this.localSegModel.segmentationData, poly);
        actions.push(addAction);

        // save the detection score
        this.polyMeta[addAction.uuid] = {score: det.score};
      }
    }

    // join all the new polygon actions
    const finalAction = new JointAction(...actions);

    // apply the actions to the current segmentation model
    this.localSegModel.addAction(finalAction);
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
   * Commit detections to the main model
   */
  commit() {
    // collect actions
    const deleteActions = [];
    const addActions = [];

    if (!this.showOverlay) {
      // we need to delete all existing polyongs
      for (const [uuid, poly] of this.filteredDets) {
        deleteActions.push(new RemovePolygon(this.segModel.segmentationData, uuid));
      }
    }

    if (this.showNewOverlay) {
      // add all the polygons here
      for (const [uuid, poly] of this.localSegModel.segmentationData.getPolygonEntries()) {
        addActions.push(new AddPolygon(this.segModel.segmentationData, poly));
      }
    }

    const jointAction = new JointAction(...deleteActions, ...addActions);
    this.segModel.addAction(jointAction);

    this.close.emit();
  }
}