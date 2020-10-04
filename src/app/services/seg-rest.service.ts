import { HttpClient } from '@angular/common/http';
import { flatten } from '@angular/compiler';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, concatAll, flatMap, concatMap, exhaust, switchAll, combineAll, first } from 'rxjs/operators';


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

  rootUrl: string = 'http://Lara:8000/';
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

  constructor(private httpClient: HttpClient) { }

  /*
   * Sending a GET request to imageSets/
   */
  public getImageSets(): Observable<ImageSet[]> {
    return this.httpClient.get(this.baseUrl + 'imageSets/')
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
    return this.httpClient.get(this.baseUrl + `imageSets/${id}`)
      .pipe(
        map((data) => data as ImageSet)
      );
  }

  /**
   * Sending a get request to images/
   */
  public getImages(): Observable<Image[]> {
    return this.httpClient.get(this.baseUrl + 'images/')
      .pipe(
        this.rc,
        map((result: Result): Image[] => result.results.map(image => image as Image))
      );
  }

  /**
   * Sending a get request to image
   */
  public getImageByUrl(url: string): Observable<Image> {
    return this.httpClient.get(url)
      .pipe(
        map((data) => data as Image)
      );
  }

  public getImageUrl(id: number) {
    return `${this.rootUrl}media/images/${id}.png`;
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

    return this.httpClient.post(`${this.baseUrl}gui-segmentations/`, segCand)
      .pipe(
        map((result) => result as GUISegmentation)
      );
  }

  public putSegmentation(segItem: GUISegmentation): Observable<GUISegmentation> {
    return this.httpClient.put(`${this.baseUrl}gui-segmentations/${segItem.id}/`, segItem)
      .pipe(
        map((result) => result as GUISegmentation)
      );
  }

  public getSegmentation(segmentationId: number): Observable<GUISegmentation> {
    return this.httpClient.get(`${this.baseUrl}gui-segmentations/${segmentationId}/`).pipe(
      map(result => result as GUISegmentation)
    );
  }

  public getSegmentationByUrl(segmentationUrl: string): Observable<GUISegmentation> {
    return this.httpClient.get(segmentationUrl).pipe(
      map(r => r as GUISegmentation)
    );
  }

  /**
   * 
   * TODO really get latest segmentation
   * @param imageSetId 
   */
  public getLatestSegmentation(imageSetId: number): Observable<GUISegmentation> {
    return this.httpClient.get(`${this.baseUrl}gui-segmentations/?imageSet=${imageSetId}`).pipe(
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

  public getLatestTracking(imageSetId: number): Observable<GUITracking> {
    return this.httpClient.get(`${this.baseUrl}gui-trackings/?imageSet=${imageSetId}`).pipe(
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
    return this.httpClient.get(`${tracking.segmentation}`).pipe(
      map(r => r as GUISegmentation)
    );
  }

  public putTracking(tracking: GUITracking): Observable<GUITracking> {
    return this.httpClient.put(`${this.baseUrl}gui-trackings/${tracking.id}/`, tracking).pipe(
      map(r => r as GUITracking)
    );
  }

  public postTracking(segUrl: string, json: string): Observable<GUITracking> {
    return this.httpClient.post(`${this.baseUrl}gui-trackings/`, {segmentation: segUrl, json}).pipe(
      map(r => r as GUITracking)
    );
  }


}
