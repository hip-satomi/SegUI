import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OmeroDashboardPageRoutingModule } from './omero-dashboard-routing.module';

import { OmeroDashboardPage } from './omero-dashboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OmeroDashboardPageRoutingModule
  ],
  declarations: [OmeroDashboardPage]
})
export class OmeroDashboardPageModule {}
