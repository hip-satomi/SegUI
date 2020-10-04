import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { Injectable } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { switchMap, map, take, mapTo } from 'rxjs/operators';

const { Storage } = Plugins;

const helper = new JwtHelperService();
const TOKEN_KEY = 'jwt-token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user: Observable<any>;
  private userData = new BehaviorSubject(null);

  private baseUrl = 'http://localhost:8000/';

  constructor(private httpClient: HttpClient, private plt: Platform, private router: Router) {
    this.loadStoredToken();
  }

  loadStoredToken() {
    const platformObs = from(this.plt.ready());

    this.user = platformObs.pipe(
      switchMap(() => {
        return from(Storage.get({key: TOKEN_KEY})).pipe(
          map(val => val.value)
        );
      }),
      map(token => {
        if (token) {
          const decoded = helper.decodeToken(token);
          this.userData.next(decoded);
          return true;
        } else {
          return null;
        }
      })
    );
  }

  login(credential: {username: string, password: string}) {
    // make a post request here
    return this.httpClient.post(`${this.baseUrl}api/token/`, credential).pipe(
      take(1),
      map((res: {refresh: string, access: string}) => {
        return res.access;
      }),
      switchMap(token => {
        const decoded = helper.decodeToken(token);
        this.userData.next(decoded);

        const storageObs = from(Storage.set({key: TOKEN_KEY, value: token})).pipe(
          mapTo(decoded)
        );
        return storageObs;
      })
    );
  }

  getUser() {
    return this.userData.getValue();
  }

  logout() {
    Storage.remove({key: TOKEN_KEY}).then(() => {
      this.router.navigateByUrl('/');
      this.userData.next(null);
    });
  }
}
