import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AiConfigPageRoutingModule } from './ai-config-routing.module';

import { AiConfigPage } from './ai-config.page';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SharedComponentsModule } from 'src/app/shared-components-module/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AiConfigPageRoutingModule,
    MatTooltipModule,
    SharedComponentsModule
  ],
  declarations: [AiConfigPage]
})
export class AiConfigPageModule {}
