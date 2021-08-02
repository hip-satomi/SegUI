import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OmeroAPIService } from './omero-api.service';

describe('OmeroAPIService', () => {
  let service: OmeroAPIService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OmeroAPIService]
    });
    service = TestBed.inject(OmeroAPIService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
