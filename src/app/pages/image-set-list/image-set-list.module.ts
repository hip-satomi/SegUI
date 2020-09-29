import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ImageSetListPageRoutingModule } from './image-set-list-routing.module';

import { ImageSetListPage } from './image-set-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ImageSetListPageRoutingModule
  ],
  declarations: [ImageSetListPage]
})
export class ImageSetListPageModule {}
