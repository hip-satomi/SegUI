import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ImageSetListPage } from './image-set-list.page';

const routes: Routes = [
  {
    path: '',
    component: ImageSetListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ImageSetListPageRoutingModule {}
