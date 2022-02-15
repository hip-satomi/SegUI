import { OmeroAPIService } from './../../services/omero-api.service';
import { Component, OnInit } from '@angular/core';
import { catchError, share } from 'rxjs/operators';
import { UserQuestionsService } from 'src/app/services/user-questions.service';
import { throwError } from 'rxjs';
import { ViewWillEnter } from '@ionic/angular';

@Component({
  selector: 'app-omero-dashboard',
  templateUrl: './omero-dashboard.page.html',
  styleUrls: ['./omero-dashboard.page.scss'],
})
export class OmeroDashboardPage implements ViewWillEnter {

  public projects$;

  constructor(public omeroAPI: OmeroAPIService,
              public userService: UserQuestionsService) {
  }

  ionViewWillEnter() {
    // this is called every time the page is visited
    this.projects$ = this.omeroAPI.projects$.pipe(
      share(),
      catchError(err => {
        this.userService.showError(`We have problems accesing omero projects! ${err.message}`);
        return throwError(err);
      })
  );
}

  ngOnInit() {
  }

}
