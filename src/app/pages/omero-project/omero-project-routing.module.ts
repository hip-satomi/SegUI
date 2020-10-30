import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OmeroProjectPage } from './omero-project.page';

const routes: Routes = [
  {
    path: '',
    component: OmeroProjectPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OmeroProjectPageRoutingModule {}
