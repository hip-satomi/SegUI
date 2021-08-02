import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SegmentationComponent } from '../components/segmentation/segmentation.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BrushComponent } from '../components/brush/brush.component';



@NgModule({
  declarations: [ImageDisplayComponent, SegmentationComponent, BrushComponent],
  exports: [ImageDisplayComponent, SegmentationComponent, BrushComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
  ]
})
export class SharedComponentsModule { }
