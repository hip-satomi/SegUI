import { HttpClient, HttpHeaders } from '@angular/common/http';
import { flatten } from '@angular/compiler';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, concatAll, flatMap, concatMap, exhaust, switchAll, combineAll, first, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';


export class ImageSet {
  id: number;
  name: string;
  creationDate: string;
  image_set: string[];
}

export class Image {
  id: number;
  width: number;
  height: number;
  frameId: number;
}

export interface GUISegmentationCandidate {
  imageSet: string;
  json: string;
}

export interface GUISegmentation extends GUISegmentationCandidate {
  id: number;
  modifiedDate: string;
  createdDate: string;
}


export interface SimpleSegmentationCandidate {
  json: string;
  /** url to related GUI Segmentation */
  segmentation: string;
}
export interface SimpleSegmentation extends SimpleSegmentationCandidate {
  id: number;
}


export interface GUITrackingCandidate {
  segmentation: string;
  json: string;
}

export interface GUITracking extends GUITrackingCandidate {
  id: number;
  modifiedDate: string;
  createdDate: string;
}

export class Result {
  count: number;
  next: string;
  previous: string;
  results: any[];
}

@Injectable({
  providedIn: 'root'
})
export class SegRestService {

  rootUrl: string = '/';
  baseUrl: string = `${this.rootUrl}seg-api/`;
  rc = map(resultObject => {
    console.log(resultObject);
    return resultObject as Result;
  });

  complexPipe = [
    // get the api urls of image instances
    map((imageSet: ImageSet) => {
      return imageSet.image_set;
    }),
    // get the api image instances
    flatMap((imageUrls: string[]) => {
      return imageUrls.map((url: string) => {
        return this.getImageByUrl(url);
      });
    }),
    // resolve the http requests
    combineAll(),
    // get the api image ids
    map((images: Image[]) => {
      return images.map(image => image.id);
    }),]

  constructor(private httpClient: HttpClient,
              private auth: AuthService) { }

  private static createHttpOptions(jwtToken: string) {
    return {
      headers: new HttpHeaders({
          Authorization: 'Bearer ' + jwtToken
      })
    };
  }

  private get(url: string) {
    // get a valid token first --> then we can execute the http call
    return this.auth.getValidToken().pipe(
      switchMap(token => {
        return this.httpClient.get(url, SegRestService.createHttpOptions(token));
      })
    );
  }

  /**
   * Provides the binary download from an url, e.g. an image
   * @param url the url 
   */
  public getBinary(url: string) {
    // get a valid token first --> then we can execute the http call
    return this.auth.getValidToken().pipe(
      switchMap(token => {
        const headers = SegRestService.createHttpOptions(token).headers;
        return this.httpClient.get<Blob>(url,  {headers, responseType: 'blob' as 'json'});
      })
    );
  }


  private put(url: string, body: any) {
    // get a valid token first --> then we can execute the http call
    return this.auth.getValidToken().pipe(
      switchMap(token => {
        return this.httpClient.put(url, body, SegRestService.createHttpOptions(token));
      })
    );
  }

  private post(url: string, body: any) {
    // get a valid token first --> then we can execute the http call
    return this.auth.getValidToken().pipe(
      switchMap(token => {
        return this.httpClient.post(url, body, SegRestService.createHttpOptions(token));
      })
    );
  }

  /*
   * Sending a GET request to imageSets/
   */
  public getImageSets(): Observable<ImageSet[]> {
    return this.get(this.baseUrl + 'imageSets/')
      .pipe(
        this.rc,
        map((resultObject: Result): ImageSet[] => {
          console.log(resultObject);
          return resultObject.results.map((imageSet) => imageSet as ImageSet);
        })
      );
  }

  /**
   * returns the api image set instance
   * @param id of the image set
   */
  public getImageSetById(id: number): Observable<ImageSet> {
    return this.get(this.baseUrl + `imageSets/${id}`)
      .pipe(
        map((data) => data as ImageSet)
      );
  }

  /**
   * Sending a get request to images/
   */
  public getImages(): Observable<Image[]> {
    return this.get(this.baseUrl + 'images/')
      .pipe(
        this.rc,
        map((result: Result): Image[] => result.results.map(image => image as Image))
      );
  }

  /**
   * Sending a get request to image
   */
  public getImageByUrl(url: string): Observable<Image> {
    return this.get(url)
      .pipe(
        map((data) => data as Image)
      );
  }

  public getImageUrl(id: number) {
    return `${this.rootUrl}mediafiles/images/${id}.png`;
  }

  /**
   * Requests url to binary image
   * @param imageSetId the image set id
   * @param frameId the frame id
   */
  public getImageUrlByFrame(imageSetId: number, frameId: number) {
    return this.get(`${this.baseUrl}images/?imageSet=${imageSetId}&frameId=${frameId}`).pipe(
      this.rc,
      map(result => result.results[0] as Image),
      map(image => this.getImageUrl(image.id))
    );
  }

