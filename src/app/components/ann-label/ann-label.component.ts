import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { IonInput, PopoverController } from '@ionic/angular';
import { ColorPickerComponent } from '../color-picker/color-picker.component';

@Component({
  selector: 'app-ann-label',
  templateUrl: './ann-label.component.html',
  styleUrls: ['./ann-label.component.scss'],
})
export class AnnLabelComponent implements OnInit {

  _name: string;
  @Input() visible: boolean;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() nameChange = new EventEmitter<string>();
  @Input() color: string;
  @Output() colorChange = new EventEmitter<string>();

  @Input() active = true;
  @Output() activeChange = new EventEmitter<boolean>();

  @ViewChild('nameInput', { static: false }) myInput: IonInput;

  tempName: string = 'Holy';

  @Input() set name(name: string) {
    this._name = name;
    this.tempName = name;
  }

  get name() {
    return this._name;
  }

  constructor(private popoverController: PopoverController) { }

  ngOnInit() {
    this.tempName = this.name;
  }

  toggleVisibility() {
    this.visible = !this.visible;
    this.visibleChange.emit(this.visible);
  }

  toggleActivity() {
    this.active = !this.active;
    this.activeChange.emit(this.active);
  }


  save() {
    console.log('save');

    const newName = this.tempName;

    if (this.tempName != this.name) {
      // undo the change (as it may need confirmation by the user)
      this.tempName = this.name
      this.nameChange.emit(newName);
    }

    this.myInput.getInputElement().then(
      inputElement => inputElement.blur()
    );
  }

  async presentPopover(ev: any) {
    let mode, color;

    if (this.color == 'random') {
      mode = 'random';
      color = '#FF0000';
    } else {
      mode = 'custom';
      color = this.color;
    }

    // construct popover
    const popover = await this.popoverController.create({
      component: ColorPickerComponent,
      event: ev,
      translucent: true,
      showBackdrop: false,
      // pass mode and color
      componentProps: {radioValue: mode, color}
    });
    await popover.present();

    // await the results
    const { data, role } = await popover.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);
    console.log('Data', data);

    // notify the result
    if (role == 'ok') {
      mode = data['radioValue'];
      color = data['color'];

      if (mode == 'random') {
        this.colorChange.emit(mode);
      } else {
        this.colorChange.emit(color);
      }
      
    }
  }

  clicked() {
    console.log('Clicked');
  }
}
