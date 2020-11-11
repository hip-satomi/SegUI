import { OmeroAPIService } from './../services/omero-api.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './../services/auth.service';
import { BrushTool } from './../toolboxes/brush-toolbox';
import { UIUtils, Utils } from './../models/utils';
import { Polygon, Point } from './../models/geometry';
import { AddPolygon, JointAction } from './../models/action';
import { SegmentationService } from './../services/segmentation.service';
import { ModelChanged, ChangeType } from './../models/change';
import { StateService } from './../services/state.service';
import { SegmentationRESTStorageConnector, TrackingRESTStorageConnector, DerivedSegmentationRESTStorageConnector, SegmentationOMEROStorageConnector, DerivedSegmentationOMEROStorageConnector, TrackingOMEROStorageConnector } from './../models/storage-connectors';
import { GUISegmentation, GUITracking } from './../services/seg-rest.service';
import { map, concatAll, take, concatMap, combineAll, flatMap, zipAll, mergeAll, mergeMap, switchMap, tap, finalize } from 'rxjs/operators';
import { forkJoin, Observable, of } from 'rxjs';
import { TrackingUI } from './../models/tracking-ui';
import { TrackingModel } from './../models/tracking';
import { UIInteraction } from './../models/drawing';
import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { Drawer } from 'src/app/models/drawing';
import { SegmentationUI } from './../models/segmentation-ui';
import { SegmentationModel,  SegmentationHolder, DerivedSegmentationHolder } from './../models/segmentation-model';
import { ActionSheetController, LoadingController, ToastController } from '@ionic/angular';
import { Component, ViewChild, OnInit, AfterViewInit, HostListener } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SegRestService } from '../services/seg-rest.service';
import * as dayjs from 'dayjs';
import { RectangleTool } from '../toolboxes/rectangle-tool';

const { Storage } = Plugins;

enum EditMode {
  Segmentation = '0',
  Tracking = '1'
}

