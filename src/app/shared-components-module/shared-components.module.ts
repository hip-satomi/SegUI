import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SegmentationComponent } from '../components/segmentation/segmentation.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BrushComponent } from '../components/brush/brush.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionVizComponent } from '../components/permission-viz/permission-viz.component';
import { SimpleNavigationComponent } from '../components/simple-navigation/simple-navigation.component';
import { RouterModule } from '@angular/router';



@NgModule({
  declarations: [
    ImageDisplayComponent,
    SegmentationComponent,
    BrushComponent,
    PermissionVizComponent,
    SimpleNavigationComponent
  ],
  exports: [
    ImageDisplayComponent,
    SegmentationComponent,
    BrushComponent,
    PermissionVizComponent,
    SimpleNavigationComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MatTooltipModule,
    RouterModule
  ]
})
export class SharedComponentsModule { }
