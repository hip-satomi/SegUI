/** Service to request segmentations from seg-serve via http */

import { map, take, tap } from 'rxjs/operators';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { HttpParameterCodec } from '@angular/common/http';import { Point } from '../models/geometry';
import { Observable, ReplaySubject } from 'rxjs';
import { deserialize, JsonProperty, Serializable } from 'typescript-json-serializer';

/**
 * Config for a segementation service call via seg serve.
 */
@Serializable()
export class SegmentationServiceDef {
  /** name of the segmentation method as displayed to the user */
  @JsonProperty()
  name: string;

  /** description of the segmentation method displayed to the user */
  @JsonProperty()
  description: string;

  /** git repository url where to find the code */
  @JsonProperty()
  repo_url: string;

  /** entrypoint of the git repo. */
  @JsonProperty()
  repo_entry_point: string;

  /** Repo version/branch */
  @JsonProperty()
  repo_version: string;

  /** additional parameters specified by the approach */
  @JsonProperty()
  additional_parameters: { [name: string]: string }
}

/** All services */
@Serializable()
class SegServiceStore {
  @JsonProperty({type: SegmentationServiceDef})
  services: Array<SegmentationServiceDef>;
}

/** A single detection in an automated segmentation */
export interface SegmentationData {
  /** label of the detection */
  label: string;
  /** list of countour coordinates */
  contour_coordinates: Point[];
  /** type of the detection (e.g. polygon) */
  type: string;
  /** score (e.g. when using method with confidence) */
  score: number;
}

/** Result of a service call to seg serve */
export interface ServiceResult {
  /** name of the used model */
  model: string;
  /** version of the return format */
  format_version: string;
  /** segmentation data */
  segmentation_data: Array<Array<SegmentationData>>;
}

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
    // load the default services from assets json file
    this.httpClient.get('assets/segmentation-services.json').pipe(
      map(res => {
        return deserialize(res, SegServiceStore).services;
      }),
      tap(services => {
        this.services$.next(services);
      })
    ).subscribe();
  }

  /**
   * Request a segmentation proposal from SegServe
   * @param imageBlob the image blob
   * @param service_description the service definition containing git url, version, entrypoint, ...
   * @returns a service result from the HTTP response
   */
  public requestSegmentationProposal(imageBlob, service_description: SegmentationServiceDef): Observable<ServiceResult> {
    // put the binary image data into form data
    const fd = new FormData();
    fd.append('files', imageBlob, 'image.jpg');

    let params = new HttpParams({encoder: new CustomHttpParamEncoder()});
    params = params.set('repo', service_description.repo_url)
    params = params.set('entry_point', service_description.repo_entry_point)
    params = params.set('version', service_description.repo_version)
    params = params.set('parameters', JSON.stringify(service_description.additional_parameters))

    // post this to a segmentation service
    return this.httpClient.post('segService/batch-image-prediction/', fd, {params: params}).pipe(
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
