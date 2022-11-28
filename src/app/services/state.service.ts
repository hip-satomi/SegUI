/** Stores persistent state information across pages */

import { Injectable } from '@angular/core';

export class BrushState {
  brushSize: number = 2;
  simplificationTolerance: number = 0.2;
  showOverlay = true;
  overlapMode = "prevent";
};

@Injectable({
  providedIn: 'root'
})
export class StateService {

  /** store the brush state */
  brushState = new BrushState();

  /** store open tool to reopen when page changed */
  openTool: string = ""; // no tool open

  constructor() { }
}
