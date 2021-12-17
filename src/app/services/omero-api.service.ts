import { Point } from './../models/geometry';
import { Serializable, JsonProperty, deserialize } from 'typescript-json-serializer';
import { map, tap, mergeMap, switchMap, combineAll, catchError, concatAll, mergeAll } from 'rxjs/operators';
import { DataListResponse, DataResponse } from './omero-auth.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, empty, forkJoin, of, combineLatest, from, Subject, BehaviorSubject, ReplaySubject, EMPTY } from 'rxjs';
import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';
import { UserQuestionsService } from './user-questions.service';
import { SegCollData } from '../models/segmentation-model';
import { OmeroUtils } from '../models/utils';

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
export class Type {
  @JsonProperty({name: '@type'})
  type: string;
}

@Serializable()
export class Permissions extends Type {
  @JsonProperty()
  perm: string;

  @JsonProperty()
  canAnnotate: boolean;

  @JsonProperty()
  canDelete: boolean;

  @JsonProperty()
  canEdit: boolean;

  @JsonProperty()
  canLink: boolean;

  @JsonProperty()
  isWorldWrite: boolean;

  @JsonProperty()
  isWorldRead: boolean;

  @JsonProperty()
  isGroupWrite: boolean;

  @JsonProperty()
  isGroupRead: boolean;

  @JsonProperty()
  isGroupAnnotate: boolean;

  @JsonProperty()
  isUserWrite: boolean;

  @JsonProperty()
  isUserRead: boolean;
}

@Serializable()
export class PermissionDetails extends Type {
  @JsonProperty()
  permissions: Permissions;
}

export class Owner extends Type {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'omero:details'})
  details: PermissionDetails;

  @JsonProperty({name: 'FirstName'})
  firstName: string;
  @JsonProperty({name: 'LastName'})
  lastName: string;
  @JsonProperty({name: 'UserName'})
  userName: string;
}

export class Group extends Type {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'omero:details'})
  details: PermissionDetails;

  @JsonProperty({name: 'Name'})
  name: string
}

@Serializable()
export class Details {
  @JsonProperty()
  owner: Owner;

  @JsonProperty()
  group: Group;

  @JsonProperty()
  permissions: Permissions;
}

@Serializable()
export class Id {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'omero:details'})
  details: Details;
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
  @JsonProperty({name: 'omero:details'})
  details: Details;

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
export class DatasetResult {
  @JsonProperty({type: Dataset})
  data: Array<Dataset>;

  @JsonProperty()
  meta: PageMeta;
}

@Serializable()
export class PagedResponse<T> {

  @JsonProperty()
  data: Array<T>;

  @JsonProperty()
  meta: PageMeta;
}


@Serializable()
export class Image {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'Name'})
  name: string;

  @JsonProperty({name: 'omero:details'})
  details: Details;

  //@JsonProperty({onDeserialize: (raw: string) => dayjs.unix(raw), onSerialize: (date: Date) => dayjs})
  //AxcquisitionDate: Date;

  @JsonProperty({name: 'url:image', onDeserialize: rewriteOmeroUrl})
  url: string;

  @JsonProperty({name: 'Pixels'})
  pixels: Pixel;

  @JsonProperty({name: 'omero:series'})
  series: number;

  @JsonProperty({name: 'url:datasets', onDeserialize: rewriteOmeroUrl})
  datasetUrl: string;

  @JsonProperty({name: 'url:rois', onDeserialize: rewriteOmeroUrl})
  roisUrl: string;
}

@Serializable()
export class ImageInfo {
  // There are more properties but not yet implemented

  @JsonProperty({name: 'roi_count'})
  roiCount: number;
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

