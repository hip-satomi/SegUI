import { OmeroAPIService } from './../../services/omero-api.service';
import { Component, OnInit } from '@angular/core';
import { share } from 'rxjs/operators';

@Component({
  selector: 'app-omero-dashboard',
  templateUrl: './omero-dashboard.page.html',
  styleUrls: ['./omero-dashboard.page.scss'],
})
export class OmeroDashboardPage implements OnInit {

  public projects$;

  constructor(public omeroAPI: OmeroAPIService) {
    this.projects$ = omeroAPI.projects$.pipe(share());
  }

  ngOnInit() {
  }

}
