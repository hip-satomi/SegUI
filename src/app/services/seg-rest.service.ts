import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';


export class ImageSet {
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

  rootUrl: string = 'http://localhost:8000/';
  baseUrl: string = `${this.rootUrl}seg-api/`;
  rc = map(resultObject => resultObject as Result);

  constructor(private httpClient: HttpClient) { }

  /*
   * Sending a GET request to imageSets/
   */
  public getImageSets(): Observable<ImageSet[]> {
    return this.httpClient.get(this.baseUrl + 'imageSets/')
      .pipe(
        this.rc,
        map((resultObject: Result): ImageSet[] => {
          return resultObject.results.map((imageSet) => imageSet as ImageSet);
        })
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
    return `${this.rootUrl}media/images/${id}`;
  }
}
