import { StateService } from './../services/state.service';
import { SegmentationRESTStorageConnector, TrackingRESTStorageConnector } from './../models/storage-connectors';
import { GUISegmentation, GUITracking } from './../services/seg-rest.service';
import { map, concatAll, take, concatMap, combineAll, flatMap, zipAll, mergeAll, mergeMap } from 'rxjs/operators';
import { forkJoin, Observable, of } from 'rxjs';
import { TrackingUI } from './../models/tracking-ui';
import { ChangeType, TrackingChangedEvent, TrackingModel } from './../models/tracking';
import { TypedJSON, jsonArrayMember, jsonObject } from 'typedjson';
import { UIInteraction } from './../models/drawing';
import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { Drawer } from 'src/app/models/drawing';
import { SegmentationUI } from './../models/segmentation-ui';
import { SegmentationModel,  SegmentationHolder, ModelChanged } from './../models/segmentation-model';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { Component, ViewChild, OnInit, AfterViewInit, HostListener } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SegRestService } from '../services/seg-rest.service';
import { StorageConnector } from '../models/storage';

const { Storage } = Plugins;

enum EditMode {
  Segmentation = '0',
  Tracking = '1'
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, Drawer, UIInteraction{

  @ViewChild(ImageDisplayComponent) imageDisplay: ImageDisplayComponent;

  //segHolder = new SegmentationHolder();
  //segmentationModels: SegmentationModel[] = [];
  segmentationUIs: SegmentationUI[] = [];

  trackingModel: TrackingModel;
  trackingUI: TrackingUI;

  /** Key where the segmentation data is stored */
  segKey = 'segmentations';
  /** Key where the tracking data is stored */
  trackingKey = 'tracking';

  justTapped = false;

  _activeView = 0;

  urls = ['../assets/sequence/image0.png',
          '../assets/sequence/image1.png',
          '../assets/sequence/image2.png',
          '../assets/sequence/image3.png',
          '../assets/sequence/image4.png',
          '../assets/sequence/image5.png',
          '../assets/sequence/image6.png'];

  _editMode: EditMode = EditMode.Segmentation;

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
              private stateService: StateService) {

  }

  onTap(event: any) {
    this.justTapped = true;

    if (this.isSegmentation) {
      this.curSegUI.onTap(event);
    } else {
      this.trackingUI.onTap(event);
    }
  }
  onPress(event: any) {
    if (this.isSegmentation) {
      this.curSegUI.onPress(event);
    }
  }
  onPanStart(event: any) {
    if (this.isSegmentation) {
      this.curSegUI.onPanStart(event);
    }
  }
  onPan(event: any) {
    if (this.isSegmentation) {
      this.curSegUI.onPan(event);
    }
  }
  onPanEnd(event: any) {
    if (this.isSegmentation) {
      this.curSegUI.onPanEnd(event);
    }
  }

  onMove(event: any) {
    if (this.justTapped) {
      this.justTapped = false;
    } else {
      // redirect move action to child handlers if they are created w.r.t. mode
      if (this.isSegmentation && this.curSegUI) {
        this.curSegUI.onMove(event);
      } else if (this.trackingUI && this.trackingUI) {
        this.trackingUI.onMove(event);
      }
    }
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
    if (this.isSegmentation) {
      this.segmentationUIs[this.activeView].delete();
    }
  }

