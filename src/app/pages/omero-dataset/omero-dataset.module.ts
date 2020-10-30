import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OmeroDatasetPageRoutingModule } from './omero-dataset-routing.module';

import { OmeroDatasetPage } from './omero-dataset.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OmeroDatasetPageRoutingModule
  ],
  declarations: [OmeroDatasetPage]
})
export class OmeroDatasetPageModule {}
