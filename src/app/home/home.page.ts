import { ImageViewComponent } from './../components/image-view/image-view.component';
import { ToastController } from '@ionic/angular';
import { Component, ViewChild } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  @ViewChild('imageView') imageView: ImageViewComponent;

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

}
