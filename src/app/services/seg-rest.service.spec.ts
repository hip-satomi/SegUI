import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SegRestService } from './seg-rest.service';

describe('SegRestService', () => {
  let service: SegRestService;
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SegRestService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getImageSets', () => {
    it('should return an Observable<ImageSet[]>', () => {
      const someItems = {
        "count": 1,
        "next": null,
        "previous": null,
        "results": [
            {
                "name": "test",
                "creationDate": "2020-09-28T14:53:37.899134Z",
                "image_set": [
                    "http://127.0.0.1:8000/api/images/29/",
                    "http://127.0.0.1:8000/api/images/30/",
                    "http://127.0.0.1:8000/api/images/31/",
                    "http://127.0.0.1:8000/api/images/32/",
                    "http://127.0.0.1:8000/api/images/33/",
                    "http://127.0.0.1:8000/api/images/34/",
                    "http://127.0.0.1:8000/api/images/35/",
                    "http://127.0.0.1:8000/api/images/36/",
                    "http://127.0.0.1:8000/api/images/37/",
                    "http://127.0.0.1:8000/api/images/38/",
                    "http://127.0.0.1:8000/api/images/39/",
                    "http://127.0.0.1:8000/api/images/40/",
                    "http://127.0.0.1:8000/api/images/41/",
                    "http://127.0.0.1:8000/api/images/42/",
                    "http://127.0.0.1:8000/api/images/43/",
                    "http://127.0.0.1:8000/api/images/44/",
                    "http://127.0.0.1:8000/api/images/45/",
                    "http://127.0.0.1:8000/api/images/46/",
                    "http://127.0.0.1:8000/api/images/47/",
                    "http://127.0.0.1:8000/api/images/48/",
                    "http://127.0.0.1:8000/api/images/49/",
                    "http://127.0.0.1:8000/api/images/50/"
                ]
            }
        ]
      };

      service.getImageSets().subscribe((imageSets) => {
        expect(imageSets.length).toBe(1);
        expect(imageSets).toEqual(someItems.results);
      });

      const request = httpMock.expectOne(`${service.baseUrl}imageSets/`);
      expect(request.request.method).toBe("GET");
      request.flush(someItems);
      httpMock.verify();

    });
  });

  describe('getImages', () => {
    it('should return an Observable<Images[]>', () => {
      const someItems =
      {
          "count": 22,
          "next": "http://127.0.0.1:8000/api/images/?page=2",
          "previous": null,
          "results": [
              {
                  "id": 50,
                  "width": 487,
                  "height": 653,
                  "frameId": 21
              },
              {
                  "id": 49,
                  "width": 487,
                  "height": 653,
                  "frameId": 20
              },
              {
                  "id": 48,
                  "width": 487,
                  "height": 653,
                  "frameId": 19
              },
              {
                  "id": 47,
                  "width": 487,
                  "height": 653,
                  "frameId": 18
              },
              {
                  "id": 46,
                  "width": 487,
                  "height": 653,
                  "frameId": 17
              },
              {
                  "id": 45,
                  "width": 487,
                  "height": 653,
                  "frameId": 16
              },
              {
                  "id": 44,
                  "width": 487,
                  "height": 653,
                  "frameId": 15
              },
              {
                  "id": 43,
                  "width": 487,
                  "height": 653,
                  "frameId": 14
              },
              {
                  "id": 42,
                  "width": 487,
                  "height": 653,
                  "frameId": 13
              },
              {
                  "id": 41,
                  "width": 487,
                  "height": 653,
                  "frameId": 12
              }
          ]
      };

      service.getImages().subscribe((images) => {
        expect(images.length).toBe(10);
        expect(images).toEqual(someItems.results);
      });

      const request = httpMock.expectOne(`${service.baseUrl}images/`);
      expect(request.request.method).toBe("GET");
      request.flush(someItems);
      httpMock.verify();

    });
  });

  describe('getImageByUrl', () => {
    it('should return an Observable<Image>', () => {
      const someItems = {
        "id": 29,
        "width": 487,
        "height": 653,
        "frameId": 0,
        "imageSet": "http://127.0.0.1:8000/api/imageSets/10/"
      };

      service.getImageByUrl(service.baseUrl + 'images/29/').subscribe((image) => {
        expect(image).toEqual(someItems);
      });

      const request = httpMock.expectOne(`${service.baseUrl}images/29/`);
      expect(request.request.method).toBe("GET");
      request.flush(someItems);
      httpMock.verify();

    });
  });

});
