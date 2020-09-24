import { TrackingUI } from './../models/tracking-ui';
import { TrackingModel } from './../models/tracking';
import { TypedJSON, jsonArrayMember, jsonObject } from 'typedjson';
import { UIInteraction } from './../models/drawing';
import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { Drawer } from 'src/app/models/drawing';
import { SegmentationUI } from './../models/segmentation-ui';
import { SegmentationModel } from './../models/segmentation-model';
import { ToastController } from '@ionic/angular';
import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';

import { Plugins } from '@capacitor/core';

const { Storage } = Plugins;

enum EditMode {
  Segmentation = '0',
  Tracking = '1'
}

@jsonObject
class SegmentationHolder {

  @jsonArrayMember(SegmentationModel)
  segmentations: SegmentationModel[];
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit, Drawer, UIInteraction{

  @ViewChild(ImageDisplayComponent) imageDisplay: ImageDisplayComponent;

  segmentationModels: SegmentationModel[] = [];
  segmentationUIs: SegmentationUI[] = [];

  trackingModel: TrackingModel;
  trackingUI: TrackingUI;

  _activeView = 0;
  //urls = ['../assets/stone-example.jpg', '../assets/stone-example.jpg', '../assets/stone-example.jpg', '../assets/stone-example.jpg', '../assets/stone-example.jpg'];

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


  constructor(private toastController: ToastController) {
  }

  onTap(event: any) {
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
    if (this.isSegmentation) {
      this.curSegUI.onMove(event);
    } else if (this.trackingUI) {
      this.trackingUI.onMove(event);
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  async saveKey(event) {
    this.done();
  }


  ngOnInit() {
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

  ngAfterViewInit() {
    this.load();
  }

  async load() {
    let restored = false;

    const serializer = new TypedJSON(SegmentationHolder);

    const jsonString = await Storage.get({key: 'segmentations'});

    if (jsonString) {
      try {
        // try to deserialize the segmentation model
        const locHolder = serializer.parse(jsonString.value);

        if (locHolder) {
            // if it works we will accept this as the new model
            for (const segModel of locHolder.segmentations) {
              segModel.onModelChange.subscribe((segModel: SegmentationModel) => {
                this.segModelChanged(segModel);
              });
              this.segmentationModels.push(segModel);
              this.segmentationUIs.push(new SegmentationUI(segModel, this.imageDisplay.canvasElement));
            }
            restored = true;
        } else {
            // otherwise we notify the user and use the old segmentation model
            const toast = await this.toastController.create({
                message: 'Could not restore local data!',
                duration: 2000
            });
            toast.present();
        }
      } catch(e) {
          // otherwise we notify the user and use the old segmentation model
          const toast = await this.toastController.create({
              message: 'Could not restore local data! Reseting...',
              duration: 2000
          });
          toast.present();
      }
    }

    if (!restored) {
      for (const url of this.urls) {
        const segModel = new SegmentationModel(url);
        segModel.onModelChange.subscribe((segModel: SegmentationModel) => {
          this.segModelChanged(segModel);
        });
        this.segmentationUIs.push(new SegmentationUI(segModel, this.imageDisplay.canvasElement));
        this.segmentationModels.push(segModel);
      }
      // otherwise we notify the user and use the old segmentation model
      const toast = await this.toastController.create({
        message: 'Created new segmentation',
        duration: 2000
      });
      toast.present();
    }

    this.trackingModel = new TrackingModel();
    this.trackingUI = new TrackingUI(this.segmentationModels, this.trackingModel, this.imageDisplay.canvasElement, this.toastController);
    this.trackingUI.canvasElement = this.imageDisplay.canvasElement;
    this.trackingUI.ctx = this.imageDisplay.ctx;
    this.trackingUI.toastController = this.toastController;
    this.trackingUI.currentFrame = this.activeView;
    this.trackingModel.onModelChanged.subscribe((trackingModel: TrackingModel) => {
      this.draw(this.ctx);
    });
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

    this.trackingUI.currentFrame = this.activeView;

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

  segModelChanged(segModel: SegmentationModel) {
    this.draw(this.ctx);

    const holder = new SegmentationHolder();
    holder.segmentations = this.segmentationModels;

    const serializer = new TypedJSON(SegmentationHolder);

    Storage.set({
      key: 'segmentations',
      value: serializer.stringify(holder)
    });
  }

  draw(ctx) {
    this.imageDisplay.clear();

    if (this.editMode === EditMode.Segmentation) {
      // draw the segmentation stuff
      this.segmentationUIs[this.activeView].draw(ctx);
    } else {
      this.trackingUI.draw(ctx);
    }
  }

  get ctx() {
    return this.imageDisplay.ctx;
  }

}
