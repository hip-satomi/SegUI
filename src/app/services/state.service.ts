import { Injectable } from '@angular/core';

export class BrushState {
  brushSize: number = 2;
  simplificationTolerance: number = 0.2;
  showOverlay = true;
  preventOverlap = true;
};

@Injectable({
  providedIn: 'root'
})
export class StateService {

  brushState = new BrushState();

  openTool: string = ""; // no tool open

  constructor() { }
}
