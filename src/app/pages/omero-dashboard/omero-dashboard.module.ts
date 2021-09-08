import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OmeroDashboardPageRoutingModule } from './omero-dashboard-routing.module';

import { OmeroDashboardPage } from './omero-dashboard.page';
import { SharedComponentsModule } from 'src/app/shared-components-module/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OmeroDashboardPageRoutingModule,
    SharedComponentsModule
  ],
  declarations: [OmeroDashboardPage]
})
export class OmeroDashboardPageModule {}
