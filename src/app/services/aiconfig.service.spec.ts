import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AIConfigService } from './aiconfig.service';

describe('AIConfigService', () => {
  let service: AIConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(AIConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
