import { OmeroAPIService, Project } from './../../services/omero-api.service';
import { Component } from '@angular/core';
import { catchError, share } from 'rxjs/operators';
import { UserQuestionsService } from 'src/app/services/user-questions.service';
import { Observable, throwError } from 'rxjs';
import { ViewWillEnter } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-omero-dashboard',
  templateUrl: './omero-dashboard.page.html',
  styleUrls: ['./omero-dashboard.page.scss'],
})
export class OmeroDashboardPage implements ViewWillEnter {

  /** observable for all projects to visualize */
  public projects$: Observable<Array<Project>>;
  /** group restriction */
  public group = '';

  constructor(public omeroAPI: OmeroAPIService,
              public userService: UserQuestionsService,
              private route: ActivatedRoute) {
  }

  /**
   * Before entering the dashboard we will update the data
   */
  ionViewWillEnter() {
    // this is called every time the page is visited
    this.route.queryParams.subscribe(
      params => {
        // extract group parameter if availalbe
        this.group = params['group'] || '';

        // depending on group parater select projects
        let projectAdapter: Observable<Array<Project>>;
        if (this.group !== '') {
          projectAdapter = this.omeroAPI.getPagedData('/omero/api/m/projects/', Project, 100, {group: this.group});
        } else {
          projectAdapter = this.omeroAPI.getPagedData('/omero/api/m/projects/', Project);
        }

        // handle errors in general and set the pipe
        this.projects$ = projectAdapter.pipe(
          share(),
          catchError(err => {
            this.userService.showError(`We have problems accesing omero projects! ${err.message}`);
            return throwError(err);
          }));
      }
    );
  }

  /**
   * Returns True when in restricted group view.
   */
  get groupRestricted() {
    return this.group !== '';
  }

}
