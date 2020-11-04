import { Serializable, JsonProperty, deserialize } from 'typescript-json-serializer';
import { map, tap, mergeMap, switchMap, combineAll } from 'rxjs/operators';
import { DataListResponse, DataResponse } from './omero-auth.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, empty, forkJoin, of, combineLatest, from } from 'rxjs';
import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';
import { assert } from 'console';

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

export interface Permissions {
  canDelete: boolean;
  canAnnotate: boolean;
  canLink: boolean;
  canEdit: boolean;
  canDownload: boolean;
}

export interface File {
  id: string;
  name: string;
  size: number;
  path: string;
  mimetype: string;
}

@Serializable()
export class Annotation {
  @JsonProperty()
  id: number;
  @JsonProperty()
  description: string;

  /*{name: 'date', type: dayjs.Dayjs, onDeserialize: data => {
    return dayjs(data);
  },
  onSerialize: date => {
    return dayjs(date).format('YYYY-MM-DDTHH:mm:ssZ');
  }}*/
  @JsonProperty()
  date: Date;

  @JsonProperty()
  permissions: Permissions;

  @JsonProperty()
  class: string;

  @JsonProperty()
  file: File;
}

@Serializable()
export class AnnotationResult {
  @JsonProperty({type: Annotation})
  annotations: Array<Annotation>;
}

@Serializable()
export class WindowInfo {
  @JsonProperty()
  min: number;
  @JsonProperty()
  max: number;
}

@Serializable()
export class ChannelInfo {
  @JsonProperty()
  window: WindowInfo;
}

@Serializable()
export class RenderInfos {
  @JsonProperty()
  id: number;

  @JsonProperty({type: ChannelInfo})
  channels: Array<ChannelInfo>;
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

  getImage(imageId: number): Observable<Image> {
    return this.httpClient.get(`/omero/api/m/images/${imageId}/`).pipe(
      map((r: DataResponse<any>) => deserialize(r.data, Image))
    );
  }

  getThumbnailUrl(imageId: number) {
    return `/omero/webclient/render_thumbnail/${imageId}/?version=0`;
  }

  /**
   * Generates a url for viewing a specific image
   * @param imageId image set id
   * @param z z channel index
   * @param t t channel index
   * @param min minimum image value
   * @param max maximum image value
   * @param quality jpeg quality parameter
   */
  getImageViewUrl(imageId: number, z: number, t: number, min: number, max: number, quality = 1.0) {
    return `/omero/webgateway/render_image/${imageId}/${z}/${t}/?c=1|${min}:${max}$808080&q=${quality}`;
  }

  /**
   * Downloads the render infos from omero.
   * This is important to move the true image values (e.g. 16 bit) to a viewable spectrum (e.g. 200-800).
   * @param imageId image set id
   */
  getImageRenderInfos(imageId: number) {
    return this.httpClient.get(`/omero/webgateway/imgData/${imageId}/`).pipe(
      map(r => deserialize(r, RenderInfos))
    );
  }

  /**
   * Get the list of rendered image urls for a specific image set
   * 
   * We decide to loop over T and Z channels (if both a present loops over T channel).
   * In addition the image is normalized with the min, max values in the render infos of omero.
   * @param imageSetId image set id
   */
  getImageUrls(imageSetId: number): Observable<string[]> {
    // load the images render image infos
    return this.getImageRenderInfos(imageSetId).pipe(
      // load the image object and add it
      switchMap(renderInfos => {
        return this.getImage(imageSetId).pipe(
          map(im => ({image: im, renderInfos}))
        );
      }),
      // decide whether to loop over T or Z
      map((data: {image: Image, renderInfos: RenderInfos}) => {
        if (data.image.pixels.sizeT > 1) {
          // iterate over t
          const ts = Array.from(Array(data.image.pixels.sizeT).keys());
          return {...data, it: ts.map(idx => ({imageId: data.image.id, z: 0, t: idx}))};
        } else if (data.image.pixels.sizeZ > 1) {
          // iterate over z
          const zs = Array.from(Array(data.image.pixels.sizeZ).keys());
          return {...data, it: zs.map(idx => ({imageId: data.image.id, z: idx, t: 0}))};
        }
      }),
      // generate the final image urls with render info
      map((data: {image: Image, renderInfos: RenderInfos, it: Array<{imageId: number, z: number, t: number}>}) => {
        const min = data.renderInfos.channels[0].window.min;
        const max = data.renderInfos.channels[0].window.max;
        return data.it.map(item => this.getImageViewUrl(item.imageId, item.z, item.t, min, max));
      })
    );
  }

  /**
   * Show all file annotations associated with an image sequence in omero
   * @param imageId image sequence id
   */
  getFileAnnotations(imageId: number) {
    return this.httpClient.get(`/omero/webclient/api/annotations/?type=file&image=${imageId}`).pipe(
      map(r => {
        return deserialize(r, AnnotationResult);
      })
    );
  }

  /**
   * Returns the latest file version associated with an image.
   * 
   * Only works when the file format is json!!!
   * @param imageId image set id
   * @param fileName file name
   */
  getLatestFileJSON(imageId: number, fileName: string) {
    // get all annotations first
    return this.getFileAnnotations(imageId).pipe(
      // filter by name and sort by date
      map(annotResult => {
        return annotResult.annotations.filter(ann => ann.file.name === fileName).sort((a, b) => -(a.date.getTime() - b.date.getTime()));
      }),
      // download file and parse
      switchMap(sortedAnnots => {
        if (sortedAnnots.length > 0) {
          return this.httpClient.get<Blob>(`/omero/webclient/annotation/${sortedAnnots[0].id}/`, {responseType: 'blob' as 'json'}).pipe(
            switchMap(blob => from(blob.text())),
            map(txt => JSON.parse(txt))
          );
        } else {
          return of(null);
        }
      })
    );
  }

  /**
   * Updates the file attachment in the omero backend.
   * 
   * Deletes all possible previous variants of the file (with same name).
   * There should be no data loss as deletion is executed after new file has been posted.
   * @param imageId the associated image id
   * @param fileName the filename
   * @param data the file data (e.g. json)
   */
  updateFile(imageId: number, fileName: string, data) {

    // create new file
    const jsonse = data;
    const blob = new Blob([jsonse], {type: 'application/json'});

    const formData = new FormData();
    formData.set('image', '' + imageId);
    formData.append('annotation_file', blob, fileName);

    // post new file
    return this.httpClient.post(`/omero/webclient/annotate_file/`, formData).pipe(
      // if file is posted successfully get all annotations
      switchMap(() => this.getFileAnnotations(imageId)),
      map(annotations => annotations.annotations),
      // filter by current filename
      map(annotations => annotations.filter(ann => ann.file.name === fileName)),
      // delete all but the latest file version
      mergeMap(
        (annotations: Annotation[]) => {
          let sortedAnnotations = annotations.sort((a, b) => -(a.date.getTime() - b.date.getTime()));
          // do not delete the newest file version
          sortedAnnotations = sortedAnnotations.splice(0, 1);
          const deletions = [];
          for (const ann of annotations) {
            // remove them
            const formData = new FormData();
            formData.set('parent', 'image-' + imageId);
            deletions.push(
              this.httpClient.post(`/omero/webclient/action/remove/file/${ann.id}/`, formData)
            );
          }
          if (deletions.length > 0) {
            return combineLatest(deletions);
          } else {
            return of(null);
          }
        }
      ),
    );
  }
}
