/**
 * This service provides access to omero web JSON API (https://docs.openmicroscopy.org/omero/5.6.0/developers/json-api.html)
 * including functionality for requests but also JSON serialization interfaces.
 */

import { Point } from './../models/geometry';
import { Serializable, JsonProperty, deserialize } from 'typescript-json-serializer';
import { map, tap, mergeMap, switchMap, combineAll, catchError } from 'rxjs/operators';
import { DataResponse } from './omero-auth.service';
import { HttpClient} from '@angular/common/http';
import { Observable, of, combineLatest, from, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';
import { UserQuestionsService } from './user-questions.service';
import { SegCollData } from '../models/segmentation-model';
import { OmeroUtils } from '../models/utils';
import { AnnotationLabel } from '../models/segmentation-data';

/**
 * Rewrite omero api urls into our urls (they get redirected again).
 * This is to make sure that urls stays simple and we can decide when to switch api version.
 * @param url the url
 * @returns new url
 */
const rewriteOmeroUrl = (url: string): string => {
  const match = url.match('^.*/api/v0/')
  if (match.length == 0) {
    throw new Error("This is not a valid omero url!");
  }
  url = url.replace(match[0], 'omero/api/');
  return url;
};

/**
 * Base class for omero type information.
 */
@Serializable()
export class Type {
  @JsonProperty({name: '@type'})
  type: string;
}

/**
 * Class for Omero permissions
 */
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

/** wrapper for permissions */
@Serializable()
export class PermissionDetails extends Type {
  @JsonProperty()
  permissions: Permissions;
}

/** Omero Owner information */
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

/** Omero Grop information */
export class Group extends Type {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'omero:details'})
  details: PermissionDetails;

  @JsonProperty({name: 'Name'})
  name: string
}

/** Omero details information */
@Serializable()
export class Details {
  @JsonProperty()
  owner: Owner;

  @JsonProperty()
  group: Group;

  @JsonProperty()
  permissions: Permissions;
}

/** Omero id information */
@Serializable()
export class Id {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({name: 'omero:details'})
  details: Details;
}

/** Base class to encapsulate repeating Omero information */
@Serializable()
export class Base extends Id {
  @JsonProperty({name: 'Name'})
  name: string;
  @JsonProperty({name: 'Description'})
  description: string;
}


/** Omero project information */
@Serializable()
export class Project extends Base {
  @JsonProperty({name: 'omero:details'})
  details: Details;

  @JsonProperty({name: 'url:project', onDeserialize: rewriteOmeroUrl})
  url: string;
  @JsonProperty({name: 'url:datasets', onDeserialize: rewriteOmeroUrl})
  urlDatasets: string;
}

/** Omero dataset information */
@Serializable()
export class Dataset extends Base {
  @JsonProperty({name: 'url:dataset', onDeserialize: rewriteOmeroUrl})
  url: string;
  @JsonProperty({name: 'url:images', onDeserialize: rewriteOmeroUrl})
  urlImages: string;
  @JsonProperty({name: 'url:projects', onDeserialize: rewriteOmeroUrl})
  urlProjects: string;
}

/** Omero information about the physical size of an image */
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

/** Omero Pixel information (gives information about a single image stack)  */
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

/** Page meta is information provided by API to limit the number of entries per http request and distribute the content onto multiple pages (https://docs.openmicroscopy.org/omero/5.6.0/developers/json-api.html#pagination).
 *  E.g. loading RoIs from the API may require multiple calls.
 */
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

/** General response for paged data */
@Serializable()
export class PagedResponse<T> {

  @JsonProperty()
  data: Array<T>;

  @JsonProperty()
  meta: PageMeta;
}

/** Omero information about image stack */
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

/**
 * Convert point list to Omero string froamt
 * @param points point list
 * @returns a string in Omero format
 */
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

/** Omero information about a single shape in a RoI */
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

/** Omero information about a single RoI (can contain multiple shapes) */
@Serializable()
export class RoIData {
  @JsonProperty({name: '@id'})
  id: number;

  @JsonProperty({type: RoIShape})
  shapes: Array<RoIShape>;
}

