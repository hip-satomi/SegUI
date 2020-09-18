import { ImageViewComponent } from './../components/image-view/image-view.component';
import { ToastController } from '@ionic/angular';
import { Component, ViewChild } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  //@ViewChild('imageView') imageView: ImageViewComponent;
  @ViewChildren(ImageViewComponent) components: QueryList<ImageViewComponent>;

  activeView = 0;
  urls = ['../assets/stone-example.jpg', '../assets/stone-example.jpg'];

  constructor(private toastController: ToastController) {}

  async undo() {
    /*const toast = await this.toastController.create({
      message: 'TODO: Undo last segmentation',
      duration: 2000
    });
    toast.present();*/
    this.imageView.undo();
  }

  async redo() {
    this.imageView.redo();
  }

  async done() {
    this.imageView.save();

    /*const toast = await this.toastController.create({
      message: 'TODO: Save segmentation',
      duration: 2000
    });
    toast.present();*/
  }

  get canRedo() {
    if (this.imageView) {
      return this.imageView.actionManager.canRedo;
    }

    return false;
  }

  get canUndo() {
    if (this.imageView) {
      return this.imageView.actionManager.canUndo;
    }
    
    return false;
  }

  get canNextImage() {
    if (this.components) {
      return this.activeView < this.components.length - 1;
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

  get imageView() {
    if (this.components) {
      return this.components.toArray()[this.activeView];
    }
    
    return null;
  }

  setImageIndex(index: number) {
    this.activeView = index;
  }

  onSliderChanged(event) {
    console.log('slider changed');
    console.log(event);
    this.setImageIndex(event.detail.value);
  }

}
