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
import { MultiSelectToolComponent } from '../components/multi-select-tool/multi-select-tool.component';
import { AnimatedPreviewComponent } from '../components/animated-preview/animated-preview.component';
import { ThumbnailsPipe } from '../pipes/thumbnails.pipe';
import { ColorPickerComponent } from '../components/color-picker/color-picker.component';

import { ColorPickerModule } from 'ngx-color-picker';
import { AnnManagerComponent } from '../components/ann-manager/ann-manager.component';
import { AnnLabelChipComponent } from '../components/ann-label-chip/ann-label-chip.component';
import { FlexibleSegmentationComponent } from '../components/flexible-segmentation/flexible-segmentation.component';

@NgModule({
  declarations: [
    ImageDisplayComponent,
    SegmentationComponent,
    BrushComponent,
    PermissionVizComponent,
    SimpleNavigationComponent,
    MultiSelectToolComponent,
    AnimatedPreviewComponent,
    ThumbnailsPipe,
    ColorPickerComponent,
    AnnManagerComponent,
    AnnLabelChipComponent,
    FlexibleSegmentationComponent
  ],
  exports: [
    ImageDisplayComponent,
    SegmentationComponent,
    BrushComponent,
    PermissionVizComponent,
    SimpleNavigationComponent,
    MultiSelectToolComponent,
    AnimatedPreviewComponent,
    ThumbnailsPipe,
    ColorPickerComponent,
    AnnManagerComponent,
    AnnLabelChipComponent,
    FlexibleSegmentationComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MatTooltipModule,
    RouterModule,
    ColorPickerModule
  ]
})
export class SharedComponentsModule { }
