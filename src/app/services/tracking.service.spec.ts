import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let service: TrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TrackingService]
    });
    service = TestBed.inject(TrackingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