enum BackendMode {
  SegTrack,
  OMERO
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit, Drawer, UIInteraction{

  @ViewChild(ImageDisplayComponent) imageDisplay: ImageDisplayComponent;

  segmentationUIs: SegmentationUI[] = [];

  trackingUI: TrackingUI;

  /** Key where the segmentation data is stored */
  segKey = 'segmentations';
  /** Key where the tracking data is stored */
  trackingKey = 'tracking';

  justTapped = false;

  backendMode = BackendMode.OMERO;

  _activeView = 0;

  urls = ['../assets/sequence/image0.png',
          '../assets/sequence/image1.png',
          '../assets/sequence/image2.png',
          '../assets/sequence/image3.png',
          '../assets/sequence/image4.png',
          '../assets/sequence/image5.png',
          '../assets/sequence/image6.png'];

  _editMode: EditMode = EditMode.Segmentation;

  tool = null;

  get editMode(): EditMode {
    return this._editMode;
  }

  set editMode(value: EditMode) {
    this._editMode = value;

    this.draw(this.ctx);
  }

  id = new Observable<number>();


  constructor(private toastController: ToastController,
              private actionSheetController: ActionSheetController,
              private route: ActivatedRoute,
              private router: Router,
              private segService: SegRestService,
              private stateService: StateService,
              private segmentationService: SegmentationService,
              private omeroAPI: OmeroAPIService,
              private loadingCtrl: LoadingController,
              private authService: AuthService,
              private httpClient: HttpClient) {
  }

  onPointerDown(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPointerDown(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI.onPointerDown(event);
    } else {
      return this.trackingUI.onPointerDown(event);
    }
  }

  onPointerMove(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPointerMove(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPointerMove(event);
    } else {
      return this.trackingUI?.onPointerMove(event);
    }
  }

  onPointerUp(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPointerUp(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPointerUp(event);
    } else {
      return this.trackingUI?.onPointerUp(event);
    }
  }

  onTap(event: any): boolean {
    this.justTapped = true;

    if (this.tool) {
      if (this.tool.onTap(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onTap(event);
    } else {
      return this.trackingUI?.onTap(event);
    }
  }

  onPress(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPress(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPress(event);
    }
  }
  onPanStart(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPanStart(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPanStart(event);
    }
  }
  onPan(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPan(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPan(event);
    }
  }
  onPanEnd(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPanEnd(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPanEnd(event);
    }
  }

  onMove(event: any): boolean {
    if (this.tool) {
      if (this.tool.onMove(event)) {
        return true;
      }
    }
    if (this.justTapped) {
      this.justTapped = false;
    } else {
      // redirect move action to child handlers if they are created w.r.t. mode
      if (this.isSegmentation && this.curSegUI) {
        return this.curSegUI.onMove(event);
      } else if (this.trackingUI && this.trackingUI) {
        return this.trackingUI.onMove(event);
      }
    }

    return true;
  }

  @HostListener('document:keydown.enter', ['$event'])
  async saveKey(event) {
    this.done();
  }

  @HostListener('document:keydown.arrowleft')
  moveLeft(event) {
    if (this.canPrevImage) {
      this.prevImage();
    }
  }

  @HostListener('document:keydown.arrowright')
  moveRight() {
    if (this.canNextImage) {
      this.nextImage();
    }
  }

  @HostListener('document:keydown.delete')
  delete() {
    if (this.tool && 'delete' in this.tool) {
      if (this.tool.delete()) {
        return;
      }
    }
    if (this.isSegmentation) {
      this.segmentationUIs[this.activeView].delete();
    }
  }

  ngOnInit() {
    // if there is no resource defined --> go back to list view
    /*if (!this.stateService.navImageSetId && ! this.stateService.imageSetId) {
      this.router.navigateByUrl('/list');
    }*/
  }

  async ngAfterViewInit() {
  }

  async ionViewWillEnter() {
    console.log('Init test');
    console.log(this.stateService.navImageSetId);
    console.log(this.stateService.imageSetId);
    /*if (!this.stateService.navImageSetId && ! this.stateService.imageSetId) {
      return false;
    }*/

    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Loading data...',
      backdropDismiss: true
    });

    // get the query param and fire the id
    this.route.paramMap.pipe(
      map(params => {
        /*if (!this.router.getCurrentNavigation().extras.state) {
          throw new Error('No state information available');
        } else {
          return this.router.getCurrentNavigation().extras.state?.imageSetId;
        }*/
        return Number(params.get('imageSetId'));
      }),
      tap(() => {
        loading.then(l => l.present());
      }),
      switchMap(imageSetId => this.loadImageSetById(imageSetId)),
      // take only once --> pipe is closed immediately and finalize stuff is called
      take(1),
      finalize(() => {
        console.log('done loading');
        loading.then(l => l.dismiss());
      })
    ).subscribe(
      () => console.log('Successfully loaded!')
    );


    if (this.backendMode === BackendMode.SegTrack) {
      const id = this.stateService.navImageSetId;

      // now we have the id of the image set
      const toast = await this.toastController.create({
        message: `The loaded imageSet id is ${id}`,
        duration: 2000,
      });
      toast.present();

      loading.then(l => l.present());
      // get image urls
      this.segService.getImageUrls(id).pipe(
        // get the latest tracking
        mergeMap((urls: string[]) => {
          return this.segService.getLatestTracking(id).pipe(
            map(tr => ({urls, tracking: tr}))
          );
        }),
        // depending on the tracking load the segmentation
        mergeMap((joint) => {
          let seg: Observable<GUISegmentation>;
          if (joint.tracking) {
            // we have a tracking --> load segmentation
            seg = this.segService.getSegmentationByUrl(joint.tracking.segmentation);
          } else {
            // we have no tracking --> load segmentation
            seg = this.segService.getLatestSegmentation(id);
          }

          return seg.pipe(
            map(segm => ({urls: joint.urls, tracking: joint.tracking, segm}))
          );
        }),
        // create the segmentation connector
        map((content) => {
          let srsc: SegmentationRESTStorageConnector;
          if (content.segm === null) {
            srsc = SegmentationRESTStorageConnector.createNew(this.segService, id, content.urls);
          } else {
            srsc = SegmentationRESTStorageConnector.createFromExisting(this.segService, content.segm);
          }

          // add the simple model
          // TODO the construction here is a little bit weird
          const derived = new DerivedSegmentationHolder(srsc.getModel());
          const derivedConnector = new DerivedSegmentationRESTStorageConnector(this.segService, derived, srsc);

          return {srsc, tracking: content.tracking, urls: content.urls};
        }),
        // create the tracking connector
        map((content) => {
          let trsc: TrackingRESTStorageConnector;
          if (content.tracking === null) {
            // create a tracking
            trsc = TrackingRESTStorageConnector.createNew(this.segService, content.srsc);
          } else {
            trsc = TrackingRESTStorageConnector.createFromExisting(this.segService, content.srsc, content.tracking);
          }

          return {srsc: content.srsc, trsc, urls: content.urls};
        }),
        tap(async (content) => {
          this.stateService.imageSetId = id;
          await this.loadSegmentation(content.srsc.getModel(), content.urls);
          await this.loadTracking(content.trsc.getModel());
        }),
        finalize(() => loading.then(l => l.dismiss()))
      ).subscribe((content) => {
        // refresh the canvas
        this.draw();
        },
        (err) => console.error(err)
      );
    }
  }

  /**
   * Load imageset from OMERO
   * @param imageSetId image set id
   */
  loadImageSetById(imageSetId: number) {
    // get image urls
    return this.omeroAPI.getImageUrls(imageSetId).pipe(
      // get the latest tracking
      mergeMap((urls: string[]) => {
        return this.omeroAPI.getLatestFileJSON(imageSetId, 'GUITracking.json').pipe(
          map(tr => ({urls, tracking: tr}))
        );
      }),
      // depending on the tracking load the segmentation
      mergeMap((joint) => {
        return this.omeroAPI.getLatestFileJSON(imageSetId, 'GUISegmentation.json').pipe(
          map(segm => ({urls: joint.urls, tracking: joint.tracking, segm}))
        );
      }),
      //map((imageUrls: string[]) => ({urls: imageUrls, tracking: null, segm: null})),
      // create the segmentation connector
      map((content) => {
        let srsc: SegmentationOMEROStorageConnector;
        if (content.segm === null) {
          srsc = SegmentationOMEROStorageConnector.createNew(this.omeroAPI, imageSetId, content.urls);
        } else {
          srsc = SegmentationOMEROStorageConnector.createFromExisting(this.omeroAPI, content.segm, imageSetId);
        }

        // add the simple model
        // TODO the construction here is a little bit weird
        const derived = new DerivedSegmentationHolder(srsc.getModel());
        const derivedConnector = new DerivedSegmentationOMEROStorageConnector(this.omeroAPI, derived, srsc);

        return {srsc, tracking: content.tracking, urls: content.urls};
      }),
      // create the tracking connector
      map((content) => {
        let trsc: TrackingOMEROStorageConnector;
        if (content.tracking === null) {
          // create a tracking
          trsc = TrackingOMEROStorageConnector.createNew(this.omeroAPI, content.srsc);
        } else {
          trsc = TrackingOMEROStorageConnector.createFromExisting(this.omeroAPI, content.srsc, content.tracking);
        }

        return {srsc: content.srsc, trsc, urls: content.urls};
      }),
      tap(async (content) => {
        this.stateService.imageSetId = imageSetId;
        await this.loadSegmentation(content.srsc.getModel(), content.urls);
        await this.loadTracking(content.trsc.getModel());
      }),
      tap(() => {
        console.log('Draw');
        this.draw();
      })
    );

  }

  async loadSegmentation(segHolder: SegmentationHolder, imageUrls: string[]) {
    // now that we have a holder we can start using it
    this.segHolder = segHolder;
    this.segHolder.modelChanged.subscribe((event: ModelChanged<SegmentationModel>) => {
      this.segModelChanged(event);
    });

    this.segmentationUIs = [];

    for (const [index, model] of this.segHolder.segmentations.entries()) {
      this.segmentationUIs.push(new SegmentationUI(model, imageUrls[index], this.imageDisplay.canvasElement, this.actionSheetController));
    }
  }

  async loadTracking(trackingModel: TrackingModel) {
    if (trackingModel === null) {
      // There was an error while loading the tracking
      const toast = await this.toastController.create({
        message: `Error while loading tracking data`,
        duration: 2000
      });
      toast.present();
    } else {
      // loading the tracking
      this.stateService.tracking = trackingModel;
      this.trackingUI = new TrackingUI(this.segmentationModels,
        this.segmentationUIs,
        this.trackingModel,
        this.imageDisplay.canvasElement,
        this.toastController,
        this.activeView);
      this.trackingModel.onModelChanged.subscribe((trackingChangedEvent: ModelChanged<TrackingModel>) => {
        if (trackingChangedEvent.changeType === ChangeType.SOFT) {
          // if there are only soft changes we will just redraw
          this.draw(this.ctx);
        }
      });
    }
  }

  get segHolder() {
    return this.stateService.holder;
  }

  set segHolder(segHolder: SegmentationHolder) {
    this.stateService.holder = segHolder;
  }

  get segmentationModels() {
    if (this.segHolder) {
      return this.segHolder.segmentations;
    } else {
      return [];
    }
  }

  get trackingModel() {
    return this.stateService.tracking;
  }

  get isSegmentation() {
    return this.editMode === EditMode.Segmentation;
  }

  get curSegUI(): SegmentationUI {
    return this.segmentationUIs[this.activeView];
  }

  get curSegModel(): SegmentationModel {
    return this.segmentationModels[this.activeView];
  }

  segModelChanged(segModelChangedEvent: ModelChanged<SegmentationModel>) {
    if (this.curSegModel === segModelChangedEvent.model) {
      this.draw(this.ctx);
    }
  }

  @HostListener('document:keydown.control.z')
  async undo() {
    if (this.canUndo) {
      if (this.editMode === EditMode.Segmentation && this.curSegModel) {
        this.curSegModel.undo();
      } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
        this.trackingUI.undo();
      }
    }
  }

