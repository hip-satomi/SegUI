import { TestBed } from '@angular/core/testing';
import { IonicStorageModule } from '@ionic/storage-angular';

import { StorageService } from './storage.service';

class MockStorage {

  data = {};

  create() {
    return this;
  }

  async set(key: string, value: string) {
    this.data[key] = value;
  }

  async get(key: string) {
    this.data[key] || null;
  }

  async keys() {
    return Object.keys(this.data);
  }


}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IonicStorageModule.forRoot()],
      providers: [{
        provide: Storage,
        useClass: MockStorage
      }]
    });
    service = TestBed.inject(StorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
