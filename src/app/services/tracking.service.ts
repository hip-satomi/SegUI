import { Injectable } from '@angular/core';
import { Observable, of, ReplaySubject, Subject } from 'rxjs';
import { catchError, delay, switchMap, tap } from 'rxjs/operators';
import { GlobalSegmentationModel } from '../models/segmentation-model';
import { GlobalTrackingOMEROStorageConnector, SimpleTrackingOMEROStorageConnector } from '../models/storage-connectors';
import { SimpleTrackingView } from '../models/tracking/model';
import { OmeroAPIService } from './omero-api.service';

@Injectable({
  providedIn: 'root'
})
export class TrackingService {

  $currentTrackingModel: ReplaySubject<GlobalTrackingOMEROStorageConnector> = new ReplaySubject(1);
  $destroySignal: Subject<void> = new Subject<void>();

  trackingConnector: GlobalTrackingOMEROStorageConnector;

  constructor(private omeroAPI: OmeroAPIService) { }

  loadById(imageId: number, globalSegModel: GlobalSegmentationModel) {
    this.$destroySignal.next();

    this.omeroAPI.getLatestFileJSON(imageId, 'GUITracking.json').pipe(
      catchError((err, caught) => {
        return of(null);
      }),
      switchMap(tracking => {
        if (tracking) {
          return of(GlobalTrackingOMEROStorageConnector.createFromExisting(this.omeroAPI, tracking, imageId, this.$destroySignal));
        } else {
          return of(GlobalTrackingOMEROStorageConnector.createNew(this.omeroAPI, imageId, this.$destroySignal));
        }
      }),
      tap(trCon => {
        this.trackingConnector = trCon;
        this.$currentTrackingModel.next(trCon);
      }),
      // TODO: the delay is dirty!!!!! When not using this.globalSegModel was undefined!!
      //delay(2000),
      tap(trCon => {
        new SimpleTrackingOMEROStorageConnector(this.omeroAPI, imageId, new SimpleTrackingView(trCon.getModel(), globalSegModel));
      })
    ).subscribe();
  }
}