  @JsonProperty()
  start: number;
  @JsonProperty()
  end: number;
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

/**
 * Convert omero point list (string) into a valid floating point array
 * @param pointList omero point list as string
 * @returns Array of [x,y] points
 */
export const stringToPoints = (pointList: string): Array<Point> => {
  // extract coordinate pairs (e.g. '29.0,1.25e-15')
  const strCoordinates = pointList.match(/-?\d+(\.\d*(e-?\d+)?)?,-?\d+(\.\d*(e-?\d+)?)?/g);

  const points: Point[] = [];

  // loop over coordinate pairs
  for(const coord of strCoordinates) {
    // extract x and y coordinates
    const m = /(?<x>-?\d+(\.\d*(e-?\d+)?)?),(?<y>-?\d+(\.\d*(e-?\d+)?)?)/g.exec(coord);

    // check whether regex matching worked
    if (m != null && ('x' in m.groups && 'y' in m.groups)) {  
      // valid coordinate position
      const x = parseFloat(m.groups['x']);
      const y = parseFloat(m.groups['y']);

      points.push([x, y]);
    } else {
      // report when matching did not work
      console.error(`Error parsing coordinates from point: "${coord}"`);
    }

  }

  return points;
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

  @JsonProperty({name: 'Text'})
  text: string;

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

  constructor(private httpClient: HttpClient,
      public userQuestionService: UserQuestionsService) {

    // pipe to list all omero projects
    this.projects$ = this.getPagedData('/omero/api/m/projects/', Project);
  }

  /**
   * returns the project corresponding to the id
   * @param id project omero id
   */
  getProject(id: number): Observable<Project> {
    return this.getData(`/omero/api/m/projects/${id}/`, Project);
    /*return this.httpClient.get(`/omero/api/m/projects/${id}/`).pipe(
      map((r: DataResponse<any>) => deserialize(r.data, Project))
    );*/
  }

  getProjectByUrl(url: string): Observable<Project> {
    return this.getData(url, Project);
    /*return this.httpClient.get(url).pipe(
      map((r: DataResponse<any>) => deserialize(r.data, Project))
    );*/
  }

  getDatasetProjects(dataset: Dataset): Observable<Array<Project>> {
    return this.getPagedData(dataset.urlProjects, Project);
    /*return this.httpClient.get(dataset.urlProjects).pipe(
      map((r: DataListResponse<any>) => r.data),
      map(rawProjects => {
        return rawProjects.map(p => deserialize(p, Project));
      })
    );*/
  }

  /**
   * returns all the datasets within the project
   * @param projectId project id
   */
  getDatasetsByProjectId(projectId: number): Observable<Dataset[]> {
    const fullUrl = `/omero/api/m/projects/${projectId}/datasets/`;

    return this.getPagedData(fullUrl, Dataset);

    /*return this.httpClient.get(fullUrl).pipe(
      map((r: DataListResponse<any>) => r.data.map(rawDataset => deserialize(rawDataset, Dataset)))
    );*/
  }

  getImagesFromDataset(datasetId: number): Observable<Image[]> {
    return this.getPagedData(`/omero/api/m/images/`, Image, 500, {dataset : '' + datasetId});
  }

  getImage(imageId: number): Observable<Image> {
    return this.getData(`/omero/api/m/images/${imageId}/`, Image);
    /*return this.httpClient.get(`/omero/api/m/images/${imageId}/`).pipe(
      map((r: DataResponse<any>) => deserialize(r.data, Image))
    );*/
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

  getDataset(datasetId: number): Observable<Dataset> {
    return this.getData(`/omero/api/m/datasets/${datasetId}/`, Dataset);
    /*return this.httpClient.get(`/omero/api/m/datasets/${datasetId}/`).pipe(
      map((r: DataResponse<any>) => {
        console.log(r);
        return deserialize(r.data, Dataset);
      })
    );*/
  }

  getDatasetThumbnailUrls(datasetId: number): Observable<string[]> {
    return this.getImagesFromDataset(datasetId)
      .pipe(
        tap(() => console.log('get dataset urls ' + datasetId)),
        map(images => images.map(image => this.getThumbnailUrl(image.id))),
        tap(data => console.log(data))
      );
  }

  getProjectThumbnailUrls(projectId: number): Observable<string[]> {
    return this.getDatasetsByProjectId(projectId).pipe(
      switchMap(datasets => of(...datasets.map(ds => this.getDatasetThumbnailUrls(ds.id)))),
      combineAll(),
      map(imgUrls => {
        return imgUrls.reduce((a,b) => a.concat(b), [])
      })
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
  getImageViewUrl(imageId: number, z: number, t: number, min: number, max: number, quality = 1.0, channel=1) {
    return `/omero/webgateway/render_image/${imageId}/${z}/${t}/?c=${channel}|${min}:${max}$808080&q=${quality}`;
  }

  /**
   * Downloads the render infos from omero.
   * This is important to move the true image values (e.g. 16 bit) to a viewable spectrum (e.g. 200-800).
   * @param imageId image set id
   */
  getImageRenderInfos(imageId: number) {
    return this.httpClient.get(`/omero/webgateway/imgData/${imageId}/`).pipe(
      map(r => {
        return deserialize(r, RenderInfos)
      })
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
        const min = data.renderInfos.channels[0].window.start;
        const max = data.renderInfos.channels[0].window.end;
        return data.it.map(item => this.getImageViewUrl(item.imageId, item.z, item.t, min, max));
      })
    );
  }

  /**
   * Show all file annotations associated with an image sequence in omero
   * @param imageId image sequence id
   */
  getFileAnnotations(imageId: number): Observable<Array<Annotation>> {
    return this.httpClient.get(`/omero/webclient/api/annotations/?type=file&image=${imageId}`).pipe(
      map(r => {
        return deserialize(r, AnnotationResult);
      }),
      map(r => r.annotations)
    );
  }

  getPagedRoIData(imageId: number): Observable<Array<RoIData>> {
    return this.getPagedData(`/omero/api/m/images/${imageId}/rois/`, RoIData);
    /*return this.httpClient.get(`/omero/api/m/images/${imageId}/rois/`, {params}).pipe(
      map(r => deserialize(r, RoIResult))
    );*/
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
      map(annotations => {
        return annotations.filter(ann => ann.file.name === fileName).sort((a, b) => -(a.date.getTime() - b.date.getTime()));
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
      // filter by current filename
      map(annotations => annotations.filter(ann => ann.file.name === fileName)),
      // delete all but the latest file version (it is the file we have just uploaded)
      mergeMap(
        (annotations: Annotation[]) => {
          let sortedAnnotations = annotations.sort((a, b) => -(a.date.getTime() - b.date.getTime()));
          // do not delete the newest file version
          sortedAnnotations = sortedAnnotations.splice(1);
          const deletions = [];
          for (const ann of sortedAnnotations) {
            // remove them
            const formData = new FormData();
            formData.set('parent', 'image-' + imageId);
            deletions.push(
              this.httpClient.post(`/omero/webclient/action/delete/file/${ann.id}/`, formData)
            );
          }
          if (deletions.length > 0) {
            return combineLatest(deletions).pipe(
              catchError(err => {
                // there was an error during file deletion. However deletion is not so important
                this.userQuestionService.showInfo("Problems when deleting Omero files");
                // just skip it!
                return of(null);
              })
            );
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

  /**
   * Create Rois in omero
   * @param imageSetId id of the image set
   * @param roiList RoIs in segmentation data format
   * @param max 
   * @returns 
   */
  createRois(imageSetId: number, roiList: SegCollData, max=1000) {

    // 1. Need to get image information
    return this.getImage(imageSetId).pipe(
      map(res => {
        const sizeZ = res.pixels.sizeZ;
        const sizeT = res.pixels.sizeT;

        return {sizeZ, sizeT};
      }),
      map(imageDims => {
        return OmeroUtils.createNewRoIList(roiList, imageDims.sizeZ, imageDims.sizeT);
      }),
      switchMap(roiList => {
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
      })
    )
  }

  /**
   * Get data of certain type
   * @param url endpoint url
   * @param c the type (must be serializable)
   * @returns returns the deserialize object instance
   */
  getData<T>(url: string, c: new () => T, inData = true) {
    if (!url.startsWith('/omero/api')) {
      console.warn(`url ${url} is not compatible with endpoint.`)
    }
    return this.httpClient.get(url).pipe(
      map((r: DataResponse<any>) => {
        if (inData) {
          return deserialize(r.data, c);
        } else {
          return deserialize(r, c);
        }
      })
    );
  }

  /**
   * Loads all pages of the backend and combines the result in array
   * @param url backend url
   * @param c class type
   * @param limit the limit you request with first api call (later automatically max limit)
   * @returns an array of obtained data items
   */
  getPagedData<T>(url, c: new () => T, limit=500, params?: { [param: string]: string | string[]}): Observable<Array<T>> {
    if (!url.startsWith('/omero/api')) {
      console.warn(`url ${url} is not compatible with endpoint.`)
    }
    const unpackPage = map(r => {
      const response = deserialize(r, PagedResponse);
      return <PagedResponse<T>>response;
    });
    return this.httpClient.get(url, {params: {limit: limit + '', ...params}}).pipe(
      unpackPage,
      switchMap((result: PagedResponse<T>) => {

        // extract paging meta data from request
        const limit = result.meta.limit;
        const maxLimit = result.meta.maxLimit;
        const totalCount = result.meta.totalCount;

        const requestList: Array<Observable<PagedResponse<T>>> = [];

        requestList.push(of(result))

        if (totalCount > limit) {
          for(let i = 0; i < Math.ceil((totalCount - limit) / maxLimit); i++) {
            requestList.push(this.httpClient.get(url, {params: {limit: maxLimit + '', offset: limit + i * maxLimit + '', ...params}}).pipe(unpackPage));
          }
        }

        return of(...requestList).pipe(
          // combine all requests (executed in parallel)
          combineAll(),
        )
      }),
      // unpack, concatenated and deserialize
      map((data: Array<PagedResponse<T>>) => data.map(d => d.data).reduce((a,b) => a.concat(b)).map(rawData => deserialize(rawData, c))),
      map(resArray => <Array<T>>resArray)
    );
  }


  /**
   * 
   * @param imageSetId current imageset id
   * @returns next imageset id in the same dataset (according to omero sorting)
   */
  nextImageSequence(imageSetId): Observable<number> {
    return this.getImageDataset(imageSetId).pipe(
      switchMap((d): Observable<Array<Image>> => this.getPagedData(d.urlImages, Image)),
      map(images => {
        const myImageIndex = images.findIndex(image => image.id == imageSetId);
        const nextImageIndex = myImageIndex + 1;

        if(nextImageIndex >= images.length) {
          throw new Error('There are no further images in the dataset!');
        }

        return images[nextImageIndex].id
      })
    )
  }

  /**
   * 
   * @param imageSetId current imageset id
   * @returns previous imageset id in the same dataset (according to omero sorting)
   */
   previousImageSequence(imageSetId): Observable<number> {
    return this.getImageDataset(imageSetId).pipe(
      switchMap((d): Observable<Array<Image>> => this.getPagedData(d.urlImages, Image)),
      map(images => {
        const myImageIndex = images.findIndex(image => image.id == imageSetId);
        const nextImageIndex = myImageIndex - 1;

        if(nextImageIndex < 0) {
          throw new Error('There are no previous images in the dataset!');
        }

        return images[nextImageIndex].id
      })
    )
  }

  getImageInfo(imageSetId: number): Observable<ImageInfo> {
    return this.getData(`/omero/iviewer/image_data/${imageSetId}/`, ImageInfo, false);
  }
}
