import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OmeroDatasetPage } from './omero-dataset.page';

const routes: Routes = [
  {
    path: '',
    component: OmeroDatasetPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OmeroDatasetPageRoutingModule {}
