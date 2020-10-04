import { TrackingModel } from './../models/tracking';
import { SegmentationHolder, SegmentationModel } from './../models/segmentation-model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StateService {

  navImageSetId: number;

  imageSetId: number;
  holder: SegmentationHolder;
  tracking: TrackingModel;

  constructor() { }
}
