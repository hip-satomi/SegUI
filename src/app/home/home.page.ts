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

  _activeView = 0;
  urls = ['../assets/stone-example.jpg', '../assets/stone-example.jpg'];

  constructor(private toastController: ToastController) {
  }

  onTap(event: any) {
    this.curSegUI.onTap(event);
  }
  onPress(event: any) {
    this.curSegUI.onPress(event);
  }
  onPanStart(event: any) {
    this.curSegUI.onPanStart(event);
  }
  onPan(event: any) {
    this.curSegUI.onPan(event);
  }
  onPanEnd(event: any) {
    this.curSegUI.onPanEnd(event);
  }

  ngOnInit() {
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
              segModel.onModelChange = (segModel: SegmentationModel) => {
                this.segModelChanged(segModel);
              };
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
        segModel.onModelChange = (segModel: SegmentationModel) => {
          this.segModelChanged(segModel);
        };
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
  }

  async undo() {
    /*const toast = await this.toastController.create({
      message: 'TODO: Undo last segmentation',
      duration: 2000
    });
    toast.present();*/
    if (this.curSegModel) {
      this.curSegModel.undo();
    }
  }

  async redo() {
    if (this.curSegModel) {
      this.curSegModel.redo();
    }
  }

  async done() {
    if (this.curSegUI) {
      this.curSegUI.save();
    }
  }

  get canRedo() {
    if (this.curSegModel) {
      return this.curSegModel.actionManager.canRedo;
    }

    return false;
  }

  get canUndo() {
    if (this.curSegModel) {
      return this.curSegModel.actionManager.canUndo;
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

    this.segmentationModels[this.activeView].draw(this.imageDisplay.ctx);
  }

  get ctx() {
    return this.imageDisplay.ctx;
  }

}
