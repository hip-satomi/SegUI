import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OmeroDashboardPage } from './omero-dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: OmeroDashboardPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OmeroDashboardPageRoutingModule {}
