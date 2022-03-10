import { Dataset, OmeroAPIService, Project, RoIShape } from './../services/omero-api.service';
import { HttpClient } from '@angular/common/http';
import { OmeroUtils, UIUtils, Utils } from './../models/utils';
import { Polygon, Point, BoundingBox } from './../models/geometry';
import { AddPolygon, JointAction, LocalAction, AddLabelAction, Action } from './../models/action';
import { SegmentationService } from './../services/segmentation.service';
import { ModelChanged } from './../models/change';
import { GlobalSegmentationOMEROStorageConnector, SimpleSegmentationOMEROStorageConnector } from './../models/storage-connectors';
import { map, take, mergeMap, switchMap, tap, finalize, takeUntil, combineAll, throttleTime, catchError } from 'rxjs/operators';
import { EMPTY, from, Observable, of, pipe, ReplaySubject, Subject, Subscription, throwError } from 'rxjs';
import { Pencil, UIInteraction } from './../models/drawing';
import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { Drawer } from 'src/app/models/drawing';
import { SegmentationUI } from './../models/segmentation-ui';
import { SimpleSegmentationHolder as SimpleSegmentationHolder, GlobalSegmentationModel, LocalSegmentationModel, SegCollData } from './../models/segmentation-model';
import { ActionSheetController, AlertController, LoadingController, NavController, PopoverController, ToastController } from '@ionic/angular';
import { Component, ViewChild, OnInit, AfterViewInit, HostListener, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import * as dayjs from 'dayjs';
import { BrushComponent } from '../components/brush/brush.component';
import { MultiSelectToolComponent } from '../components/multi-select-tool/multi-select-tool.component';
import { UserQuestionsService } from '../services/user-questions.service';
import { AnnotationLabel } from '../models/segmentation-data';
import { StateService } from '../services/state.service';
import { FlexibleSegmentationComponent } from '../components/flexible-segmentation/flexible-segmentation.component';


const { Storage } = Plugins;

/**
 * Different data backend modes
 */
enum BackendMode {
  SegTrack,
  OMERO
}

/**User canceled import action */
class UserCanceledImportError extends Error {
  constructor() {
    super("User canceled import!")
  }
}

/** No OmeroRoIs are available */
class NoOmeroRoIError extends Error {
  constructor() {
    super("No Omero RoIs to import!")
  }
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit, Drawer, UIInteraction{

  /* the canvas to display the image */
  @ViewChild(ImageDisplayComponent) imageDisplay: ImageDisplayComponent;

  /** Container for tools */
  @ViewChild('toolContainer', { read: ViewContainerRef }) container;

  // the different segmentation tools
  @ViewChild('flexSegTool') flexSegTool: FlexibleSegmentationComponent;
  @ViewChild('brushTool') brushToolComponent: BrushComponent;
  @ViewChild('multiSelectTool') multiSelectComponent: MultiSelectToolComponent;

  /** the currently active tool */
  tool = null;


  /** segmentation user interface */
  segmentationUIs: SegmentationUI[] = [];

  // segmentation data holders (they take care for automatic updates to backend)
  simpleSegHolder: SimpleSegmentationHolder;
  globalSegModel: GlobalSegmentationModel;

  justTapped = false;

  /** backend storage mode */
  backendMode = BackendMode.OMERO;

  /** active frame in image stack */
  _activeView = 0;

  rightKeyMove$ = new Subject<void>();
  leftKeyMove$ = new Subject<void>();

  // this can be used to end other pipelines using takeUntil(ngUnsubscribe)
  protected ngUnsubscribe: Subject<void> = new Subject<void>();

  /** general error handling pipeline */
  showErrorPipe = catchError(e => {this.userQuestions.showError(e); return throwError(e);});

  /** current image stack omero id */
  imageSetId = new ReplaySubject<number>(1);

  // drawing utilities
  pencil: Pencil;
  drawingSubscription: Subscription;

  drawTimer = null;
  drawLoader = null;

  // dataset and project information for navigation bar
  dataset$ = new ReplaySubject<Dataset>(1);
  project$ = new ReplaySubject<Project>(1);

  // whether there have been previous pages!
  canNavigateBack = false;

  // promise to the loading dialog
  loading = null;

  constructor(private actionSheetController: ActionSheetController,
              private route: ActivatedRoute,
              private router: Router,
              private segmentationService: SegmentationService,
              private omeroAPI: OmeroAPIService,
              private loadingCtrl: LoadingController,
              private httpClient: HttpClient,
              private alertController: AlertController,
              private userQuestions: UserQuestionsService,
              private stateService: StateService,
              private navCtrl: NavController) {

    // record navigation history
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.canNavigateBack = true;
      }
    })

    // setup loading pipeline when we get a new imageId (also used for refreshing!)
    this.imageSetId.pipe(
      tap((id) => console.log(`imageSetID changed to ${id}`)),
      // disable all previous subscribers
      tap(() => this.ngUnsubscribe.next()),
      tap(() => {
        // create progress loader
        this.loading = this.loadingCtrl.create({
          message: 'Loading data...',
          backdropDismiss: false
        });
        this.loading.then(l => l.present());
      }),
      // load the new imageId
      switchMap(id => this.loadImageSetById(id).pipe(
        map(() => id),
        finalize(() => {
          console.log('done loading');
          this.loading.then(l => l.dismiss());
        })
      )),
      catchError((e, caught) => {
        this.userQuestions.showError("Failed loading image data! Navigate back in 5 seconds!");
        setTimeout(() => {
          if(this.canNavigateBack) {
            // navigate back
            this.navCtrl.back();
          } else {
            // navigate to default view
            this.router.navigateByUrl('/omero-dashboard');
          }
        }, 5000);
        throwError(new Error("Failed loding image data"));
        return EMPTY;
      }),
      tap(() => {
        if (this.stateService.openTool == "BrushTool" && !this.isToolActive(this.brushToolComponent)) {
          // open the brush tool if it was open before
          this.toggleTool(this.brushToolComponent);
        }
      }),
      tap(() => {

        const handleError = catchError(err => {
          console.error("Error while loading image");
          console.log(err)
          this.userQuestions.showError(err.message);
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
    ).subscribe(
      (id) => console.log(`Loaded image set ${id}`),
      (error) => this.userQuestions.showError(`Failed loading image! Error: ${error.message}`)
    );

    // set up navigation pipeline
    // get the query param and fire the image id
    this.route.paramMap.pipe(
      map(params => {
        return Number(params.get('imageSetId'));
      }),
      //tap(imageSetId => this.stateService.imageSetId = imageSetId),
      tap((imageSetId) => {
        this.imageSetId.next(imageSetId)
      }),
    ).subscribe(
      () => console.log('Successfully loaded!')
    );                
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
    } 
    
    return false;
  }

  onPointerMove(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPointerMove(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPointerMove(event);
    } 
    
    return false;
  }

  onPointerUp(event: any): boolean {
    if (this.tool) {
      if (this.tool.onPointerUp(event)) {
        return true;
      }
    }
    if (this.isSegmentation) {
      return this.curSegUI?.onPointerUp(event);
    } 
    
    return false;
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
    }

    return false;
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

    return false;
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

    return false;
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

    return false;
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

    return false;
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
      if (this.curSegUI) {
        return this.curSegUI.onMove(event);
      }
    }

    return true;
  }

  // Short-Key bindings

  @HostListener('document:keydown.enter', ['$event'])
  async saveKey(event) {
    this.done();
  }

  @HostListener('document:keydown.a', ['$event'])
  async saveKey2(event) {
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

  @HostListener('document:keydown.control.z')
  async undo() {
    if (this.canUndo) {
      if (this.curSegModel) {
        this.globalSegModel.undo();
      }
    }
  }

  @HostListener('document:keydown.control.y')
  async redo() {
    if (this.canRedo) {
      if (this.curSegModel) {
        this.globalSegModel.redo();
      }
    }
  }

  ionViewDidLeave() {
    // This aborts all auto savings.
    this.ngUnsubscribe.next();
    // close loading if needed
    if (this.loading) {
      this.loading.then(l => l.dismiss());
    }
  }

  /**
   * Load imageset from OMERO
   * @param imageSetId image set id
   */
  loadImageSetById(imageSetId: number) {
    // get image urls
    return this.omeroAPI.getImageUrls(imageSetId).pipe(
      switchMap((urls: string[]) => {
        return of(urls).pipe(
          // Currently: Load the latest GUISegmentation
          mergeMap((joint) => {
            return this.omeroAPI.getLatestFileJSON(imageSetId, 'GUISegmentation.json').pipe(
              map(segm => ({urls: urls, segm}))
            );
          }),
          takeUntil(this.ngUnsubscribe),
          // create the segmentation connector
          switchMap((content) => {
            let srsc: GlobalSegmentationOMEROStorageConnector;
            let created = false;

            let srscPipeline: Observable<GlobalSegmentationOMEROStorageConnector>;

            if (content.segm === null) {
              srscPipeline = this.omeroImport(false).pipe(
                //map((srsc: GlobalSegmentationOMEROStorageConnector) => 'hello'),
                catchError(e => {
                  // loading from OMERO failed or has been rejected
                  srsc = GlobalSegmentationOMEROStorageConnector.createNew(this.omeroAPI, imageSetId, content.urls, this.ngUnsubscribe);
                  return of(srsc).pipe(
                    // enforce an update
                    tap((srsc) => srsc.update().subscribe())
                  );
                })
              )
            } else {
              // load the existing model file
              srscPipeline = of(1).pipe(
                map(() => {
                  const srsc = GlobalSegmentationOMEROStorageConnector.createFromExisting(this.omeroAPI, content.segm, imageSetId, this.ngUnsubscribe)
                  return srsc;
                }),
                catchError((e, obs) => {
                  // there was an error importing the existing data

                  // ask user to create new segmentation
                  return this.userQuestions.createNewData().pipe(
                    switchMap((createNewOne) => {
                      if(createNewOne) {
                        // create new segmentation
                        srsc = GlobalSegmentationOMEROStorageConnector.createNew(this.omeroAPI, imageSetId, urls, this.ngUnsubscribe);
                        // and force an update on the server
                        return of(srsc).pipe(
                          tap(() => srsc.update().subscribe())
                        );
                      } else {
                        // TODO: Navigate to parent
                        throwError(e);
                        return of(null);
                      }
                    })
                  );
                })
              );
            }
            return srscPipeline.pipe(
              map (srsc => {return {srsc, urls: content.urls}})
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
          tap(async (content) => {
            this.pencil = new Pencil(this.imageDisplay.ctx, this.imageDisplay.canvasElement);

            //this.stateService.imageSetId = imageSetId;
            await this.importSegmentation(content.srsc.getModel(), content.derived, content.urls);
            //await this.importTracking(content.trsc.getModel());
          }),
        );
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
      this.segmentationUIs.push(new SegmentationUI(segModel, imageUrls[index], this.imageDisplay.canvasElement, this.actionSheetController, this.userQuestions));
    }
  }


  /**
   * get the individual local segmentatoin model per frame
   */
  get segmentationModels(): Array<LocalSegmentationModel> {
    if (this.globalSegModel) {
      return this.globalSegModel.segmentationModels;
    } else {
      return [];
    }
  }

  /**
   * is the view in segmentation mode. It always is as tracking is not yet supported.
   */
  get isSegmentation() {
    return true;
  }

  /**
   * get the user interface for the current active image view
   */
  get curSegUI(): SegmentationUI {
    return this.segmentationUIs[this.activeView];
  }

  /**
   * get the current active image segmentation model
   */
  get curSegModel(): LocalSegmentationModel {
    if (this.globalSegModel) {
      return this.globalSegModel.getLocalModel(this.activeView);//segmentationModels[this.activeView];
    } else {
      return null;
    }
  }

  /**
   * Reacts on segmentation model changes.
   * @param segModelChangedEvent the change event
   */
  segModelChanged(segModelChangedEvent: ModelChanged<GlobalSegmentationModel>) {
    // redraw to update visualized content  
    this.draw();
  }


  get canSave() {
    if (this.tool) {
      return this.tool.canSave;
    }
    if (this.curSegUI) {
      return this.curSegUI.canSave;
    }

    return false;
  }

  async done() {
    if (this.canSave) {
      if (this.tool) {
        this.tool.save();
      }
      else if (this.curSegUI) {
        this.curSegUI.save();
        return;
      }
    } else {
      // TODO: this case should not happen because you should not be able to click the done button then
      console.info('Cannot redirect the save signal to tools!');
    }
  }

  get canRedo() {
    if (this.curSegModel) {
      return this.globalSegModel.canRedo;
    }

    return false;
  }

  get canUndo() {
    if (this.curSegModel) {
      return this.globalSegModel.canUndo;
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

    this.draw();
  }

  get activeView() {
    return this._activeView;
  }

  onSliderChanged(event) {
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

  /**
   * Preparse the currently active drawer for draing
   * @returns observable on the drawer
   */
  prepareDraw(): Observable<Drawer> {
    if (this.activeTool) {
      return this.tool.prepareDraw();
    }
    else {
      if (this.segmentationUIs.length == 0) {
        return null;
      }
      // draw the segmentation stuff
      return this.segmentationUIs[this.activeView]?.prepareDraw();
    }
  }

  /**
   * Draw the current content
   */
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
      },
      (e) => {
        console.log('Error during drawing process!');
        console.error(e);
        throwError(e);
      },
      () => this.drawingSubscription = null      
    );
  }

  get ctx() {
    return this.imageDisplay.ctx;
  }

  /**
   * Import segmentation RoIs from omero. This is the workflow in an rxjs fashion, finally subscribed in this function
   * @param reload whether to update the UI (default: true)
   * @param showLoading whether to show a loading controller (not necessary if there already is one)
   * @returns nothing
   */
  omeroImport(reload=true, showLoading=false): Observable<GlobalSegmentationOMEROStorageConnector> {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Importing data from omero...',
      backdropDismiss: true
    });

    // 1. Check whether OMERO has ROI data available
    return this.imageSetId.pipe(
      take(1),
      tap(() => {
        if (showLoading) {
          loading.then(l => l.present());
        }
      }),
      switchMap((imageSetId: number) => {
        return this.omeroAPI.getPagedRoIData(imageSetId).pipe(
          take(1),
          map(roiData => {
            if (roiData.length == 0) {
              throw new NoOmeroRoIError();
            }
            return roiData;
          }),
          switchMap(roiData => {
            // 2. Let the user decide whether he  wants to import it
            return from(this.alertController.create({
              cssClass: 'over-loading',
              header: 'Import Segmentation?',
              message: `Do you want to import existing segmentation data (${roiData.length} cells) from OMERO? <br /><br />Warning: This action cannot be reverted!`,
              inputs: [
                {
                  name: 'labels',
                  label: 'Import labels?',
                  type: 'checkbox',
                  checked: false,
                  value: 'labels',
                },
              ],        
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
                  throw new UserCanceledImportError();
                }

                const importLabels = alertResult.data.values.includes('labels');
    
                return {importLabels, roiData: roiData.map(r => r.shapes).reduce((a,b) => a.concat(b), [])};
              })
            )
          }),
          // deactivate data synchronization
          tap(() => this.ngUnsubscribe.next()),
          switchMap(({importLabels, roiData}) => this.omeroAPI.getImageUrls(imageSetId).pipe(map(urls => {return {importLabels, roiData, urls}}))),
          map(combined => {
            let {importLabels, roiData, urls} = combined;

            // only polgyons
            roiData = roiData.filter(shape => shape.type == "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon")

            // create new connector
            const srsc = GlobalSegmentationOMEROStorageConnector.createNew(this.omeroAPI, imageSetId, urls, this.ngUnsubscribe);

            // add every polygon that already exists in omero
            const additionalLabels: string[] = [];
            /** Array of all actions to be performed */
            const actions: Action<SegCollData>[] = [];
            const currentModel = srsc.getModel()
            const existingLabels = currentModel.labels;
            const firstFreeLabelId = currentModel.nextLabelId();

            // TODO: correct t and z handling
            const t_max = Math.max(...roiData.map(poly => poly.t));
            const z_max = Math.max(...roiData.map(poly => poly.z));
            let timeMode = '';

            if (t_max == 0) {
              // we have no time axis
              timeMode = 'z';
            } else if(z_max == 0) {
              // we have no z axis
              timeMode = 't';
            } else {
              // we have both axes
              console.warn('TZ mode is not yet fully supported')
              timeMode = 'tz';
            }

            const timeComputer = (poly: RoIShape, mode: string) => {
              if (mode == 't') {
                return poly.t;
              } else if (mode == 'z') {
                return poly.z;
              } else if (mode == 'tz') {
                return poly.t * z_max + poly.z;
              } else {
                throw new Error('Unsupported time mode');
              }
            }


            // create the AddPolygon action for every polygon that we have
            for (const poly of roiData) {

              // get the label name from text
              const labelName = poly.text;

              let labelId = -1;
              if (importLabels) {
                // if we want to import labels
                if (existingLabels.map(l => l.name).includes(labelName)) {
                  // we can take an existing label
                  labelId = existingLabels.filter(l => l.name == labelName)[0].id;
                } else {
                  if (additionalLabels.includes(labelName)) {
                    labelId = firstFreeLabelId + additionalLabels.indexOf(labelName);
                  } else {
                    // add the new label and give a new id
                    labelId = additionalLabels.length;
                    additionalLabels.push(labelName);
                  }
                }
              } else {
                // if we do not want to import labels we will put everything into the initial label class
                labelId = 0;
              }

              // create polygon add action
              // TODO: Deal with z-coordinate?
              const action = new LocalAction(new AddPolygon(new Polygon(...Utils.checkPoints(poly.points)), labelId), timeComputer(poly, timeMode));

              actions.push(action);
            }

            // Add labels
            for (const [index, label] of additionalLabels.entries()) {
              actions.push(new AddLabelAction(new AnnotationLabel(firstFreeLabelId + index, label, true, 'random', true)));
            }

            // add all actions in one go (also undoable as one)
            srsc.getModel().addAction(new JointAction(...actions));
            
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
          finalize(() => loading.then(l => l.dismiss()))        
        )
      }),
      catchError((err) => {
        if(err instanceof UserCanceledImportError || (!showLoading && err instanceof NoOmeroRoIError)) {
          // do nothing it's not an error
          console.info(err.message);
        } else {
          this.userQuestions.showError(`Failed import from omero: ${err.message}`)
        }
        // omero import has to error out
        return throwError(err);
      })
    );
  }

  /**
   * Kicks off pipeline for omero Export including alert question
   */
  omeroExport() {
    // create progress loader
    let loading = this.loadingCtrl.create({
      message: 'Exporting data in omero...',
      backdropDismiss: true
    });

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
      tap(role => this.userQuestions.showInfo(`Role result: ${role.role}`)),
      map(role => {
        if (role.role == 'confirm')
          return role;
        else
          // exit the pipeline
          throw new Error('User did abort the action');
      }),
      tap(() => loading = loading.then(l => {l.present(); return l})),
      tap(() => this.userQuestions.showInfo('You clicked confirm!')),
      // get the image id
      switchMap(() => this.imageSetId),
      // 2. Fetch all the rois from omero
      tap(() => console.log("Get RoI Data...")),
      switchMap((imageSetId: number) => this.omeroAPI.getPagedRoIData(imageSetId).pipe(
        map(rawData => {
          return {"roiData": rawData, "imageSetId": imageSetId}
        })
      )),
      tap(() => this.userQuestions.showInfo('Finished loading rois')),
      tap((data) => {
        const allItemCount = data.roiData.map((roi) => roi.shapes.length).reduce((a,b) => a+b, 0);
        this.userQuestions.showInfo(`Will have to delete ${allItemCount} rois`);
      }),
      // 3. compose request (delete all existing, add all new) & send
      tap(() => console.log("Start deleting/adding ...")),
      switchMap((data) => {
        return of(this.omeroAPI.deleteRois(data.imageSetId, OmeroUtils.createRoIDeletionList(data.roiData)), this.omeroAPI.createRois(data.imageSetId, this.globalSegModel.segmentationData)).pipe(combineAll());
      }),
      take(1),
      tap(() => console.log('Finished deleting/adding!')),
      tap(x => console.log(x)),
      // update last modification date
      switchMap(() => this.imageSetId),
      take(1),
      switchMap((id: number) => {
        return this.omeroAPI.setLastModificationDate(id);
      }),
      tap(() => this.userQuestions.showInfo("Successfully finished pipeline")),
      finalize(() => {
        loading.then(l => l.dismiss())
      }),
      catchError((err) => {
        if(err?.message !== 'User did abort the action') {
          this.userQuestions.showError(`Failed import from omero: ${JSON.stringify(err)}`)
        }
        return throwError(err);
      })
    ).subscribe();
  }


  /**
   * ask for next image sequence
   */
  askForNextImageSequence() {
    return this.userQuestions.alertAsk(
      'Next Image Sequence?',
      'Do you want to jump to the next image sequence in the dataset?'
    );
  }

  /**
   * ask for previous image sequence
   */
  askForPreviousImageSequence() {
    return this.userQuestions.alertAsk(
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

  /**
   * Is called when the button of a tool is clicked
   * @param tool the tool associated with the button
   */
  toggleTool(tool) {
    of(1).pipe(
      map(() => {
        if (this.tool == tool && this.tool.show) {
          // tool is active and shown --> close tool
          this.stateService.openTool = "";
          tool.close();
          this.tool = null;
        } else {
          // we want to open a new tool
          // close current active tool tool
          if (this.tool) {
            this.tool.close();
          }
          this.tool = tool;
          // open new tool
          this.stateService.openTool = this.tool.name;
          this.tool.open();
        }
    
        // draw -> via new tool
        this.draw();
      })
    ).subscribe();
  }

  /**
   * 
   * @param tool the tool component
   * @returns true if the current tool component is active, i.e. presented to the user
   */
  isToolActive(tool): boolean {
    if (!tool) {
      return false;
    } else {
      return tool == this.activeTool;
    }
  }

  get activeTool() {
    if (this.tool && this.tool.show) {
      return this.tool;
    } else {
      return null;
    }
  }

  get numImages() {
    return this.segmentationModels.length;
  }

}
