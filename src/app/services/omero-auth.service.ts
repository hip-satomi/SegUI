import { Router } from '@angular/router';
import { Platform, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, from, interval, Observable, of } from 'rxjs';
import { Injectable } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { switchMap, map, tap } from 'rxjs/operators';
import * as dayjs from 'dayjs';

const { Storage } = Plugins;

const helper = new JwtHelperService();
const TOKEN_KEY = 'jwt-token';

interface User {
  userName: string;
  eventId: number;
  sessionUuid: string;
  eventType: string;
  userId: number;
  sessionId: number;
  groupName: string;
  isAdmin: boolean;
  memberOfGroups: Array<number>;
  leaderOfGroups: Array<number>;
  groupId: number;
}

interface LoginResponse {
  eventContext: User;
  success: boolean;
}

export interface DataResponse<T> {
  data: T;
}

export interface DataListResponse<T> {
  data: Array<T>;
}

interface Server {
  host: string;
  server: string;
  id: number;
  port: number;
}

export class NoValidTokenException extends Error {
  constructor() {
    super('No valid token available');
  }
}

export class LoginFailedException extends Error {
  constructor() {
    super('Login failed on the server');
  }
}

export class NoServerAvailableException extends Error {
  constructor() {
    super('No omero server available');
  }
}


@Injectable({
  providedIn: 'root'
})
export class OmeroAuthService {
  // observable that provides user data
  public user = new BehaviorSubject<User>(null);

  private server$: Observable<number>;

  private refreshTokenTimeout;

  constructor(private httpClient: HttpClient,
              private plt: Platform,
              private router: Router,
              private alertController: AlertController) {

      this.server$ = this.httpClient.get('omero/api/servers/').pipe(
        map((r: DataListResponse<Server>) => {
          if (r.data.length === 0) {
            throw new NoServerAvailableException();
          }

          return r.data[0].id;
        })
      );
  }

  /**
   * Login with username and password
   * 
   * returns observable to access token string
   * @param credential contains username and password
   */
  login(credential: {username: string, password: string}) {
    // make a post request for login
    return this.server$.pipe(
      switchMap((serverId: number) => {
        const body = new FormData();
        body.append('username', credential.username);
        body.append('password', credential.password);
        body.append('server', `${serverId}`);
        return this.httpClient.post('omero/api/login/', body).pipe(
          tap((r: LoginResponse) => {
            if (r.success === false) {
              throw new LoginFailedException();
            }
          }),
          tap((r: LoginResponse) => {
            this.updateUser(r.eventContext);
          }),
          map((r: LoginResponse) => r.eventContext)
        );
      })
    );
  }

  updateUser(user: User) {
    this.user.next(user);
  }

  logout() {
    Storage.remove({key: TOKEN_KEY}).then(() => {
      this.router.navigateByUrl('/');
      this.updateUser(null);
    });
  }
}
