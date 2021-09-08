import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SegmentationComponent } from '../components/segmentation/segmentation.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BrushComponent } from '../components/brush/brush.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionVizComponent } from '../components/permission-viz/permission-viz.component';



@NgModule({
  declarations: [ImageDisplayComponent, SegmentationComponent, BrushComponent, PermissionVizComponent],
  exports: [ImageDisplayComponent, SegmentationComponent, BrushComponent, PermissionVizComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MatTooltipModule,
  ]
})
export class SharedComponentsModule { }
