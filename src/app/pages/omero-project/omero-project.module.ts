import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OmeroProjectPageRoutingModule } from './omero-project-routing.module';

import { OmeroProjectPage } from './omero-project.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OmeroProjectPageRoutingModule
  ],
  declarations: [OmeroProjectPage]
})
export class OmeroProjectPageModule {}
