import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { ImageViewComponent } from './../components/image-view/image-view.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';



@NgModule({
  declarations: [ImageViewComponent, ImageDisplayComponent],
  exports: [ImageViewComponent, ImageDisplayComponent],
  imports: [
    CommonModule
  ]
})
export class SharedComponentsModule { }
