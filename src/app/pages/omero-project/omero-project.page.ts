import { OmeroAPIService, Project, Dataset } from './../../services/omero-api.service';
import { switchMap, map } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ViewWillEnter } from '@ionic/angular';

@Component({
  selector: 'app-omero-project',
  templateUrl: './omero-project.page.html',
  styleUrls: ['./omero-project.page.scss'],
})
export class OmeroProjectPage implements ViewWillEnter {

  constructor(private route: ActivatedRoute,
              private omeroAPI: OmeroAPIService) { }

  projectId$: Observable<number>;
  project$: Observable<Project>;

  datasets$: Observable<Array<Dataset>>;

  ionViewWillEnter() {
    this.projectId$ = this.route.paramMap.pipe(
      map(params => Number(params.get('id')))
    );

    this.project$ = this.projectId$.pipe(
      switchMap(id => this.omeroAPI.getProject(id))
    );

    this.datasets$ = this.project$.pipe(
      switchMap((project: Project) => this.omeroAPI.getDatasetsByProjectId(project.id))
    );
  }

}
