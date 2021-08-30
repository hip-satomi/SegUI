import { Point } from './../models/geometry';
import { Serializable, JsonProperty, deserialize } from 'typescript-json-serializer';
import { map, tap, mergeMap, switchMap, combineAll, catchError, concatAll, mergeAll } from 'rxjs/operators';
import { DataListResponse, DataResponse } from './omero-auth.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, empty, forkJoin, of, combineLatest, from, Subject, BehaviorSubject, ReplaySubject, EMPTY } from 'rxjs';
import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';
import { assert } from 'console';

/**
 * Rewrite omero api urls into our urls (they get redirected again)
 * @param url 
 * @returns new url
 */
const rewriteOmeroUrl = (url: string): string => {
  const match = url.match('^.*/api/v0/')
  if (match.length == 0) {
    throw new Error("This is not a valid omero url!");
  }
  url = url.replace(match[0], '/omero/api/');
  return url;
};


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

  @JsonProperty({name: 'url:project', onDeserialize: rewriteOmeroUrl})
  url: string;
  @JsonProperty({name: 'url:datasets', onDeserialize: rewriteOmeroUrl})
  urlDatasets: string;
}

@Serializable()
export class Dataset extends Base {
  @JsonProperty({name: 'url:dataset', onDeserialize: rewriteOmeroUrl})
  url: string;
  @JsonProperty({name: 'url:images', onDeserialize: rewriteOmeroUrl})
  urlImages: string;
  @JsonProperty({name: 'url:projects', onDeserialize: rewriteOmeroUrl})
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
export class PageMeta {
  @JsonProperty()
  offset: number;
  @JsonProperty()
  limit: number;
  @JsonProperty()
  maxLimit: number;
  @JsonProperty()
  totalCount: number;
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

export const pointsToString = (points: Array<Point>): string => {
  return points.map(point => point.join(',')).join(' ');
}

export const stringToPoints = (pointList: string): Array<Point> => {
  return pointList.split(' ').map((pointString: string): Point => pointString.split(',').map(parseFloat) as Point);
}

@Serializable()
export class RoIShape {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: '@type'})
  type: string;

  @JsonProperty({name: 'TheT'})
  t: number;

  @JsonProperty({name: 'TheZ'})
  z: number;

  @JsonProperty({name: 'Points', onDeserialize: stringToPoints, onSerialize: pointsToString})
  points: Array<Point>;
}
@Serializable()
export class RoIData {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({type: RoIShape})
  shapes: Array<RoIShape>;
}

@Serializable()
export class RoIResult {
  @JsonProperty({type: RoIData})
  data: Array<RoIData>;

  @JsonProperty()
  meta: PageMeta;
}

export class ShapePolygon {

  constructor(points: Array<Point>, t: number, z: number) {
    this.t = t;
    this.z = z;

    this.points = points;
  }

  t: number
  z: number

  points: Array<Point>;
}

/**
 * Interface for /iviewer/persist_rois/ posts
 */
export interface RoIModData {
  imageId: number;
  rois: {
    count: number,
    deleted: {},
    empty_rois: {},
    modified: {},
    new: {},
    new_and_deleted: {}
  }
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

  /**
   * 
   * @param imageId id of the image sequence
   * @returns parent dataset
   */
  getImageDataset(imageId: number): Observable<Dataset> {
    return this.httpClient.get(`/omero/api/m/images/${imageId}/`).pipe(
      map((r: DataResponse<any>) => deserialize(r.data, Image).datasetUrl),
      switchMap(dsUrl => this.httpClient.get(dsUrl)),
      map((r: DataResponse<any>) => {
        console.log(r);
        return deserialize(r, DatasetResult).data[0];
      })
    );
  };

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
        } else {
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

  genRoIRequest(imageId: number, limit: number, offset: number): Observable<RoIResult> {
    // Begin assigning parameters
    const params = {
      limit: `${limit}`,
      offset: `${offset}`
    };
    
    return this.httpClient.get(`/omero/api/m/images/${imageId}/rois/`, {params}).pipe(
      map(r => deserialize(r, RoIResult))
    );
  }

  getPagedRoIData(imageId: number): Observable<Array<RoIData>> {
    return this.genRoIRequest(imageId, 500, 0).pipe(
      switchMap(result => {

        // extract paging meta data from request
        const limit = result.meta.limit;
        const maxLimit = result.meta.maxLimit;
        const totalCount = result.meta.totalCount;

        const requestList: Array<Observable<RoIResult>> = [];

        if (totalCount > limit) {
          for(let i = 0; i < Math.ceil((totalCount - limit) / maxLimit); i++) {
            requestList.push(this.genRoIRequest(imageId, maxLimit, limit + i * maxLimit));
          }
        }

        return of(of(result), ...requestList).pipe(
          combineAll(),
          map((res: Array<RoIResult>) => {
            // combine all RoIDatas
            return res.map(r => r.data).reduce((a,b) => a.concat(b), [])
          })
        )
        //return result.data;
      }),
      /*map((data: RoIData[]) => {
        // join all rois and shapes into an array of shape polygons
        return data.map(roi => roi.shapes
          .filter(s => s.type == "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon")
          .map(s => new ShapePolygon(s.points, s.t, s.z))).reduce((a,b) => a.concat(b), []);
      }),*/
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

  modifyRois(modificationData: RoIModData) {
    return this.httpClient.post('/omero/iviewer/persist_rois/', modificationData);
  }

  arrayToDict(data: Array<any>) {
    const result_data = {}
    data.forEach(element => {
      result_data[`${element[0]}`] = `${element[0]}:${element[1]}`;
    });

    return result_data;
  }

  deleteRois(imageSetId, roiList, max=1000) {


    const list = []

    for(let i = 0; i < Math.ceil(roiList.length / max); i++) {
      // First we need to collect the ids
      const post_data = {
        imageId: imageSetId,
        rois: {
          count: 0,
          deleted: {},
          empty_rois: this.arrayToDict(roiList.slice(i * max, (i+1) * max)),
          modified: {},
          new: [],
          new_and_deleted: [],
        }
      }
      list.push(post_data);
    }
    if (list.length == 0)  {
      return of(of(1),of(2),of(3)).pipe(
        combineAll()
      );
    }

    return of(...list).pipe(
      map((post_data: RoIModData) => {
        return this.modifyRois(post_data);
      }),
      combineAll()
    );
  }

  createRois(imageSetId, roiList, max=1000) {
    const list = [];

    for(let i = 0; i < Math.ceil(roiList.length / max); i++) {
      // First we need to collect the ids
      const post_data = {
        imageId: imageSetId,
        rois: {
          count: 0,
          deleted: {},
          empty_rois: {},
          modified: {},
          new: roiList.slice(i * max, (i+1) * max),
          new_and_deleted: [],
        }
      }
      list.push(post_data);
    }

    if (list.length == 0)  {
      return of(of(1),of(2),of(3)).pipe(
        combineAll()
      );
    }

    return of(...list).pipe(
      map((post_data: RoIModData) => {
        return this.modifyRois(post_data);
      }),
      combineAll()
    );
  }
}
