import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-permission-viz',
  templateUrl: './permission-viz.component.html',
  styleUrls: ['./permission-viz.component.scss'],
})
export class PermissionVizComponent implements OnInit {

  _item: any;
  _user: any;

  data = [];

  @Input() set item(item: any) {
    this._item = item;

    this.updateData();
  }

  @Input() set user(user: any) {
    this._user = user;
    this.updateData();
  }

  constructor() { }

  ngOnInit() {
  }

  updateData() {
    this.data = [
      {
        name: 'canAnnotate',
        color: !this._item.details.permissions.canAnnotate ? 'medium': ''
      },
      {
        name: 'canDelete',
        color: !this._item.details.permissions.canDelete ? 'medium': ''
      },
      {
        name: 'canEdit',
        color: !this._item.details.permissions.canEdit ? 'medium': ''
      },
      {
        name: 'canLink',
        color: !this._item.details.permissions.canLink ? 'medium': ''
      },
      {
        name: 'isGroupWrite',
        color: !this._item.details.permissions.isGroupWrite ? 'medium': ''
      },
    ];

    if (this.user) {
      
    }
  }

}
