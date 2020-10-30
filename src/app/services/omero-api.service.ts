import { Serializable, JsonProperty, deserialize } from 'typescript-json-serializer';
import { map, tap } from 'rxjs/operators';
import { DataListResponse, DataResponse } from './omero-auth.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, empty } from 'rxjs';
import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';

@Serializable()
export class Id {
  @JsonProperty({name: '@id'})
  id: number;
}

@Serializable()
export class Base extends Id {
  @JsonProperty({name: 'Name'})
  name: string;
  @JsonProperty({name: 'Description'})
  description: string;
}

@Serializable()
export class Project extends Base {

  @JsonProperty({name: 'url:project'})
  url: string;
  @JsonProperty({name: 'url:datasets'})
  urlDatasets: string;
}

@Serializable()
export class Dataset extends Base {
  @JsonProperty({name: 'url:dataset'})
  url: string;
  @JsonProperty({name: 'url:images'})
  urlImages: string;
  @JsonProperty({name: 'url:projects'})
  urlProjects: string;
}

@Serializable()
export class PhysicalSize {
  @JsonProperty({name: 'Symbol'})
  symbol: string;
  @JsonProperty({name: 'Value'})
  value: number;
  @JsonProperty({name: '@type'})
  type: string;
  @JsonProperty({name: 'Unit'})
  unit: string;
}

@Serializable()
export class Pixel extends Id {
  @JsonProperty({name: 'SizeX'})
  sizeX: number;
  @JsonProperty({name: 'SizeY'})
  sizeY: number;
  @JsonProperty({name: 'SizeZ'})
  sizeZ: number;
  @JsonProperty({name: 'SizeC'})
  sizeC: number;
  @JsonProperty({name: 'SizeT'})
  sizeT: number;

  @JsonProperty({name: 'physicalSizeX'})
  physicalSizeX: PhysicalSize;
  @JsonProperty({name: 'physicalSizeY'})
  physicalSizeY: PhysicalSize;
  @JsonProperty({name: 'physicalSizeZ'})
  physicalSizeZ: PhysicalSize;

  @JsonProperty({name: 'SignificantBits'})
  significantBits: number;
}

@Serializable()
export class Image {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'Name'})
  name: string;

  //@JsonProperty({onDeserialize: (raw: string) => dayjs.unix(raw), onSerialize: (date: Date) => dayjs})
  //AxcquisitionDate: Date;

  @JsonProperty({name: 'url:image'})
  url: string;

  @JsonProperty({name: 'Pixels'})
  pixels: Pixel;

  @JsonProperty({name: 'omero:series'})
  series: number;
}

@Injectable({
  providedIn: 'root'
})
export class OmeroAPIService {

  projects$: Observable<Project[]>;

  constructor(private httpClient: HttpClient) {

    // pipe to list all omero projects
    this.projects$ = this.httpClient.get('/omero/api/m/projects/').pipe(
      map((r: DataListResponse<any>) => r.data),
      map(rawProjects => {
        return rawProjects.map(p => deserialize(p, Project));
      })
    );
  }

  /**
   * returns the project corresponding to the id
   * @param id project omero id
   */
  getProject(id: number): Observable<Project> {
    return this.httpClient.get(`/omero/api/m/projects/${id}/`).pipe(
      map((r: DataResponse<any>) => deserialize(r.data, Project))
    );
  }

  /**
   * returns all the datasets within the project
   * @param projectId project id
   */
  getDatasetsByProjectId(projectId: number): Observable<Dataset[]> {
    const fullUrl = `/omero/api/m/projects/${projectId}/datasets/`;

    return this.httpClient.get(fullUrl).pipe(
      map((r: DataListResponse<any>) => r.data.map(rawDataset => deserialize(rawDataset, Dataset)))
    );
  }

  getImagesFromDataset(datasetId: number): Observable<Image[]> {
    const params = new HttpParams()
      .set('dataset', '' + datasetId);
    return this.httpClient.get(`/omero/api/m/images/`, {params}).pipe(
      tap(r => console.log(r)),
      map((r: DataListResponse<any>) => r.data.map(rawImage => deserialize(rawImage, Image)))
    );
  }

  getThumbnailUrl(imageId: number) {
    return `/omero/webclient/render_thumbnail/${imageId}/?version=0`;
  }
}
