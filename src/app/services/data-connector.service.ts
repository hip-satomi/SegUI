import { Injectable } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
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
      obs.push(sc.update());
    }

    return combineLatest(obs)
  }

  /**
   * Removes all data connectors assocated with a backend id
   * @param id backend id (e.g. ImageSetId in OMERO)
   */
  clear(id) {
    this.connectorMap.delete(id);
  }
}