  async ngOnInit() {
    console.log('Init test');
    // get the query param and fire the id
    this.id = this.route.queryParams.pipe(
      map(params => {
        if (!this.router.getCurrentNavigation().extras.state) {
          throw new Error('No state information available');
        } else {
          return this.router.getCurrentNavigation().extras.state?.imageSetId;
        }
      })
    );

    const id = this.stateService.imageSetId;

    // now we have the id of the image set
    const toast = await this.toastController.create({
      message: `The loaded imageSet id is ${id}`,
      duration: 2000
    });
    toast.present();

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

        return {srsc, tracking: content.tracking};
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

        return {srsc: content.srsc, trsc};
      })
    ).subscribe(async (content) => {
      await this.loadSegmentation(content.srsc);
      await this.loadTracking(content.trsc);
    });

    /*// we request the latest segmentation on that image set
    this.segService.getLatestSegmentation(id).pipe(
      map((seg: GUISegmentation) => {
        if (seg) {
          // there was an existing segmentation --> we just have to load it and attach it to the storage
          return of(SegmentationRESTStorageConnector.createFromExisting(this.segService, seg).getModel());
        } else {
          // there was no existing segmentation --> we get the image urls and create new ones
          return this.segService.getImageUrls(id).pipe(
            map((urls: string[]) => {
              return SegmentationRESTStorageConnector.createNew(this.segService, id, urls).getModel();
            })
          );
        }
      }),
      concatAll(),
    ).subscribe((segHolder: SegmentationHolder) => {
      // now that we have a holder we can start using it
      this.segHolder = segHolder;
      this.segHolder.modelChanged.subscribe((event: ModelChanged<SegmentationModel>) => {
        this.segModelChanged(event);
      });

      this.segmentationModels = [];
      this.segmentationUIs = [];

      for (const model of this.segHolder.segmentations) {
        this.segmentationModels.push(model);
        this.segmentationUIs.push(new SegmentationUI(model, this.imageDisplay.canvasElement));
      }
    }, async (error) => {
      console.error(error);
      // now we have the id of the image set
      const toast = await this.toastController.create({
        message: `Error while loading segmentation for image set ${id}`,
        duration: 2000
      });
      toast.present();
    });*/
  }

  async loadSegmentation(srsc: StorageConnector<SegmentationHolder>) {
    // now that we have a holder we can start using it
    this.segHolder = srsc.getModel();
    this.segHolder.modelChanged.subscribe((event: ModelChanged<SegmentationModel>) => {
      this.segModelChanged(event);
    });

    this.segmentationModels = [];
    this.segmentationUIs = [];

    for (const model of this.segHolder.segmentations) {
      this.segmentationModels.push(model);
      this.segmentationUIs.push(new SegmentationUI(model, this.imageDisplay.canvasElement));
    }
  }

  async loadTracking(trsc: StorageConnector<TrackingModel>) {
    if (trsc === null) {
      // There was an error while loading the tracking
      const toast = await this.toastController.create({
        message: `Error while loading tracking data`,
        duration: 2000
      });
      toast.present();
    } else {
      // loading the tracking
      this.trackingModel = trsc.getModel();
      this.trackingUI = new TrackingUI(this.segmentationModels, this.trackingModel, this.imageDisplay.canvasElement, this.toastController, this.activeView);
      this.trackingModel.onModelChanged.subscribe((trackingChangedEvent: TrackingChangedEvent) => {
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
    return this.stateService.models;
  }

  set segmentationModels(segModels: SegmentationModel[]) {
    this.stateService.models = segModels;
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
    this.draw(this.ctx);
  }

  initTracking(createNewTrackingModel = true) {
    if (createNewTrackingModel) {
      this.trackingModel = new TrackingModel();
    }
    //this.trackingUI = new TrackingUI(this.segmentationModels, this.trackingModel, this.imageDisplay.canvasElement, this.toastController);
    this.trackingUI.canvasElement = this.imageDisplay.canvasElement;
    this.trackingUI.ctx = this.imageDisplay.ctx;
    this.trackingUI.toastController = this.toastController;
    this.trackingUI.currentFrame = this.activeView;
    this.trackingModel.onModelChanged.subscribe((trackingChangedEvent: TrackingChangedEvent) => {
      if (trackingChangedEvent.changeType === ChangeType.SOFT) {
        // if there are only soft changes we will just redraw
        this.draw(this.ctx);
      } else {
        // if there are hard changes in the model we will drwa & save
        this.draw(this.ctx);
        this.storeTracking();
      }
    });
  }

  async storeTracking() {
    const serializer = new TypedJSON(TrackingModel);

    const jsonString =  serializer.stringify(this.trackingModel);

    console.log(jsonString);

    Storage.set({
      key: this.trackingKey,
      value: jsonString
    });
  }

  async restoreTracking(segRestored: boolean) {

    if (!segRestored) {
      // if the segmentation could not be restored then we can not restore any tracking
      // --> create a new one
      this.initTracking();
      return false;
    }

    let restored = false;

    const serializer = new TypedJSON(TrackingModel);

    const jsonString = (await Storage.get({key: this.trackingKey})).value;

    if (jsonString) {
      const locTracking = serializer.parse(jsonString);

      if (locTracking) {
        // copy tracking model and attach ui
        this.trackingModel = locTracking;
        this.initTracking(false);

        restored = true;

        // otherwise we notify the user and use the old segmentation model
        const toast = await this.toastController.create({
          message: 'Successfully restored tracking model',
          duration: 2000
        });
        toast.present();
      }
    }

    if (!restored) {
      // there must have been something wrong during tracking restoring
      // --> create a new one
      this.initTracking();
      return false;
    }

    return true;
  }

  async undo() {
    /*const toast = await this.toastController.create({
      message: 'TODO: Undo last segmentation',
      duration: 2000
    });
    toast.present();*/
    if (this.editMode === EditMode.Segmentation && this.curSegModel) {
      this.curSegModel.undo();
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      this.trackingUI.undo();
    }
  }

  async redo() {
    if (this.editMode === EditMode.Segmentation && this.curSegModel) {
      this.curSegModel.redo();
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      this.trackingUI.redo();
    }
  }

  get canSave() {
    if (this.editMode === EditMode.Segmentation && this.curSegUI) {
      return this.curSegUI.canSave;
    } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
      return this.trackingUI.canSave;
    }

    return false;
  }

  async done() {
    if (this.canSave) {
      if (this.editMode === EditMode.Segmentation && this.curSegUI) {
        this.curSegUI.save();
      } else if (this.editMode === EditMode.Tracking && this.trackingUI) {
        this.trackingUI.save();
      }
    } else {
      const toast = await this.toastController.create({
        message: 'Sorry but I cannot save the current state!',
        duration: 2000
      });
      toast.present();
    }
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

  draw(ctx) {
    this.imageDisplay.clear();

    if (this.editMode === EditMode.Segmentation) {
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
   * Shows ui to delete storage
   */
  async deleteStorage() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Delete Storage',
      cssClass: 'my-custom-class',
      buttons: [{
        text: 'Delete Segmentation (also deletes Tracking)',
        role: 'destructive',
        icon: 'trash',
        handler: () => {
          console.log('Delete Segmentation clicked');

          this.deleteSegmentation();
        }
      }, {
        text: 'Delete Tracking',
        role: 'destructive',
        icon: 'trash',
        handler: () => {
          console.log('Delete tracking clicked');
          this.deleteTracking();
        }
      }, {
        text: 'Delete All',
        role: 'destructive',
        icon: 'trash',
        handler: () => {
          console.log('Delete storage clicked');

          this.deleteCompleteStorage();
        }
      }, {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked');
        }
      }]
    });
    await actionSheet.present();
  }

  /**
   * Deletes the segmentation storage
   */
  async deleteSegmentation() {
    await Storage.remove({key: this.segKey});

    //this.load(this.urls);
  }

  /**
   * Deletes the tracking storage
   */
  async deleteTracking() {
    await Storage.remove({key: this.trackingKey});

    //this.load(this.urls);
  }

  /**
   * Clears complete storage
   */
  async deleteCompleteStorage() {
    await Storage.clear();

    //this.load(this.urls);
  }

}
