import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, inject, TestBed, waitForAsync } from '@angular/core/testing';
import { OmeroAPIService } from '../services/omero-api.service';
import { ThumbnailsPipe } from './thumbnails.pipe';

describe('ProjectThumbnailsPipe', () => {
  beforeEach(() => {
    TestBed
      .configureTestingModule({
        providers: [
          OmeroAPIService
        ],
        imports: [
          HttpClientTestingModule
        ]
      });
  });

  it('create an instance', inject([OmeroAPIService], (omeroAPIService: OmeroAPIService) => {
    let pipe = new ThumbnailsPipe(omeroAPIService);
    expect(pipe).toBeTruthy();
  })); 
});
