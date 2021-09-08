import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OmeroDatasetPageRoutingModule } from './omero-dataset-routing.module';

import { OmeroDatasetPage } from './omero-dataset.page';
import { SharedComponentsModule } from 'src/app/shared-components-module/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OmeroDatasetPageRoutingModule,
    SharedComponentsModule
  ],
  declarations: [OmeroDatasetPage]
})
export class OmeroDatasetPageModule {}
