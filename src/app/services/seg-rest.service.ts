import { HttpClient } from '@angular/common/http';
import { flatten } from '@angular/compiler';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, concatAll, flatMap, concatMap, exhaust, switchAll, combineAll } from 'rxjs/operators';


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

export class Result {
  count: number;
  next: string;
  previous: string;
  results: [];
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

  /**
   * Returns a list of direct image adresses that can be loaded using an image tag
   * @param imageSetId id of the image set
   */
  public getImageUrls(imageSetId: number): Observable<string[]> {
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
      // create the media urls for the images
      map((ids: number[]) => {
        return ids.map((id: number) => this.getImageUrl(id));
      })
    );
  }
}
