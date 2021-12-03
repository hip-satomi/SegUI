import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ActionSheetController, IonChip, IonInput, PopoverController } from '@ionic/angular';
import { ColorPickerComponent } from '../color-picker/color-picker.component';

@Component({
  selector: 'app-ann-label-chip',
  templateUrl: './ann-label-chip.component.html',
  styleUrls: ['./ann-label-chip.component.scss'],
})
export class AnnLabelChipComponent implements OnInit {

  _name: string;
  tempName: string;
  _color: string;
  @Input() set color(color: string) {
    this._color = color;
  }
  get color() {
    return this._color;
  }
  @Output() colorLabelChange = new EventEmitter<string>();
  @Input() set name(name: string) {
    this._name = name;
    this.tempName = name;
  }
  get name() {
    return this._name;
  }
  @Output() nameChange = new EventEmitter<string>();
  @Input() active: boolean = false;
  @Output() activeChange = new EventEmitter<boolean>();
  @ViewChild('nameInput', {static: false}) nameInput: IonInput;
  @ViewChild('chip', {static: false}) chip: IonChip;

  edit: boolean = false;
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() deleteLabel = new EventEmitter<void>();

  constructor(private actionSheetController: ActionSheetController,
    private popoverController: PopoverController) { }

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
      }, 100);
    } else {
      this.tempName = this.name;
    }
  }

  submitName(event) {
    event.stopPropagation();

    this.nameChange.emit(this.tempName);

    this.toggleEdit();
  }

  async showMenu() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Annotation Label',
      cssClass: 'my-custom-class',
      buttons: [{
        text: 'Delete',
        role: 'delete',
        icon: 'trash',
        handler: () => {
          console.log('Delete clicked');
        }
      }, {
        text: 'EditName',
        icon: 'create-outline',
        role: 'rename',
        handler: () => {
          console.log('Share clicked');
        }
      }, {
        text: 'Change Color',
        icon: 'color-palette-outline',
        role: 'color',
        handler: () => {
          console.log('Play clicked');
        }
      }, {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked');
        }
      }]
    });
    await actionSheet.present();

    const { role } = await actionSheet.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);

    switch(role) {
      case 'delete':
        this.deleteLabel.emit();
        break;
      case 'rename':
        this.toggleEdit();
        break;
      case 'color':
        const color = await this.presentPopover();

        if (color) {
          this.colorLabelChange.emit(color);
        }
        break;
      default:
        break;
    }
  }

  async presentPopover() {
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
      translucent: true,
      //showBackdrop: false,
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
        return mode;
      } else {
        return color;
      }
      
    }

    return null;
  }

}
