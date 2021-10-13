import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-ann-label',
  templateUrl: './ann-label.component.html',
  styleUrls: ['./ann-label.component.scss'],
})
export class AnnLabelComponent implements OnInit {

  @Input() name: string;
  @Input() visible: boolean;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() editName = new EventEmitter<string>();

  @ViewChild('nameInput') myInput;

  tempName: string = 'Holy';

  editing = false;

  constructor() { }

  ngOnInit() {}

  toggleVisibility() {
    this.visible = !this.visible;
    this.visibleChange.emit(this.visible);
  }

  toggleEdit() {
    this.editing = !this.editing;
    this.tempName = this.name;

    if (this.editing) {
        this.myInput.setFocus();
    }
  }

  save() {
    console.log('save');

    if (this.tempName != this.name) {
      this.editName.emit(this.tempName);
    }

    this.toggleEdit();
  }
}
