import { ImageViewComponent } from './../components/image-view/image-view.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';



@NgModule({
  declarations: [ImageViewComponent],
  exports: [ImageViewComponent],
  imports: [
    CommonModule
  ]
})
export class SharedComponentsModule { }
