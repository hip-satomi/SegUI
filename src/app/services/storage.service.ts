import { Injectable } from '@angular/core';

import { Storage } from '@ionic/storage-angular';
import { ReplaySubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Promise<Storage>;// | null = null;

  available$ = new ReplaySubject<boolean>(1);

  constructor(private storage: Storage) {
    this.init();
  }

  init() {
    // If using, define drivers here: await this.storage.defineDriver(/*...*/);
    this._storage =  this.storage.create();
    this._storage.then((storage) => console.log(storage))
    this.available$.next(true);
  }

  // Create and expose methods that users of this service can
  // call, for example:
  public async set(key: string, value: any) {
    const storage = await this._storage;
    return storage.set(key, value);
  }

  public async get(key: string): Promise<string> {
    const storage = await this._storage;
    return storage.get(key);
  }

  public async has(key: string): Promise<boolean> {
    const storage = await this._storage;
    console.log("has");
    return storage.keys().then(keys => keys.includes(key));
  }
}
