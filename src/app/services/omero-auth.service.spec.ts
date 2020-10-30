import { TestBed } from '@angular/core/testing';

import { OmeroAuthService } from './omero-auth.service';

describe('OmeroAuthService', () => {
  let service: OmeroAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OmeroAuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
