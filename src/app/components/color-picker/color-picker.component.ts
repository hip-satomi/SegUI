import { Component, Input, OnInit } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-color-picker',
  templateUrl: './color-picker.component.html',
  styleUrls: ['./color-picker.component.scss'],
})
export class ColorPickerComponent implements OnInit {

  @Input() radioValue = 'random';
  @Input() color = '#FF0000'

  constructor(private popoverController: PopoverController) { }

  ngOnInit() {}

  close() {
    this.popoverController.dismiss({color: this.color, radioValue: this.radioValue}, 'ok');
  }

}