  @HostListener('document:keydown.control.y')
  async redo() {
    if (this.canRedo) {
      if (this.editMode === EditMode.Segmentation && this.curSegModel) {
        this.curSegModel.redo();
      } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
        this.trackingUI.redo();
      }
    }
  }

  get canSave() {
    if (this.tool) {
      return this.tool.canSave;
    }
    if (this.editMode === EditMode.Segmentation && this.curSegUI) {
      return this.curSegUI.canSave;
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      return this.trackingUI.canSave;
    }

    return false;
  }

  async done() {
    if (this.canSave) {
      if (this.tool) {
        this.tool.save();
      }
      if (this.editMode === EditMode.Segmentation && this.curSegUI) {
        this.curSegUI.save();
        return;
      } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
        this.trackingUI.save();
        return;
      }
    }
    const toast = await this.toastController.create({
      message: 'Sorry but I cannot save the current state!',
      duration: 2000
    });
    toast.present();
  }

  get canRedo() {
    if (this.editMode === EditMode.Segmentation && this.curSegModel) {
      return this.curSegModel.actionManager.canRedo;
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      return this.trackingUI.canRedo;
    }

    return false;
  }

  get canUndo() {
    if (this.editMode === EditMode.Segmentation && this.curSegModel) {
      return this.curSegModel.actionManager.canUndo;
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      return this.trackingUI.canUndo;
    }

    return false;
  }

  get canNextImage() {
    if (this.segmentationModels) {
      return this.activeView < this.segmentationUIs.length - 1;
    }

    return false;
  }

  get canPrevImage() {
    return this.activeView > 0;
  }

  nextImage() {
    if (this.canNextImage) {
      this.setImageIndex(this.activeView + 1);
    }
  }

  prevImage() {
    if (this.canPrevImage) {
      this.setImageIndex(this.activeView - 1);
    }
  }

  setImageIndex(index: number) {
    this.activeView = index;
  }

  set activeView(viewIndex: number) {
    this._activeView = viewIndex;

    if (this.trackingUI) {
      this.trackingUI.currentFrame = this.activeView;
    }

    if (this.isSegmentation && this.tool) {
      this.tool.setModel(this.curSegModel, this.curSegUI);
    }

    this.draw(this.ctx);
  }

  get activeView() {
    return this._activeView;
  }

  onSliderChanged(event) {
    console.log('slider changed');
    console.log(event);
    this.setImageIndex(event.detail.value);
  }

  draw(ctx = null) {

    if (ctx === null) {
      ctx = this.ctx;
    }

    this.imageDisplay.clear();

    if (this.tool) {
      this.tool.draw(ctx);
    }
    else if (this.editMode === EditMode.Segmentation) {
      // draw the segmentation stuff
      this.segmentationUIs[this.activeView]?.draw(ctx);
    } else {
      this.trackingUI?.draw(ctx);
    }
  }

  get ctx() {
    return this.imageDisplay.ctx;
  }

  /**
   * Get and apply proposal segmentations
   */
  async doSegment(type: string, imageIndices = null) {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Please wait while AI is doing the job...',
      backdropDismiss: true,
    });

    if (imageIndices === null) {
      imageIndices = [this.activeView];
    }

    console.log('show loading');
    loading.then(l => l.present());

    for (const imageIdx of imageIndices) {

      const segUI = this.segmentationUIs[imageIdx];
      const segModel = this.segmentationModels[imageIdx];

      // start http request --> get image urls
      const sub = of(segUI.imageUrl).pipe(
        tap(() => {
        }),
        // read the image in binary format
        switchMap((url: string) => {console.log(url); return this.httpClient.get<Blob>(url, {responseType: 'blob' as 'json'}); }),
        switchMap(data => {
          console.log('have the binary data!');
          console.log(data);

          // send the image to a segmentation REST backend
          if (type === 'cs') {
            return this.segmentationService.requestCSSegmentationProposal(data);
          } else {
            return this.segmentationService.requestJSSegmentationProposal(data);
          }
        }),
        tap(
          (data) => {
            console.log(`Number of proposal detections ${data.length}`);
    
            // drop all segmentations with score lower 0.5
            const threshold = 0.4;
            data = data.filter(det => det.score >= threshold);
            console.log(`Number of filtered detections ${data.length}`);
            console.log(data);
    
            const actions: AddPolygon[] = [];
    
            // loop over every detection
            for (const det of data) {
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
    
                const simplifiedPoints = Utils.simplifyPointList(points, 0.1);
    
                // create a polygon from points and set random color
                const poly = new Polygon(...simplifiedPoints);
                poly.setColor(UIUtils.randomColor());
    
                // collection new polygon actions
                actions.push(new AddPolygon(segModel.segmentationData, poly));
              }
            }
    
            // join all the new polygon actions
            const finalAction = new JointAction(...actions);
    
            // apply the actions to the current segmentation model
            segModel.addAction(finalAction);
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
        },
        (error) => console.error(error),
      );
    }
  }

  segmentAll() {
    const type = 'js';
    const indices = [];
    for (const [index, segUI] of this.segmentationUIs.entries()) {
      indices.push(index);
    }

    this.doSegment(type, indices);
  }

  brushTool() {
    if (this.tool) {
      this.tool.stop();
      this.tool = null;
    }
    else if (this.editMode === EditMode.Segmentation) {
      this.tool = new BrushTool(this.curSegModel, this.curSegUI, this.imageDisplay.canvasElement);
      this.tool.changedEvent.subscribe(() =>  {
        this.draw();
      });
    }

    this.draw();
  }

  rectTool() {
    if (this.tool) {
      this.tool.stop();
      this.tool = null;
    }
    else if (this.editMode === EditMode.Segmentation) {
      this.tool = new RectangleTool(this.curSegModel, this.curSegUI, this.imageDisplay.canvasElement);
      this.tool.changedEvent.subscribe(() =>  {
        this.draw();
      });
    }

    this.draw();
  }

  openToolkit() {
    //this.authService.logout();

    // segmentation proposals have been applied successfully
    this.toastController.create({
      message: 'Toolkit not yet implemented!',
      duration: 2000
    }).then(toast => toast.present());
  }

}
