import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AiConfigPage } from './ai-config.page';

const routes: Routes = [
  {
    path: '',
    component: AiConfigPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AiConfigPageRoutingModule {}
