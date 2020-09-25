import { ImageDisplayComponent } from './../components/image-display/image-display.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';



@NgModule({
  declarations: [ImageDisplayComponent],
  exports: [ImageDisplayComponent],
  imports: [
    CommonModule
  ]
})
export class SharedComponentsModule { }
