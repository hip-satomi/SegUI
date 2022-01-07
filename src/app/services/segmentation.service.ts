import { map, take, tap } from 'rxjs/operators';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

/**
 * Contour REST structure
 */
export interface Contour {
  x: Array<number>;
  y: Array<number>;
}

/**
 * Detection REST structure
 */
export interface Detection {
  label: string;
  bbox: [number, number, number, number];
  contours: Array<Contour>;
  score: number;
}

@Serializable()
export class SegmentationServiceDef {
  @JsonProperty()
  name: string;
  @JsonProperty()
  description: string;
  @JsonProperty()
  repo_url: string;
  @JsonProperty()
  repo_entry_point: string;
  @JsonProperty()
  repo_version: string;
  @JsonProperty()
  additional_parameters: { [name: string]: string }
}

@Serializable()
class SegServiceStore {
  @JsonProperty({type: SegmentationServiceDef})
  services: Array<SegmentationServiceDef>;
}

export interface SegmentationData {
  label: string;
  contour_coordinates: Point[];
  type: string;
  score: number;
}
export interface ServiceResult {
  model_version: string;
  format_version: string;
  segmentation: Array<SegmentationData>
}

import { HttpParameterCodec } from '@angular/common/http';import { Point } from '../models/geometry';
import { Observable, ReplaySubject } from 'rxjs';
import { deserialize, JsonProperty, Serializable } from 'typescript-json-serializer';
export class CustomHttpParamEncoder implements HttpParameterCodec {  encodeKey(key: string): string {
  return encodeURIComponent(key);
}  encodeValue(value: string): string {
  return encodeURIComponent(value);
}  decodeKey(key: string): string {
  return decodeURIComponent(key);
}  decodeValue(value: string): string {
  return decodeURIComponent(value);
}}

@Injectable({
  providedIn: 'root'
})
export class SegmentationService {

  services$ = new ReplaySubject<Array<SegmentationServiceDef>>(1);

  constructor(private httpClient: HttpClient) {
    this.httpClient.get('assets/segmentation-services.json').pipe(
      map(res => {
        return deserialize(res, SegServiceStore).services;
      }),
      tap(services => {
        this.services$.next(services);
      })
    ).subscribe();
  }

  public requestCSSegmentationProposal(imageBlob) {
    // put the binary image data into form data
    const fd = new FormData();
    fd.append('data', imageBlob);

    // post this to a segmentation service
    return this.httpClient.post('/tf/predictions/cellcmaskrcnn/', fd).pipe(
      map(data => data as Array<Detection>)
    );
  }

  public requestJSSegmentationProposal(imageBlob, score_thr = 0.4) {
    // put the binary image data into form data
    const fd = new FormData();
    fd.append('data', imageBlob);
    fd.append('test_cfg.rcnn.score_thr', `${score_thr}`)

    // post this to a segmentation service
    return this.httpClient.post('/pt/predictions/htc/', fd).pipe(
      map(data => data as Array<Detection>)
    );
  }

  public requestSegmentationProposal(imageBlob, service_description: SegmentationServiceDef) {
    // put the binary image data into form data
    const fd = new FormData();
    fd.append('file', imageBlob, 'image.jpg');
    /*const params = {
      repo: service_description.repo_url,
      entry_point: service_description.repo_entry_point,
      version: service_description.repo_version,
      parameters: JSON.stringify(service_description.additional_parameters)
    }*/

    let params = new HttpParams({encoder: new CustomHttpParamEncoder()});
    params = params.set('repo', service_description.repo_url)
    params = params.set('entry_point', service_description.repo_entry_point)
    params = params.set('version', service_description.repo_version)
    params = params.set('parameters', JSON.stringify(service_description.additional_parameters))

    //UrlP
    //fd.append('repo', service_description.repo_url)
    //fd.append('entry_point', service_description.repo_entry_point)
    //fd.append('version', service_description.repo_version)
    //fd.append('parameters', JSON.stringify(service_description.additional_parameters))

    // post this to a segmentation service
    return this.httpClient.post('segService/image-prediction/', fd, {params: params}).pipe(
      take(1),
      map(data => {
        return data as ServiceResult
      })
    );
  }

  public getSegmentationServices(): Observable<Array<SegmentationServiceDef>> {
    return this.services$;
  }

}
