import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IonicStorageModule } from '@ionic/storage-angular';

import { AIConfigService } from './aiconfig.service';
import { MockStorage } from './storage.service.spec';

describe('AIConfigService', () => {
  let service: AIConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, IonicStorageModule.forRoot()],
      providers: [
        {
          provide: Storage,
          useClass: MockStorage
        }
      ]
    });
    service = TestBed.inject(AIConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