/**
 * Our representation of a polygon shape
 */
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

export interface RenderChannel {
  min: number;
  max: number;
  c: number;
  color: string;
  lut: string;
  inverted: boolean;
}

enum OmeroType {
  Image = "image",
  Dataset = "dataset",
  Project = "project"
}

/**
 * This service bundles functionality to access the Omero web JSON API (https://docs.openmicroscopy.org/omero/5.6.0/developers/json-api.html)
 */
@Injectable({
  providedIn: 'root'
})
export class OmeroAPIService {

  projects$: Observable<Project[]>;

  constructor(private httpClient: HttpClient,
      public userQuestionService: UserQuestionsService) {

    // create pipe to list all omero projects
    this.projects$ = this.getPagedData('omero/api/m/projects/', Project);
  }

  /**
   * Request project information
   * @param id project omero id
   * @returns returns the project corresponding to the id
   */
  getProject(id: number): Observable<Project> {
    return this.getData(`omero/api/m/projects/${id}/`, Project);
  }

  /**
   * 
   * @param dataset 
   * @returns parent project of the dataset
   */
  getDatasetProjects(dataset: Dataset): Observable<Array<Project>> {
    return this.getPagedData(dataset.urlProjects, Project);
  }

  /**
   * @param projectId unique project id
   * @returns all the datasets within the project
   */
  getDatasetsByProjectId(projectId: number): Observable<Dataset[]> {
    return this.getPagedData(`omero/api/m/projects/${projectId}/datasets/`, Dataset);
  }

  /**
   * 
   * @param datasetId unique dataset id
   * @returns list of images in that dataset
   */
  getImagesFromDataset(datasetId: number): Observable<Image[]> {
    return this.getPagedData(`omero/api/m/images/`, Image, 500, {dataset : '' + datasetId});
  }

  /**
   * 
   * @param imageId unique image id
   * @returns specific information about the image
   */
  getImage(imageId: number): Observable<Image> {
    return this.getData(`omero/api/m/images/${imageId}/`, Image);
  }

  /**
   * 
   * @param imageId id of the image sequence
   * @returns parent dataset
   */
  getImageDataset(imageId: number): Observable<Dataset> {
    return this.getImage(imageId).pipe(
      map(image => image.datasetUrl),
      switchMap(dsUrl => this.httpClient.get(dsUrl)),
      map((r: DataResponse<any>) => {
        //console.log(r);
        return deserialize(r, DatasetResult).data[0];
      })
    );
  };

  /**
   * Obtain the parent project of the dataset. If multiple parent projects are registered it retunrs the first one.
   * @param datasetId omero dataset id
   * @returns first project that is parent of the dataset
   */
  getDatasetProject(datasetId: number): Observable<Project> {
    return this.getDataset(datasetId).pipe(
      map(dataset => {
        return dataset.urlProjects
      }),
      switchMap(url => {
        return this.getPagedData(url, Project)
      }),
      map((projects: Array<Project>) => {
        if (projects.length != 1) {
          console.warn("Not a single parent project registered! Take first! This might give ambiguous results!");
        }
        return projects[0];
      })
    )
  };

  /**
   * 
   * @param datasetId unique dataset id
   * @returns dataset information
   */
  getDataset(datasetId: number): Observable<Dataset> {
    return this.getData(`omero/api/m/datasets/${datasetId}/`, Dataset);
  }

  /**
   * 
   * @param datasetId unique dataset id
   * @returns thumbnail urls for all images in the dataset
   */
  getDatasetThumbnailUrls(datasetId: number): Observable<string[]> {
    return this.getImagesFromDataset(datasetId)
      .pipe(
        //tap(() => console.log('get dataset urls ' + datasetId)),
        map(images => images.map(image => this.getThumbnailUrl(image.id))),
        //tap(data => console.log(data))
      );
  }

