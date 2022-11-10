import { Injectable } from '@angular/core';
import { combineLatest, concat, Observable } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { StorageConnector } from '../models/storage';

@Injectable({
  providedIn: 'root'
})
export class DataConnectorService {

  constructor() { }

  /** connector map associates a list of storage connectors with a unique backend id (e.g. imageSetId in OMERO) */
  connectorMap = new Map<any, Array<StorageConnector<any>>>();

  /**
   * Register new data connectors for a backend id
   * @param id backend id, e.g., imageSetId
   * @param dataConnectors list of data connectors for the id
   */
  register(id, dataConnectors: StorageConnector<any>[]) {
    this.connectorMap.set(id, (this.connectorMap.get(id) || []).concat(...dataConnectors));
  }

  /**
   * Enforce saving of all data connectors
   * @param id of the backend source (e.g. imageSetId in OMERO)
   * @returns observable for the saving process
   */
  save(id): Observable<any> {
    const obs = [];

    // loop over all data connectors and initiate saving
    for(const sc of this.connectorMap.get(id)) {
      if (!sc.backendInSync) {
        // backend is not up-to-date: need to sync manually
        obs.push(sc.update());
      }
    }

    // force sequential storing
    const request$ = combineLatest(
      [concat(...obs).pipe(toArray())]
    );

    return request$;
  }

  /**
   * Removes all data connectors assocated with a backend id
   * @param id backend id (e.g. ImageSetId in OMERO)
   */
  clear(id) {
    this.connectorMap.delete(id);
  }

  /**
   * 
   * @param id if imageSet
   * @returns True if all the data storers are in sync with the backend!
   */
  inSync(id): boolean {
    return this.connectorMap.get(id).map((sc) => sc.backendInSync).reduce((a,b) => a && b, true)
  }
}
