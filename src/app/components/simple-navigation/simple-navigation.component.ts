import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Dataset, Project } from 'src/app/services/omero-api.service';

@Component({
  selector: 'app-simple-navigation',
  templateUrl: './simple-navigation.component.html',
  styleUrls: ['./simple-navigation.component.scss'],
})
export class SimpleNavigationComponent implements OnInit {

  @Input() project$: Observable<Project>;
  @Input() dataset$: Observable<Dataset>;

  constructor() { }

  ngOnInit() {}

}
