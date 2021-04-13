import { switchMap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { OmeroAPIService, Image } from './../../services/omero-api.service';
import { Observable } from 'rxjs';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-omero-dataset',
  templateUrl: './omero-dataset.page.html',
  styleUrls: ['./omero-dataset.page.scss'],
})
export class OmeroDatasetPage implements OnInit {

  constructor(private route: ActivatedRoute,
              public omeroApi: OmeroAPIService) { }

  images$: Observable<Image[]>;

  ngOnInit() {
    this.images$ = this.route.paramMap.pipe(
      switchMap(params => {
        const datasetId = Number(params.get('dataset'));
        return this.omeroApi.getImagesFromDataset(datasetId);
      })
    );
  }

  stringify(object: any) {
    return JSON.stringify(object);
  }
}
