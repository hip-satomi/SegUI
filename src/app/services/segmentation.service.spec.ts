import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SegmentationService } from './segmentation.service';

describe('SegmentationService', () => {
  let service: SegmentationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], 
      providers: [SegmentationService]
    });
    service = TestBed.inject(SegmentationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
