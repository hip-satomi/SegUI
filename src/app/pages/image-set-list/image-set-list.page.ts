import { map, tap, finalize } from 'rxjs/operators';
import { Component, OnInit } from '@angular/core';
import { AlertController, ViewWillEnter, ToastController, LoadingController } from '@ionic/angular';
import { Image, ImageSet, SegRestService } from 'src/app/services/seg-rest.service';
import { NavigationExtras, Router } from '@angular/router';
import { UserQuestionsService } from 'src/app/services/user-questions.service';

@Component({
  selector: 'app-image-set-list',
  templateUrl: './image-set-list.page.html',
  styleUrls: ['./image-set-list.page.scss'],
})
export class ImageSetListPage implements OnInit, ViewWillEnter {

  constructor(private segService: SegRestService,
              private alertController: AlertController,
              private router: Router,
              private userQuestionService: UserQuestionsService,
              private loadingCtrl: LoadingController) { }

  imageSets = [];

  ngOnInit() {
  }

  ionViewWillEnter() {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Loading data...',
    });

    this.segService.getImageSets().pipe(
      tap(() => loading.then(l => l.present())),
      map((imageSets: ImageSet[]) => {
        return imageSets.map((imageSet: any) => {
          imageSet.url = this.segService.getImageByUrl(imageSet.image_set[0]).pipe(
            map((image: Image): string => this.segService.getImageUrl(image.id))
          );
          return imageSet;
        });
      }),
      finalize(() => loading.then(l => l.dismiss()))
    ).subscribe((imageSets) => {
      this.imageSets = imageSets;
    }, async (err) => {
      console.error(err);
      this.userQuestionService.showError(`Error ${JSON.stringify(err)}`);
    });
  }

  async showImageSet(imSet) {
    const navigationExtras: NavigationExtras = {
      state: {
        imageSetId: imSet.id,
      }
    };

    this.router.navigate(['seg-track'], navigationExtras);
  }

}
