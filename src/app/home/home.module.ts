import { SharedComponentsModule } from './../shared-components-module/shared-components.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';

import { HomePageRoutingModule } from './home-routing.module';

import {OverlayModule} from '@angular/cdk/overlay';
import { MovableDirective } from '../directives/moveable';
import { DraggableDirective } from '../directives/draggable';
import { DraggableHelperDirective } from '../directives/draggable-helper';
import { MovableAreaDirective } from '../directives/moveable-area';
import {MatTooltipModule} from '@angular/material/tooltip';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    SharedComponentsModule,
    OverlayModule,
    MatTooltipModule,
  ],
  declarations: [HomePage,
    DraggableDirective,
    DraggableHelperDirective,
    MovableDirective,
    MovableAreaDirective
],
})
export class HomePageModule {}
