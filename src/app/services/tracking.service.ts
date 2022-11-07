import { Injectable } from '@angular/core';
import { Observable, of, ReplaySubject, Subject } from 'rxjs';
import { catchError, delay, map, switchMap, tap } from 'rxjs/operators';
import { GlobalSegmentationModel } from '../models/segmentation-model';
import { GlobalTrackingOMEROStorageConnector, SimpleTrackingOMEROStorageConnector } from '../models/storage-connectors';
import { SimpleTrackingView } from '../models/tracking/model';
import { DataConnectorService } from './data-connector.service';
import { OmeroAPIService } from './omero-api.service';

@Injectable({
  providedIn: 'root'
})
export class TrackingService {

  $currentTrackingModel: ReplaySubject<GlobalTrackingOMEROStorageConnector> = new ReplaySubject(1);
  $destroySignal: Subject<void> = new Subject<void>();

  trackingConnector: GlobalTrackingOMEROStorageConnector;

  selectedNodes = [];
  selectedEdges = [];

  constructor(private omeroAPI: OmeroAPIService,
    private dataConnectorService: DataConnectorService) { }

  loadById(imageId: number, globalSegModel: GlobalSegmentationModel) {
    this.$destroySignal.next();

    this.selectedEdges = [];
    this.selectedNodes = [];

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
      tap((trCon: GlobalTrackingOMEROStorageConnector) => {
        this.trackingConnector = trCon;
        this.$currentTrackingModel.next(trCon);
      }),
      map(trCon => {
        return [trCon, new SimpleTrackingOMEROStorageConnector(this.omeroAPI, imageId, new SimpleTrackingView(trCon.getModel(), globalSegModel))];
      }),
      tap((connectors) => {
        // register tracking connectors
        this.dataConnectorService.register(imageId, connectors);
      }),
    ).subscribe();
  }
}
