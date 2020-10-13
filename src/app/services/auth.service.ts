import { Router } from '@angular/router';
import { Platform, AlertController } from '@ionic/angular';
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
  // observable that provides user data
  public user: Observable<any>;
  private userData = new BehaviorSubject<DecodedToken>(null);
  private refreshUserData = new BehaviorSubject<DecodedToken>(null);
  private tokens = new BehaviorSubject<TokenPair>(null);

  private tokenPair: Observable<TokenPair>;

  private baseUrl = '/api';// 'http://lara:8000/';

  constructor(private httpClient: HttpClient, private plt: Platform, private router: Router, private alertController: AlertController) {
    this.loadStoredToken();
  }

  /**
   * preloading the pipelines with stored tokens
   */
  private loadStoredToken() {
    // wait for the platform to be ready
    const platformObs = from(this.plt.ready());

    this.user = platformObs.pipe(
      // load tokens from storage
      switchMap(() => {
        return from(Storage.get({key: TOKEN_KEY})).pipe(
          map(val => JSON.parse(val.value) as {access: string, refresh: string})
        );
      }),
      // decode and send out user data
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
      // load tokens from storage or from memory
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

  /**
   * Updates the token pair in the storage and logging
   * 
   * returns observable to access token
   * @param tokenPair 
   */
  private handleTokenPair(tokenPair: TokenPair): Observable<string> {
    this.tokens.next(tokenPair);

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

  /**
   * Login with username and password
   * 
   * returns observable to access token string
   * @param credential contains username and password
   */
  login(credential: {username: string, password: string}) {
    // make a post request for tokens
    return this.httpClient.post(`${this.baseUrl}/token/`, credential).pipe(
      // convert type
      map((res: {refresh: string, access: string}) => {
        return res;
      }),
      // handle the new token pair
      switchMap(tokenPair => {
        return this.handleTokenPair(tokenPair);
      })
    );
  }

  /**
   * Acquire new access token using the refresh token
   * 
   * returns observable to access token string
   * @param refreshToken 
   */
  private refreshToken(refreshToken: string): Observable<string> {
    return this.httpClient.post(`${this.baseUrl}/token/refresh/`, {refresh: refreshToken}).pipe(
      // type result
      map(r => r as {access: string}),
      // add the current token pair
      mergeMap(r => {
        return this.tokenPair.pipe(
          take(1),
          map(tp => ({access: r.access, tokenPair: tp}))
        );
      }),
      // replace the access token with new and update the new token pair
      switchMap(r => {
        const tokenPair = r.tokenPair;
        tokenPair.access = r.access;

        console.log('Refreshed token!');
        return this.handleTokenPair(tokenPair);
      })
    );
  }

  /**
   * Tries to obtain a valid token
   * 
   * returns observable of access token string
   */
  getValidToken(): Observable<string> {
    // start with token pair
    return this.tokenPair.pipe(
      take(1),

      switchMap(tokenPair => {
        if (tokenPair) {
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
        }
        this.alertController.create({
          header: 'Authentication failure',
          message: 'The automatic authentication has failed. Please login again...',
          buttons: ['OK']
        }).then(a => a.present());
        console.error('We have no tokens --> We definitively have to login');
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
      this.tokens.next(null);
    });
  }
}
