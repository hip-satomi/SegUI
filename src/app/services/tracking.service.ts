import { SimpleSegmentation } from './../models/segmentation-model';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Link {
  sources: Array<string>;
  targets: Array<string>;
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class TrackingService {

  constructor(private httpClient: HttpClient) { }

  /**
   * Sends a simple segmentation list to the tracking server and requests a tracking answer
   * @param simpleSeg simple segmentation
   */
  computeTracking(simpleSeg: Array<SimpleSegmentation>): Observable<Array<Link>>  {
    return this.httpClient.post('/tracking/', simpleSeg).pipe(
      map(r => r as Array<Link>)
    );
  }
}