  public getImageIds(imageSetId: number): Observable<number[]> {
    return this.getImageSetById(imageSetId).pipe(
      // get the api urls of image instances
      map((imageSet: ImageSet) => {
        return imageSet.image_set;
      }),
      // get the api image instances
      flatMap((imageUrls: string[]) => {
        return imageUrls.map((url: string) => {
          return this.getImageByUrl(url);
        });
      }),
      // resolve the http requests
      combineAll(),
      // get the api image ids
      map((images: Image[]) => {
        return images.map(image => image.id);
      }),
    );
  }

  /**
   * Returns a list of direct image adresses that can be loaded using an image tag
   * @param imageSetId id of the image set
   */
  public getImageUrls(imageSetId: number): Observable<string[]> {
    return this.getImageIds(imageSetId).pipe(
      // create the media urls for the images
      map((ids: number[]) => {
        return ids.map((id: number) => this.getImageUrl(id));
      })
    );
  }

  public getSegmentationUrl(segId: number) {
    return `${this.baseUrl}gui-segmentations/${segId}/`;
  }

  public postSegmentation(imageSetId: number, json: string): Observable<GUISegmentation> {
    const imageSource = `${this.baseUrl}imageSets/${imageSetId}/`;

    const segCand: GUISegmentationCandidate = {imageSet: imageSource, json};

    return this.post(`${this.baseUrl}gui-segmentations/`, segCand)
      .pipe(
        map((result) => result as GUISegmentation)
      );
  }

  public putSegmentation(segItem: GUISegmentation): Observable<GUISegmentation> {
    return this.put(`${this.baseUrl}gui-segmentations/${segItem.id}/`, segItem)
      .pipe(
        map((result) => result as GUISegmentation)
      );
  }

  public getSegmentation(segmentationId: number): Observable<GUISegmentation> {
    return this.get(`${this.baseUrl}gui-segmentations/${segmentationId}/`).pipe(
      map(result => result as GUISegmentation)
    );
  }

  public getSegmentationByUrl(segmentationUrl: string): Observable<GUISegmentation> {
    return this.get(segmentationUrl).pipe(
      map(r => r as GUISegmentation)
    );
  }

  /**
   * 
   * TODO really get latest segmentation
   * @param imageSetId 
   */
  public getLatestSegmentation(imageSetId: number): Observable<GUISegmentation> {
    return this.get(`${this.baseUrl}gui-segmentations/?imageSet=${imageSetId}`).pipe(
      this.rc,
      map((result: Result) => {
        if (result.results.length > 0) {
          return result.results[0] as GUISegmentation;
        } else {
          return null;
        }
      })
    );
  }

// ----- Simple Segmentation related stuff begins -----

  /**
   * TODO do not only return a single one. Think about selection
   * @param guiSegId 
   */
  public getSimpleSegFromGUISegmentationId(guiSegId: number): Observable<SimpleSegmentation> {
    return this.get(`${this.baseUrl}simple-segmentations/?segmentation=${guiSegId}`).pipe(
      this.rc,
      map((result: Result) => {
        if (result.results.length > 0) {
          return result.results[0] as SimpleSegmentation;
        } else {
          return null;
        }
      })
    );
  }

  public postSimpleSegmentation(simpleSeg: SimpleSegmentation) {
    return this.post(`${this.baseUrl}simple-segmentations/`, simpleSeg).pipe(
      map(r => r as SimpleSegmentation)
    );
  }

  public putSimpleSegmentation(simpleSeg: SimpleSegmentation) {
    return this.put(`${this.baseUrl}simple-segmentations/${simpleSeg.id}/`, simpleSeg).pipe(
      map(r => r as SimpleSegmentation)
    );
  }

// ----- Tracking related stuff begins -----

  public getLatestTracking(imageSetId: number): Observable<GUITracking> {
    return this.get(`${this.baseUrl}gui-trackings/?imageSet=${imageSetId}`).pipe(
      this.rc,
      map((result: Result) => {
        if (result.results.length > 0) {
          return result.results[0] as GUITracking;
        } else {
          return null;
        }
      })
    );
  }

  public getTrackingSegmentation(tracking: GUITracking): Observable<GUISegmentation> {
    return this.get(`${tracking.segmentation}`).pipe(
      map(r => r as GUISegmentation)
    );
  }

  public putTracking(tracking: GUITracking): Observable<GUITracking> {
    return this.put(`${this.baseUrl}gui-trackings/${tracking.id}/`, tracking).pipe(
      map(r => r as GUITracking)
    );
  }

  public postTracking(segUrl: string, json: string): Observable<GUITracking> {
    return this.post(`${this.baseUrl}gui-trackings/`, {segmentation: segUrl, json}).pipe(
      map(r => r as GUITracking)
    );
  }


}
