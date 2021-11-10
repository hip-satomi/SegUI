import { Component, Input, OnInit } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Image, ImageInfo, OmeroAPIService } from 'src/app/services/omero-api.service';

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
    this.omeroAPI.getImageInfo(this.image.id).pipe(
      tap(info => {
        this.roiCount = info.roiCount;
      })
    ).subscribe();
  }

}