  /**
   * 
   * @param projectId unique project id
   * @returns thumbnail urls for all images in the project
   */
  getProjectThumbnailUrls(projectId: number): Observable<string[]> {
    return this.getDatasetsByProjectId(projectId).pipe(
      switchMap(datasets => of(...datasets.map(ds => this.getDatasetThumbnailUrls(ds.id)))),
      // combine for all datasets
      combineAll(),
      map(imgUrls => {
        return imgUrls.reduce((a,b) => a.concat(b), [])
      })
    );
  }

  /**
   * Uses webclient API to render thumbnails
   * @param imageId unique image id
   * @returns the thumbnail url for this image
   */
  getThumbnailUrl(imageId: number) {
    return `omero/webclient/render_thumbnail/${imageId}/?version=0`;
  }

  /**
   * Generates a url for rendering a specific image from the image stack
   * @param imageId image set id
   * @param z z channel index
   * @param t t channel index
   * @param channels array of channels to render
   * @param quality jpeg quality parameter
   */
  getImageViewUrl(imageId: number, z: number, t: number, channels: Array<RenderChannel>, quality = 1.0) {
    // create rendering strings
    const individualChannelRenders = []
    for (const channel of channels) {
      let renderString = `${channel.c}|${channel.min}:${channel.max}$${channel.color}`;
      // if a lut is defined include that
      if (channel.lut !== undefined) {
        renderString += `$${channel.lut}`;
      }
      // check more specialized parameters
      const maps = [];
      if(channel.inverted) {
        maps.push({inverted: {enabled: true}})
      }
      // and add them to the render string
      if(maps.length > 0) {
        renderString += `$maps=${maps}`;
      }
      individualChannelRenders.push(renderString);
    }

    // join channel rendering strings
    const jointRenderString = individualChannelRenders.join(',');

    // compose final image url
    return `omero/webgateway/render_image/${imageId}/${z}/${t}/?c=${jointRenderString}&q=${quality}`;
  }

  /**
   * Downloads the render infos from omero.
   * This is important to move the true image values (e.g. 16 bit) to a viewable spectrum (e.g. 200-800).
   * @param imageId image set id
   */
  getImageRenderInfos(imageId: number) {
    return this.httpClient.get(`omero/webgateway/imgData/${imageId}/`).pipe(
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
      switchMap((data) => {
        return this.getRenderConfigs(imageSetId).pipe(
          map((rdefs) => {
            return {...data, rdefs: rdefs};
          })
        );
      }),
      // generate the final image urls with render info
      map((data: {image: Image, renderInfos: RenderInfos, it: Array<{imageId: number, z: number, t: number}>, rdefs:any}) => {

        // get rendering information from omero render definition
        // TODO: let user select render config (not always take the first one)
        const rdef = data.rdefs[0];
        const renderChannels = [];
        let index = 0;
        for(const channel of rdef.c) {
          const start = channel.start;
          const end = channel.end;
          const color = channel.color;
          const lut = channel.lut;
          const inverted = channel.inverted || false;
          renderChannels.push({min: start, max: end, c: index+1, color, inverted});
          index += 1;
        }
        
        // use the definition to render images by omero
        return data.it.map(item => this.getImageViewUrl(item.imageId, item.z, item.t, renderChannels));
      })
    );
  }

  /**
   * Show all file annotations associated with an image sequence in omero
   * @param id image sequence id
   */
  getFileAnnotations(id: number, type: OmeroType = OmeroType.Image): Observable<Array<Annotation>> {
    return this.httpClient.get(`omero/webclient/api/annotations/?type=file&${type}=${id}`).pipe(
      map(r => {
        return deserialize(r, AnnotationResult);
      }),
      map(r => r.annotations)
    );
  }

  /**
   * 
   * @param imageId unique image id
   * @returns data for all RoIs associated with the image
   */
  getPagedRoIData(imageId: number): Observable<Array<RoIData>> {
    return this.getPagedData(`omero/api/m/images/${imageId}/rois/`, RoIData);
  }

