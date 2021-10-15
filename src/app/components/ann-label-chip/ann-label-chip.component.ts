import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { IonInput } from '@ionic/angular';

@Component({
  selector: 'app-ann-label-chip',
  templateUrl: './ann-label-chip.component.html',
  styleUrls: ['./ann-label-chip.component.scss'],
})
export class AnnLabelChipComponent implements OnInit {

  @Input() name: string;
  @Output() nameChange = new EventEmitter<string>();
  @Input() active: boolean = false;
  @Output() activeChange = new EventEmitter<boolean>();
  @ViewChild('nameInput', {static: false}) nameInput: IonInput;

  edit: boolean = false;
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  constructor() { }

  ngOnInit() {}

  toggleActivity() {
    // ignore clicks during editing
    console.log('Edit');
    if(!this.edit) {
      this.activeChange.emit(!this.active);
    }
  }

  toggleVisibility(event) {
    console.log('Visibility');
    this.visibleChange.emit(!this.visible);

    event.stopPropagation();
  }

  toggleEdit() {
    this.edit = !this.edit;

    if (this.edit) {
      setTimeout(() => {
        this.nameInput.setFocus();
      }, 1000);
    }
  }

  submitName(event) {
    event.stopPropagation();

    this.toggleEdit();

    this.nameChange.emit(this.name);
  }

}
