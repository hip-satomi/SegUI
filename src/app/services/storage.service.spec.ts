import { TestBed } from '@angular/core/testing';
import { IonicStorageModule } from '@ionic/storage-angular';

import { StorageService } from './storage.service';

import { Storage } from '@ionic/storage-angular';

// load default segmentation configuration from file
const segmentationConfig = require('../../assets/ai-repositories.json');

export class MockStorage {

  data = {};

  async create() {

    this.data = { "AIConfig": segmentationConfig};
    return this;
  }

  async set(key: string, value: string) {
    this.data[key] = value;
  }

  async get(key: string) {
    if (this.data[key] == null) {
      throw new Error("Key is not in storage!");
    }
    return this.data[key];
  }

  async keys() {
    return Object.keys(this.data);
  }


}

describe('StorageService', () => {
  let service: StorageService;
  let storageService: Storage;

  const storage = new MockStorage();
  storage.data["test"] = "1";

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IonicStorageModule.forRoot()],
      providers: [{
        provide: Storage,
        useValue: storage
      }]
    });
    storageService = TestBed.inject(Storage);
    service = TestBed.inject(StorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load dummy config', async () => {
    expect(await service.get("AIConfig")).toBeTruthy()
  });
});
