import { SegmentationHolder, SegmentationModel } from './../models/segmentation-model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StateService {

  imateSetId: number;
  holder: SegmentationHolder;
  models: SegmentationModel[] = [];

  constructor() { }
}
