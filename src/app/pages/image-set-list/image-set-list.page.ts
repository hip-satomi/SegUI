import { StateService } from './../../services/state.service';
import { map } from 'rxjs/operators';
import { Component, OnInit } from '@angular/core';
import { AlertController, ViewWillEnter, ToastController, LoadingController } from '@ionic/angular';
import { Image, ImageSet, SegRestService } from 'src/app/services/seg-rest.service';
import { NavigationExtras, Router } from '@angular/router';

@Component({
  selector: 'app-image-set-list',
  templateUrl: './image-set-list.page.html',
  styleUrls: ['./image-set-list.page.scss'],
})
export class ImageSetListPage implements OnInit, ViewWillEnter {

  constructor(private segService: SegRestService,
              private alertController: AlertController,
              private router: Router,
              private toastController: ToastController,
              private stateService: StateService,
              private loadingCtrl: LoadingController) { }

  imageSets = [];

  ngOnInit() {
  }

  ionViewWillEnter() {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Loading data...',
    }).then(l => {l.present(); return l; });

    this.segService.getImageSets().pipe(
      map((imageSets: ImageSet[]) => {
        return imageSets.map((imageSet: any) => {
          imageSet.url = this.segService.getImageByUrl(imageSet.image_set[0]).pipe(
            map((image: Image): string => this.segService.getImageUrl(image.id))
          );
          return imageSet;
        });
      })
    ).subscribe((imageSets) => {
      this.imageSets = imageSets;
    }, async (err) => {
      console.error(err);
      const toast = await this.toastController.create({
        message: `Error ${JSON.stringify(err)}`,
        duration: 10000
      });
      toast.present();
    },
    () => loading.then(l => l.dismiss()));
  }

  async showImageSet(imSet) {
    const navigationExtras: NavigationExtras = {
      state: {
        imageSetId: imSet.id,
      }
    };

    this.stateService.navImageSetId = imSet.id;

    this.router.navigate(['seg-track'], navigationExtras);
  }

}
