import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { OmeroAuthService } from './omero-auth.service';

describe('OmeroAuthService', () => {
  let service: OmeroAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule]
    });
    service = TestBed.inject(OmeroAuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
