import { map, share, switchMap, switchMapTo, tap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { OmeroAPIService, Image, Dataset, Project } from './../../services/omero-api.service';
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
  dataset$: Observable<Dataset>;
  project$: Observable<Project>;

  ngOnInit() {
    this.images$ = this.route.paramMap.pipe(
      switchMap(params => {
        const datasetId = Number(params.get('dataset'));
        return this.omeroApi.getImagesFromDataset(datasetId);
      }),
      share()
    );

    this.dataset$ = this.route.paramMap.pipe(
      switchMap(params => {
        const datasetId = Number(params.get('dataset'));
        return this.omeroApi.getDataset(datasetId);
      }),
      share()
    );

    this.project$ = this.route.paramMap.pipe(
      switchMapTo(this.dataset$),
      switchMap(dataset => {
        return this.omeroApi.getDatasetProjects(dataset);
      }),
      map((projects: Project[]) => projects[0]),
      tap((p) => console.log('Project name:' + p.name)),
      share()
    );
  }

  stringify(object: any) {
    return JSON.stringify(object);
  }
}