  /**
   * Returns the latest file version associated with an image.
   * 
   * Only works when the file format is json!!!
   * @param omeroId image set id
   * @param fileName file name
   */
  getLatestFileJSON(omeroId: number, fileName: string, type: OmeroType = OmeroType.Image) {
    // get all annotations first
    return this.getFileAnnotations(omeroId, type).pipe(
      // filter by name and sort by date
      map(annotations => {
        return annotations.filter(ann => ann.file.name === fileName).sort((a, b) => -(a.date.getTime() - b.date.getTime()));
      }),
      // download file and parse
      switchMap(sortedAnnots => {
        if (sortedAnnots.length > 0) {
          return this.httpClient.get<Blob>(`omero/webclient/annotation/${sortedAnnots[0].id}/`, {responseType: 'blob' as 'json'}).pipe(
            switchMap(blob => from(blob.text())),
            map(txt => JSON.parse(txt))
          );
        } else {
          return throwError(new Error("File not found!"));
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
    return this.httpClient.post(`omero/webclient/annotate_file/`, formData).pipe(
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
              this.httpClient.post(`omero/webclient/action/delete/file/${ann.id}/`, formData)
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

  /**
   * Used to update RoI data
   * @param modificationData describin all the modifications 
   * @returns Observable to the http post request
   */
  modifyRois(modificationData: RoIModData) {
    return this.httpClient.post('omero/iviewer/persist_rois/', modificationData);
  }

  /**
   * Convert array [el1, el2, el3, el4, ...] to dictionary {el1: el2, el3: el4, ...}
   * @param data input array
   * @returns generate dictionary
   */
  arrayToDict(data: Array<any>) {
    const result_data = {}
    data.forEach(element => {
      result_data[`${element[0]}`] = `${element[0]}:${element[1]}`;
    });

    return result_data;
  }

  /**
   * 
   * @param imageSetId 
   * @param roiList list [(roi id, shape id), ...] of shapes to delete
   * @param max the maximum amount of deletion requests bundeled. If too large API might reject due to size of request.
   * @returns 
   */
  deleteRois(imageSetId, roiList: Array<[number, number]>, max=1000) {
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
   * Get unpaged data of certain serialization type
   * @param url endpoint url
   * @param c the type (must be serializable)
   * @param inData whether the data to serialize is wrapped into the "data" element in the json. Default is true.
   * @returns returns the deserialize object instance
   */
  getData<T>(url: string, c: new () => T, inData = true) {
    if (!url.startsWith('omero/api')) {
      console.warn(`url ${url} is not compatible with endpoint.`)
    }
    return this.httpClient.get(url).pipe(
      map((r: DataResponse<any>) => {
        if (inData) {
          // deserialize from data
          return deserialize(r.data, c);
        } else {
          // deserialize from raw response
          return deserialize(r, c);
        }
      })
    );
  }

  /**
   * Loads all pages of the backend and combines the result in array
   * @param url backend url
   * @param c class type for deserialization
   * @param limit the limit you request with first api call (later adapts automatically to max limit provided by API)
   * @returns an array of obtained data items
   */
  getPagedData<T>(url, c: new () => T, limit=500, params?: { [param: string]: string | string[]}): Observable<Array<T>> {
    if (!url.startsWith('omero/api')) {
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
   * @returns observable for next imageset id in the same dataset (according to omero sorting) and failes with error if there is no next sequence.
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
   * @returns observable for previous imageset id in the same dataset (according to omero sorting) and failes with error if there is no next sequence
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

  /**
   * 
   * @param imageSetId unique image id
   * @returns specialized image information
   */
  getImageInfo(imageSetId: number): Observable<ImageInfo> {
    return this.getData(`omero/iviewer/image_data/${imageSetId}/`, ImageInfo, false);
  }

  /**
   * Set last modification date for the image id
   * @param imageSetId image id
   * @returns http response observable
   */
  setLastModificationDate(imageSetId: number) {
    // get the current date
    const date = new Date().toISOString();

    // get existing image annotations first
    return this.getImageAnnotations(imageSetId).pipe(
      switchMap(result => {
        // do we have existing annotations?
        let annotationId = -1
        let existingIndex = -1;
        let value_pairs = [];

        if(result['annotations'].length > 0) {
          // yes, so let's use the first one
          annotationId = result['annotations'][0]['id']

          // find last modification value in annotation
          value_pairs = result['annotations'][0].values;
          for(const [index, value] of value_pairs.entries()) {
            if (value[0] == "last_modification") {
              existingIndex = index;
              break;
            }
          }
        }

        // either replace or append modification value
        if (existingIndex > -1) {
          value_pairs[existingIndex] = ["last_modification", `${date}`];
        } else {
          value_pairs.push(["last_modification", `${date}`]);
        }

        // construct the form data
        const formData = new FormData();
        formData.set('image', `${imageSetId}`);
        formData.set('mapAnnotation', JSON.stringify(value_pairs));
        if (annotationId != -1) {
          // add annotation id to form data (update)
          formData.set("annId", `${annotationId}`);
        }
    
        // convert to application/x-www-form-urlencoded
        // just didn't accept any other post format
        const data = [...formData.entries()];
        const asString = data
          .map(x => `${encodeURIComponent(x[0])}=${encodeURIComponent(x[1].toString())}`)
          .join('&');
    
        // send post request to webclient
        return this.httpClient.post(`/omero/webclient/annotate_map/`, asString, { headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}}); //"image=903&annId=14332&mapAnnotation=%5B%5B%22last_modification%22%2C%22test2%22%5D%5D");// JSON.stringify({image: `${imageSetId}`, mapAnnotation: `[[\"last_modification\",\"${date}\"]]`}));
      })
    );
  }

  /**
   * List all annotations for an image
   * @param imageSetId image id
   * @returns two lists (of annotations, of owners)
   */
  getImageAnnotations(imageSetId: number) {
    return this.httpClient.get(`/omero/webclient/api/annotations/`, {params: {type: 'map', image: `${imageSetId}`}});
  }

  /**
   * Tries to obtain default annotation config based on image, dataset, project or default config
   * @param imageSetId omero image id
   * @returns json object of annotation config
   */
  getDefaultAnnotationConfig(imageSetId: number): Observable<any> {
    // get dataset and project id first
    return this.getImageDataset(imageSetId).pipe(
      map((dataset) => dataset.id),
      switchMap((datasetId: number) => {
        return this.getDatasetProject(datasetId).pipe(
          map((project) => project.id),
          map((projectId: number) => {
            return {datasetId, projectId}
          })
        )
      }),
      // try to obain json annotation files
      switchMap(({datasetId, projectId}) => {
        const filename = "annotation_config.json";

        // 1. get image config (e.g. annotation_config.json)
        return this.getLatestFileJSON(imageSetId, filename, OmeroType.Image).pipe(
          tap(() => console.log("Use default image annotation config!")),
          catchError(() => {
            // 2. on fail --> get dataset config
            return this.getLatestFileJSON(datasetId, filename, OmeroType.Dataset).pipe(
              tap(() => console.log("Use default dataset annotation config!")),
              catchError(() => {
                // 5. on fail --> get project config
                return this.getLatestFileJSON(projectId, filename, OmeroType.Project).pipe(
                  tap(() => console.log("Use default project annotation config!")),
                  catchError(() => {
                    // 4. on fail --> get application config
                    return this.httpClient.get(`assets/${filename}`).pipe(
                      tap(() => console.log("Use default application annotation config")),
                    );
                  })
                )
              }),
            )
          }),
          );
        }
      ));
  }

  /** Obtain the omero render configuration for a specific image
   * @param imageSetId omero image id
   * @returns array of omero render definitions
   */
  getRenderConfigs(imageSetId: number) {
    return this.httpClient.get(`omero/webgateway/get_image_rdefs_json/${imageSetId}/`).pipe(
      map(data => data["rdefs"])
    );
  }
}

/**
 * Extract label information from default json config
 */
export const extractLabels = map((jsonData) => {
  try {
    const annotationLabels = []
    const labels = jsonData["labels"];
    // loop through all labels
    labels.forEach((item, index) => {
      annotationLabels.push(new AnnotationLabel(index, item['name'], item["visible"], item["color"], item["active"]));
    });

    return annotationLabels;
  } catch(e) {
    console.error(e.message);
    throw e;
  }
});
