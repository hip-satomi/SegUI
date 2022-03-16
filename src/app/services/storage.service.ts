import { Injectable } from '@angular/core';

import { Storage } from '@ionic/storage-angular';
import { ReplaySubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;

  available$ = new ReplaySubject<boolean>(1);

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    // If using, define drivers here: await this.storage.defineDriver(/*...*/);
    const storage = await this.storage.create();
    this._storage = storage;
    console.log(this.storage);
    this.available$.next(true);
  }

  // Create and expose methods that users of this service can
  // call, for example:
  public set(key: string, value: any) {
    return this._storage?.set(key, value);
  }

  public get(key: string): Promise<string> {
    return this._storage?.get(key);
  }

  public has(key: string): Promise<boolean> {
    console.log("has");
    return this._storage?.keys().then(keys => keys.includes(key));
  }
}
