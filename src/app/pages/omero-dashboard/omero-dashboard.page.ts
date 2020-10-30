import { OmeroAPIService } from './../../services/omero-api.service';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-omero-dashboard',
  templateUrl: './omero-dashboard.page.html',
  styleUrls: ['./omero-dashboard.page.scss'],
})
export class OmeroDashboardPage implements OnInit {

  private projects$;

  constructor(private omeroAPI: OmeroAPIService) {
    this.projects$ = omeroAPI.projects$;
  }

  ngOnInit() {
  }

}