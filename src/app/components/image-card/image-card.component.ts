import { Component, Input, OnInit } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Image, OmeroAPIService } from 'src/app/services/omero-api.service';

@Component({
  selector: 'app-image-card',
  templateUrl: './image-card.component.html',
  styleUrls: ['./image-card.component.scss'],
})
export class ImageCardComponent implements OnInit {

  @Input() image: Image;

  roiCount = -1;

  constructor(public omeroAPI: OmeroAPIService) { }

  ngOnInit() {
    // request the roiCount
    this.omeroAPI.getImageInfo(this.image.id).pipe(
      tap(info => {
        this.roiCount = info.roiCount;
      })
    ).subscribe();
  }

  get numImages() {
    // consider all image planes
    return this.image.pixels.sizeZ * this.image.pixels.sizeT;
  }

}
