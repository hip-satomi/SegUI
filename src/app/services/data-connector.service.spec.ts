import { TestBed } from '@angular/core/testing';

import { DataConnectorService } from './data-connector.service';

describe('DataConnectorService', () => {
  let service: DataConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataConnectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
