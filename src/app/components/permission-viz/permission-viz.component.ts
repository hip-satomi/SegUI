import { Component, Input, OnInit } from '@angular/core';
import { TooltipComponent } from '@angular/material/tooltip';

@Component({
  selector: 'app-permission-viz',
  templateUrl: './permission-viz.component.html',
  styleUrls: ['./permission-viz.component.scss'],
})
export class PermissionVizComponent implements OnInit {

  _item: any;

  data = [];

  granted = "This permission is granted!"
  not_granted = "This permission is NOT granted!"

  @Input() set item(item: any) {
    this._item = item;

    this.updateData();
  }

  constructor() { }

  ngOnInit() {
  }

  updateData() {
    this.data = [
      {
        name: 'canAnnotate',
        allowed: this._item.details.permissions.canAnnotate,
        tooltip: 'Permission to add annotations (e.g. segmentation) to the image stack!',
      },
      {
        name: 'canDelete',
        allowed: this._item.details.permissions.canDelete,
        tooltip: 'Permission to delete the image stack and the data belonging to it',
      },
      {
        name: 'canEdit',
        allowed: this._item.details.permissions.canEdit,
        tooltip: 'Permission to edit and modify the image stack!',
      },
      {
        name: 'isGroupWrite',
        allowed: this._item.details.permissions.isGroupWrite,
        tooltip: 'Permission to collaboratively edit dat in an OMERO read-write group. Other users can modify and overwrite the segmentation data.'
      },
    ];
  }

}
