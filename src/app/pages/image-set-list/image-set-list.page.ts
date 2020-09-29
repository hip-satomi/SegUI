import { map } from 'rxjs/operators';
import { Component, OnInit } from '@angular/core';
import { AlertController, ViewWillEnter } from '@ionic/angular';
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
              private router: Router) { }

  imageSets = [];

  ngOnInit() {
  }

  ionViewWillEnter() {
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
    });
  }

  async showImageSet(imSet) {
    const navigationExtras: NavigationExtras = {
      state: {
        imageSetId: imSet.id,
      }
    };

    this.router.navigate(['segTrack'], navigationExtras);
  }

}
