import { SelectedSegment } from './../models/tracking-data';
import { TrackingService, Link } from './../services/tracking.service';
import { Dataset, OmeroAPIService, Project, RoIData, RoIModData } from './../services/omero-api.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './../services/auth.service';
import { OmeroUtils, UIUtils, Utils } from './../models/utils';
import { Polygon, Point, BoundingBox } from './../models/geometry';
import { AddPolygon, JointAction, AddLinkAction, LocalAction } from './../models/action';
import { SegmentationService } from './../services/segmentation.service';
import { ModelChanged, ChangeType } from './../models/change';
import { StateService } from './../services/state.service';
import { GlobalSegmentationOMEROStorageConnector, SimpleSegmentationOMEROStorageConnector, TrackingOMEROStorageConnector } from './../models/storage-connectors';
import { GUISegmentation } from './../services/seg-rest.service';
import { map, take, mergeMap, switchMap, tap, finalize, takeUntil, concatMap, concatAll, mergeAll, combineAll, switchMapTo, mapTo, throttle, throttleTime, catchError } from 'rxjs/operators';
import { BehaviorSubject, EMPTY, from, Observable, of, pipe, ReplaySubject, Subject, Subscription, throwError, zip } from 'rxjs';
import { TrackingUI } from './../models/tracking-ui';
import { TrackingModel } from './../models/tracking';
import { Pencil, UIInteraction } from './../models/drawing';
import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { Drawer } from 'src/app/models/drawing';
import { SegmentationUI } from './../models/segmentation-ui';
import { SegmentationModel, SegmentationHolder, SimpleSegmentationHolder as SimpleSegmentationHolder, SimpleSegmentation, GlobalSegmentationModel, LocalSegmentationModel } from './../models/segmentation-model';
import { ActionSheetController, AlertController, LoadingController, PopoverController, ToastController } from '@ionic/angular';
import { Component, ViewChild, OnInit, AfterViewInit, HostListener, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { LocalNotifications, Plugins } from '@capacitor/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SegRestService } from '../services/seg-rest.service';
import * as dayjs from 'dayjs';
import { SegmentationComponent } from '../components/segmentation/segmentation.component';
import { BrushComponent } from '../components/brush/brush.component';
import { MultiSelectToolComponent } from '../components/multi-select-tool/multi-select-tool.component';


const { Storage } = Plugins;

/**
 * Different edit modes
 */
export enum EditMode {
  Segmentation = '0',
  Tracking = '1'
}

/**
 * Different data backend modes
 */
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

  // the canvas to display the image
  @ViewChild(ImageDisplayComponent) imageDisplay: ImageDisplayComponent;

  @ViewChild('toolContainer', { read: ViewContainerRef }) container;
  @ViewChild('segTool') segTool: SegmentationComponent;
  @ViewChild('brushTool') brushToolComponent: BrushComponent;
  @ViewChild('multiSelectTool') multiSelectComponent: MultiSelectToolComponent;

  segmentationUIs: SegmentationUI[] = [];

  trackingUI: TrackingUI;

  simpleSegHolder: SimpleSegmentationHolder;
  globalSegModel: GlobalSegmentationModel;

  /** Key where the segmentation data is stored */
  segKey = 'segmentations';
  /** Key where the tracking data is stored */
  trackingKey = 'tracking';

  justTapped = false;

  backendMode = BackendMode.OMERO;

  _activeView = 0;

  rightKeyMove$ = new Subject<void>();
  leftKeyMove$ = new Subject<void>();

  // this can be used to end other pipelines using takeUntil(ngUnsubscribe)
  protected ngUnsubscribe: Subject<void> = new Subject<void>();

  urls = ['../assets/sequence/image0.png',
          '../assets/sequence/image1.png',
          '../assets/sequence/image2.png',
          '../assets/sequence/image3.png',
          '../assets/sequence/image4.png',
          '../assets/sequence/image5.png',
          '../assets/sequence/image6.png'];

  _editMode: EditMode = EditMode.Segmentation;

  tool = null;

  showErrorPipe = catchError(e => {this.showError(e); return throwError(e);});

  get editMode(): EditMode {
    return this._editMode;
  }

  set editMode(value: EditMode) {
    this._editMode = value;

    this.draw();
  }

  imageSetId = new ReplaySubject<number>(1);

  pencil: Pencil;
  drawingSubscription: Subscription;

  drawTimer = null;
  drawLoader = null;

  dataset$ = new ReplaySubject<Dataset>(1);
  project$ = new ReplaySubject<Project>(1);

  constructor(private toastController: ToastController,
              private actionSheetController: ActionSheetController,
              private route: ActivatedRoute,
              private router: Router,
              private segService: SegRestService,
              private segmentationService: SegmentationService,
              private omeroAPI: OmeroAPIService,
              private loadingCtrl: LoadingController,
              private authService: AuthService,
              private httpClient: HttpClient,
              private trackingService: TrackingService,
              private popoverController: PopoverController,
              private resolver: ComponentFactoryResolver,
              private alertController: AlertController) {
  }

  // Redirect Mouse & Touch interactions
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
    this.leftKeyMove$.next();
  }

  @HostListener('document:keydown.arrowright')
  moveRight() {
    this.rightKeyMove$.next();
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
  }

  async ngAfterViewInit() {
  }

  /**
   * Important functionality to load the dataset
   */
  async ionViewWillEnter() {
    console.log('Init test');
    //console.log(this.stateService.navImageSetId);
    //console.log(this.stateService.imageSetId);

    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Loading data...',
      backdropDismiss: true
    });

    // setup loading pipeline when we get a new imageId (also used for refreshing!)
    this.imageSetId.pipe(
      // disable all previous subscribers
      tap(() => this.ngUnsubscribe.next()),
      tap(() => {
        loading.then(l => l.present());
      }),
      // load the new imageId
      switchMap(id => this.loadImageSetById(id).pipe(
        map(() => id),
        finalize(() => {
          console.log('done loading');
          loading.then(l => l.dismiss());
        })
      )),
      tap(() => {

        const handleError = catchError(err => {
          console.log(err)
          this.showError(err.message);
          return of();
        })
    
        const thTime = 1500;
        // pipeline for handling left arrow key
        this.leftKeyMove$.pipe(
          takeUntil(this.ngUnsubscribe),
          map(() => {
            if (this.canPrevImage) {
              this.prevImage();
              return true;
            } else {
              return false;
            }    
          }),
          throttleTime(thTime),
          switchMap((handeled) => {
            if(!handeled) {
              // TODO: manager permission questions
              //return this.askForPreviousImageSequence()
              return of(1).pipe(
                switchMap(() => this.navigateToPreviousImageSequence()),
                handleError,
              )
            }

            return of();
          }),
          take(1)
        ).subscribe();

        // pipeline for handling right arrow key
        this.rightKeyMove$.pipe(
          takeUntil(this.ngUnsubscribe),
          map(() => {
            if (this.canNextImage) {
              this.nextImage();
              return true;
            } else {
              return false;
            }    
          }),
          throttleTime(thTime),
          tap(() => console.log('event')),
          switchMap((handeled) => {
            if(!handeled) {
              // TODO: manager permission questions
              //return this.askForNextImageSequence()
              return of(1).pipe(
                take(1),
                switchMap(() => this.navigateToNextImageSequence()),
                handleError
              )
            }
            return of();
          }),
          take(1)
        ).subscribe();

        // updateding dataset and project information
        this.imageSetId.pipe(
          takeUntil(this.ngUnsubscribe),
          switchMap((imageId: number) => {
            // notify dataset change
            return this.omeroAPI.getImageDataset(imageId).pipe(
              tap((dataset: Dataset) => this.dataset$.next(dataset)),
            );
          }),
          switchMap((dataset: Dataset) => {
            // notfy project change
            return this.omeroAPI.getDatasetProjects(dataset).pipe(
              map(projects => projects[0]),
              tap((project: Project) => this.project$.next(project))
            );
          }),
        ).subscribe();
    
      })
    ).subscribe((id) => console.log(`Loaded image set ${id}`))

    // get the query param and fire the image id
    this.route.paramMap.pipe(
      map(params => {
        return Number(params.get('imageSetId'));
      }),
      //tap(imageSetId => this.stateService.imageSetId = imageSetId),
      tap((imageSetId) => this.imageSetId.next(imageSetId)),
      take(1), // take only once --> pipe is closed immediately and finalize stuff is called
    ).subscribe(
      () => console.log('Successfully loaded!')
    );
  }

  ionViewDidLeave() {
    // This aborts all HTTP requests.
    this.ngUnsubscribe.next();
    // This completes the subject properly.
    //this.ngUnsubscribe.complete();
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
      // TODO: depending on the tracking load the segmentation
      // Currently: Load the latest GUISegmentation
      mergeMap((joint) => {
        return this.omeroAPI.getLatestFileJSON(imageSetId, 'GUISegmentation.json').pipe(
          map(segm => ({urls: joint.urls, tracking: joint.tracking, segm}))
        );
      }),
      takeUntil(this.ngUnsubscribe),
      // create the segmentation connector
      switchMap((content) => {
        let srsc: GlobalSegmentationOMEROStorageConnector;
        let created = false;

        let srscPipeline: Observable<GlobalSegmentationOMEROStorageConnector>;

        if (content.segm === null) {
          srscPipeline = this.omeroImport(imageSetId, false).pipe(
            //map((srsc: GlobalSegmentationOMEROStorageConnector) => 'hello'),
            catchError(e => {
              // loading from OMERO failed or has been rejected
              srsc = GlobalSegmentationOMEROStorageConnector.createNew(this.omeroAPI, imageSetId, content.urls, this.ngUnsubscribe);
              return of(srsc);
            })
          )
        } else {
          // load the existing model file
          srsc = GlobalSegmentationOMEROStorageConnector.createFromExisting(this.omeroAPI, content.segm, imageSetId, this.ngUnsubscribe);
          srscPipeline = of(srsc);
        }
        return srscPipeline.pipe(
          map (srsc => {return {srsc, tracking: content.tracking, urls: content.urls}})
        );
      }),
      map((content) => {
        // add the simple model
        // TODO the construction here is a little bit weird
        const derived = new SimpleSegmentationHolder(content.srsc.getModel());
        const derivedConnector = new SimpleSegmentationOMEROStorageConnector(this.omeroAPI, derived, content.srsc);
        // if we create a new segmentation -> update also the simple storage
        //if (created) {
        derivedConnector.update().pipe(take(1)).subscribe(() => console.log('Enforced creation update!'));
        //}

        return {...content, derived};
      }),
      // create the tracking connector
      /*map((content) => {
        let trsc: TrackingOMEROStorageConnector;
        if (content.tracking === null) {
          // create a tracking
          trsc = TrackingOMEROStorageConnector.createNew(this.omeroAPI, content.srsc);
        } else {
          // load from existing
          trsc = TrackingOMEROStorageConnector.createFromExisting(this.omeroAPI, content.srsc, content.tracking);
        }

        return {srsc: content.srsc, trsc, derived: content.derived, urls: content.urls};
      }),*/
      tap(async (content) => {
        this.pencil = new Pencil(this.imageDisplay.ctx, this.imageDisplay.canvasElement);

        //this.stateService.imageSetId = imageSetId;
        await this.importSegmentation(content.srsc.getModel(), content.derived, content.urls);
        //await this.importTracking(content.trsc.getModel());
      }),
      switchMap(() => this.route.paramMap.pipe(take(1))),
      switchMap(params => {
        return this.curSegUI.loadImage().pipe(
          take(1),
          map(img =>  {return {img, params}})
        )
      }),
      tap(({img, params}) => {
        // center a rectangle
        const xOffset = Number(params.get('x') || 0);
        const yOffset = Number(params.get('y') || 0);
        const width = Number(params.get('width') || img.width);
        const height = Number(params.get('height') || img.height);

        this.imageDisplay.centerFixedBox(new BoundingBox(xOffset, yOffset, width, height));
      }),
      tap(() => {
        console.log('Draw');
        this.draw();
      },
      take(1))
    );

  }

  /**
   * Import Segmentation Data into the current UI
   * @param globalSegModel holder of all segmentation data
   * @param simpleSegHolder holder of simple segmentation 
   * @param imageUrls omero urls of the images
   */
  async importSegmentation(globalSegModel: GlobalSegmentationModel, simpleSegHolder: SimpleSegmentationHolder, imageUrls: string[]) {
    // now that we have a holder we can start using it
    this.globalSegModel = globalSegModel;
    this.globalSegModel.modelChanged.subscribe((event: ModelChanged<GlobalSegmentationModel>) => {
      this.segModelChanged(event);
    });

    this.simpleSegHolder = simpleSegHolder;

    // generate segmentation uis
    this.segmentationUIs = [];
    for (const [index, segModel] of this.globalSegModel.segmentationModels.entries()) {
      this.segmentationUIs.push(new SegmentationUI(segModel, imageUrls[index], this.imageDisplay.canvasElement, this.actionSheetController));
    }
  }

  /**
   * Import {@link TrackingModel} into the current UI
   * @param trackingModel the tracking model to import
   */
  /*async importTracking(trackingModel: TrackingModel) {
    if (trackingModel === null) {
      // There was an error while loading the tracking
      const toast = await this.toastController.create({
        message: `Error while loading tracking data`,
        duration: 2000
      });
      toast.present();
    } else {
      // set the tracking model
      this.trackingModel = trackingModel;
      // create the associated tracking UI
      this.trackingUI = new TrackingUI(this.segmentationModels,
        this.segmentationUIs,
        this.trackingModel,
        this.imageDisplay.canvasElement,
        this.toastController,
        this.activeView);
      this.trackingModel.onModelChanged.subscribe((trackingChangedEvent: ModelChanged<TrackingModel>) => {
          // redraw
          this.draw();
      });
    }
  }*/

  /*get segHolder() {
    return this.stateService.holder;
  }

  set segHolder(segHolder: SegmentationHolder) {
    this.stateService.holder = segHolder;
  }*/

  get segmentationModels() {
    if (this.globalSegModel) {
      return this.globalSegModel.segmentationModels;
    } else {
      return [];
    }
  }

  /*get trackingModel() {
    return this.stateService.tracking;
  }

  set trackingModel(trackingModel: TrackingModel) {
    this.stateService.tracking = trackingModel;
  }*/

  get isSegmentation() {
    return this.editMode === EditMode.Segmentation;
  }

  get isTracking() {
    return this.editMode === EditMode.Tracking;
  }

  get curSegUI(): SegmentationUI {
    return this.segmentationUIs[this.activeView];
  }

  get curSegModel(): LocalSegmentationModel {
    if (this.globalSegModel) {
      return this.globalSegModel.getLocalModel(this.activeView);//segmentationModels[this.activeView];
    } else {
      return null;
    }
  }

  segModelChanged(segModelChangedEvent: ModelChanged<GlobalSegmentationModel>) {
    //if (this.curSegModel === segModelChangedEvent.model) {
      this.draw();
    //}
  }

  @HostListener('document:keydown.control.z')
  async undo() {
    if (this.canUndo) {
      if (this.editMode === EditMode.Segmentation && this.curSegModel) {
        this.globalSegModel.undo();
      } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
        this.trackingUI.undo();
      }
    }
  }

  @HostListener('document:keydown.control.y')
  async redo() {
    if (this.canRedo) {
      if (this.editMode === EditMode.Segmentation && this.curSegModel) {
        this.globalSegModel.redo();
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
    } else {
      // TODO: this case should not happen because you should not be able to click the done button then
      console.info('Cannot redirect the save signal to tools!');
    }
  }

  get canRedo() {
    if (this.editMode === EditMode.Segmentation && this.curSegModel) {
      //return this.curSegModel.canRedo;
      return this.globalSegModel.canRedo;
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      return this.trackingUI.canRedo;
    }

    return false;
  }

  get canUndo() {
    if (this.editMode === EditMode.Segmentation && this.curSegModel) {
      //return this.curSegModel.canUndo;
      return this.globalSegModel.canUndo;
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

    /*if (this.isSegmentation && this.tool) {
      if (this.tool.setModel == 'function') {
        this.tool.setModel(this.curSegModel, this.curSegUI);
      }
    }*/

    this.draw();
  }

  get activeView() {
    return this._activeView;
  }

  onSliderChanged(event) {
    console.log('slider changed');
    console.log(event);
    this.setImageIndex(event.detail.value);
  }

  /**
   * Center the image and draw segmentation model
   */
  centerImage() {
    this.curSegUI.loadImage().pipe(
      take(1),
      map(img => this.imageDisplay.showFixedBox(new BoundingBox(0, 0, img.width, img.height))),
    ).subscribe();
  }

  prepareDraw(): Observable<Drawer> {
    if (this.activeTool) {
      return this.tool.prepareDraw();
    }
    else if (this.editMode === EditMode.Segmentation) {
      if (this.segmentationUIs.length == 0) {
        return null;
      }
      // draw the segmentation stuff
      return this.segmentationUIs[this.activeView]?.prepareDraw();
    } else {
      return this.trackingUI?.prepareDraw();
    }
  }

  draw() {
    if (this.drawingSubscription) {
      this.drawingSubscription.unsubscribe();
    }

    this.drawTimer = setTimeout(() => console.log('slow draw'), 500);

    // TODO: show timer if loading takes long!

    this.drawingSubscription = this.prepareDraw()?.pipe(
      take(1),
      tap(() => clearTimeout(this.drawTimer)),
      map((drawer) => {
        if (drawer) {
          drawer.draw(this.pencil);
        }
      })
    ).subscribe(
      () => {
        //console.log('Home: Successful draw');
      },
      (e) => {console.log('Error during drawing process!'); console.error(e)},
      () => this.drawingSubscription = null      
    );
  }

  get ctx() {
    return this.imageDisplay.ctx;
  }

  // TODO: Removable code? Should not be used anymore!
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
                // TODO: Default label id?
                actions.push(new AddPolygon(poly, 0));
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

  /**
   * Show an error to the user
   * @param message the message
   * @param duration the duration the message is presented
   */
  showError(message: string, duration = 2000) {
    // segmentation proposals have been applied successfully
    this.toastController.create({
      message,
      duration
    }).then(toast => toast.present());
  }

  /**
   * Request tracking proposals and add them to the tracking model
   */
  /*track() {
    // we need to access derived segmentation holder
    this.simpleSegHolder.update();
    const segContent = this.simpleSegHolder.content;

    const currentFrame = this.activeView;
    const nextFrame = this.activeView + 1;

    if (nextFrame >= segContent.length) {
      this.showError('There is now future frame for tracking!');
      return;
    }

    const loading = this.loadingCtrl.create({
      message: 'Please wait while tracking is computed...',
      backdropDismiss: true,
    });
    loading.then(l => l.present());

    const restrictedSimpleSeg: SimpleSegmentation[] = [segContent[currentFrame], segContent[nextFrame]];

    this.trackingService.computeTracking(restrictedSimpleSeg).pipe(
      finalize(() => loading.then(l => l.dismiss()))
    ).subscribe(
      ((links: Array<Link>) => {
        console.log(links);

        // filter links --> only meaningful links
        const filteredLinks = links.filter((link) => !(link.sources.length === 0 || link.targets.length === 0));

        if (filteredLinks.length === 0) {
          // no link survived filtering
          this.showError('No tracking link survived filtering! No tracking info added!');
        }

        const actions = [];
        for (const link of filteredLinks) {
          const targets = [];
          for (const target of link.targets) {
            targets.push(new SelectedSegment(target));
          }
          actions.push(new AddLinkAction(new SelectedSegment(link.sources[0]), targets));
        }

        this.trackingModel.actionManager.addAction(new JointAction(...actions));
      }),
      () => this.showError('Error while tracking!')
    );
  }*/

  omeroImport(imageSetId, reload=true): Observable<GlobalSegmentationOMEROStorageConnector> {
    // 1. Check whether OMERO has ROI data available
    return this.imageSetId.pipe(
      switchMap(id => this.omeroAPI.getPagedRoIData(id)),
      take(1),
      map(roiData => {
        if (roiData.length == 0) {
          throw new Error("No omero data available");
        }
        return roiData;
      }),
      switchMap(roiData => {
        // 2. Let the user decide whether he  wants to import it
        return from(this.alertController.create({
          cssClass: 'over-loading',
          header: 'Import Segmentation?',
          message: `Do you want to import existing segmentation data (${roiData.length} cells) from OMERO?`,
          buttons: [
            {
              text: 'No',
              role: 'cancel',
              cssClass: 'secondary',
            }, {
              text: 'Yes',
              role: 'confirm',
            }
          ]
        })).pipe(
          tap(alert => alert.present()),
          switchMap(alert => alert.onDidDismiss()),
          map(alertResult => {
            if(alertResult.role != 'confirm')  {
              throw new Error("User canceled import!");
            }

            return roiData.map(r => r.shapes).reduce((a,b) => a.concat(b), []);
          })
        )
      }),
      // deactivate data synchronization
      tap(() => this.ngUnsubscribe.next()),
      switchMap(roiData => this.omeroAPI.getImageUrls(imageSetId).pipe(map(urls => {return {roiData, urls}}))),
      map(combined => {
        const {roiData, urls} = combined;
        // try to load the data
        const srsc = GlobalSegmentationOMEROStorageConnector.createNew(this.omeroAPI, imageSetId, urls, this.ngUnsubscribe);

        // add every polygon that already exists in omero
        for (const poly of roiData) {
          const currentModel = srsc.getModel()//.segmentations[poly.t]

          // create polygon add action
          // TODO: How to deal with omero imports & labels?
          const action = new AddPolygon(new Polygon(...poly.points), 0);

          // execute the action
          currentModel.addAction(new LocalAction(action, poly.t));
        }
        
        return srsc;
      }),
      switchMap((srsc: GlobalSegmentationOMEROStorageConnector) => {
        return srsc.update().pipe(
          map(() => srsc)
        );
      }),
      tap(() => {
        if (reload) {
          this.imageSetId.next(imageSetId)
        }
      }),
    );
  }

  /**
   * Kicks off pipeline for omero Export including alert question
   */
  omeroExport() {
    // 1. Warn the user that this can overwrite data
    from(this.alertController.create({
          header: 'Confirm OMERO Export',
          message: 'Do you really want to export to OMERO? This will erase all exisiting RoI data!',
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Confirm',
              role: 'confirm'
            }
          ]
        }))
    .pipe(
      tap((alert) => alert.present()),
      switchMap(alert => alert.onDidDismiss()),
      tap(role => this.showError(`Role result: ${role.role}`)),
      map(role => {
        if (role.role == 'confirm')
          return role;
        else
          // exit the pipeline
          throw new Error('User did abort the action');
      }),
      tap(() => this.showError('You clicked confirm!')),
      // get the image id
      switchMap(() => this.imageSetId),
      // 2. Fetch all the rois from omero
      tap(() => console.log("Get RoI Data...")),
      switchMap((imageSetId: number) => this.omeroAPI.getPagedRoIData(imageSetId).pipe(
        map(rawData => {
          return {"roiData": rawData, "imageSetId": imageSetId}
        })
      )),
      tap(() => this.showError('Finished loading rois')),
      tap((data) => {
        const allItemCount = data.roiData.map((roi) => roi.shapes.length).reduce((a,b) => a+b, 0);
        this.showError(`Will have to delete ${allItemCount} rois`);
      }),
      // 3. compose request (delete all existing, add all new) & send
      tap(() => console.log("Start deleting/adding ...")),
      switchMap((data) => {
        return of(this.omeroAPI.deleteRois(data.imageSetId, OmeroUtils.createRoIDeletionList(data)), this.omeroAPI.createRois(data.imageSetId, OmeroUtils.createNewRoIList(this.globalSegModel.segmentationData.segData))).pipe(combineAll());
      }),
      tap(() => console.log('Finished deleting/adding!')),
      tap(x => console.log(x)),
      tap(() => this.showError("Successfully finished pipeline"))
    ).subscribe();
  }

  /**
   * Creates an alter dialog with specific layout
   * @param header header 
   * @param message message (usually a question)
   * @param cancelText text of cancel button
   * @param confirmText text of confirm button
   * @returns "confirm" if confirm button is clicked, otherwise error
   */
  alertAsk(header, message, cancelText='cancel', confirmText='confirm') {
    // 1. Warn the user that this can overwrite data
    return from(this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: cancelText,
          role: 'cancel',
        },
        {
          text: confirmText,
          role: 'confirm'
        }
      ]
    })).pipe(
      tap((alert) => alert.present()),
      switchMap(alert => alert.onDidDismiss()),
      map(data => {
        if (data.role !== 'confirm') {
          throw new Error("User canceled next image movement");
        }

        console.log(data.role);

        return data;
      }));
  }

  /**
   * ask for next image sequence
   */
  askForNextImageSequence() {
    return this.alertAsk(
      'Next Image Sequence?',
      'Do you want to jump to the next image sequence in the dataset?'
    );
  }

  /**
   * ask for previous image sequence
   */
  askForPreviousImageSequence() {
    return this.alertAsk(
      'Previous Image Sequence?',
      'Do you want to jump to the previous image sequence in the dataset?'
    )
  }

  /**
   * Navigate to the next image sequence in the dataset if possible
   */
  navigateToNextImageSequence() {
    return this.imageSetId.pipe(
      take(1),
      switchMap(id => {
        return this.omeroAPI.nextImageSequence(id)
      }),
      map(nextId => {
        return this.router.navigate(['/seg-track', { imageSetId: nextId}])
      })
    );
  }

  /**
   * Navigate to the previous image sequence in the dataset if possible
   */
  navigateToPreviousImageSequence() {
    return this.imageSetId.pipe(
      take(1),
      switchMap(id => {
        return this.omeroAPI.previousImageSequence(id)
      }),
      map(nextId => {
        return this.router.navigate(['/seg-track', { imageSetId: nextId}])
      })
    );
  }

  toggleTool(tool) {
    // TODO: close all other tools
    of(1).pipe(
      map(() => {
        if (this.tool == tool && this.tool.show) {
          tool.close();
          this.tool = null;
        } else {
          // close other tool
          if (this.tool) {
            this.tool.close();
          }
          this.tool = tool;
          // open new tool
          this.tool.open();
        }
    
        // draw -> via new tool
        this.draw();
      })
    ).subscribe();
  }

  get activeTool() {
    if (this.tool && this.tool.show) {
      return this.tool;
    } else {
      return null;
    }
  }

}
