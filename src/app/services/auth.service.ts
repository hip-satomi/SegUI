import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { Injectable } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { switchMap, map, take, mapTo, mergeMap } from 'rxjs/operators';

const { Storage } = Plugins;

const helper = new JwtHelperService();
const TOKEN_KEY = 'jwt-token';

export interface DecodedToken {
  exp: number;
  jti: string;
  token_type: string;
  user_id: number;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user: Observable<any>;
  private userData = new BehaviorSubject<DecodedToken>(null);
  private refreshUserData = new BehaviorSubject<DecodedToken>(null);
  private tokens = new BehaviorSubject<TokenPair>(null);

  private tokenPair: Observable<TokenPair>;

  private baseUrl = '/api';// 'http://lara:8000/';

  constructor(private httpClient: HttpClient, private plt: Platform, private router: Router) {
    this.loadStoredToken();
  }

  loadStoredToken() {
    const platformObs = from(this.plt.ready());

    this.user = platformObs.pipe(
      switchMap(() => {
        return from(Storage.get({key: TOKEN_KEY})).pipe(
          map(val => JSON.parse(val.value) as {access: string, refresh: string})
        );
      }),
      map((tokenPair) => {
        if (tokenPair) {
          const decoded = helper.decodeToken(tokenPair.access);
          this.userData.next(decoded);
          const refreshDecoded = helper.decodeToken(tokenPair.refresh);
          this.refreshUserData.next(refreshDecoded);
          return true;
        } else {
          return null;
        }
      })
    );

    this.tokenPair = platformObs.pipe(
      take(1),
      switchMap(() => {
        const memoryTokenPair = this.tokens.getValue();

        if (memoryTokenPair) {
          return of(memoryTokenPair);
        } else {
          return from(Storage.get({key: TOKEN_KEY})).pipe(
            map(val => JSON.parse(val.value) as TokenPair)
          );
        }
      })
    );
  }

  private handleTokenPair(tokenPair: TokenPair): Observable<string> {
    const decoded: DecodedToken = helper.decodeToken(tokenPair.access);
    this.userData.next(decoded);
    const refreshDecoded: DecodedToken = helper.decodeToken(tokenPair.refresh);
    this.refreshUserData.next(refreshDecoded);

    console.log(decoded);
    console.log(helper.getTokenExpirationDate(tokenPair.access));
    console.log(refreshDecoded);
    console.log(helper.getTokenExpirationDate(tokenPair.refresh));
    console.log(tokenPair.refresh);

    return from(Storage.set({key: TOKEN_KEY, value: JSON.stringify(tokenPair)})).pipe(
      mapTo(tokenPair.access)
    );
  }

  login(credential: {username: string, password: string}) {
    // make a post request here
    return this.httpClient.post(`${this.baseUrl}/token/`, credential).pipe(
      take(1),
      map((res: {refresh: string, access: string}) => {
        return res;
      }),
      switchMap(tokenPair => {
        this.tokens.next(tokenPair);

        return this.handleTokenPair(tokenPair);
      })
    );
  }

  private refreshToken(refreshToken: string): Observable<string> {
    return this.httpClient.post(`${this.baseUrl}/token/refresh/`, {refresh: refreshToken}).pipe(
      map(r => r as {access: string}),
      mergeMap(r => {
        return this.tokenPair.pipe(
          map(tp => ({access: r.access, tokenPair: tp}))
        );
      }),
      switchMap(r => {
        const tokenPair = r.tokenPair;
        tokenPair.access = r.access;

        this.tokens.next(tokenPair);

        console.log('Refreshed token!');
        return this.handleTokenPair(tokenPair);
      })
    );
  }

  getValidToken(): Observable<string> {
    return this.tokenPair.pipe(
      take(1),
      switchMap(tokenPair => {
        const accessToken = tokenPair.access;
        const refreshToken = tokenPair.refresh;

        if (accessToken) {
          if (!helper.isTokenExpired(accessToken, 10)) {
            // accessToken is valid so lets use it
            return of(accessToken);
          } else {
            // access token is invalid --> let's try to refresh
            if (!helper.isTokenExpired(refreshToken, 10)) {
              return this.refreshToken(refreshToken);
            }
          }
        }
    
        console.error('We have no tokens --> We definitively have to login');
        throw new Error('Login required');
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
