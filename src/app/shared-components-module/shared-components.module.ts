import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PopoverCompComponent } from '../components/popover-comp/popover-comp.component';
import { SegmentationComponent } from '../components/segmentation/segmentation.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';



@NgModule({
  declarations: [ImageDisplayComponent, PopoverCompComponent, SegmentationComponent],
  exports: [ImageDisplayComponent, PopoverCompComponent, SegmentationComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
  ]
})
export class SharedComponentsModule { }
