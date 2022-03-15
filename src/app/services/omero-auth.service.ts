import { Router } from '@angular/router';
import { Platform, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, from, interval, Observable, of, ReplaySubject } from 'rxjs';
import { Injectable } from '@angular/core';

import { Plugins } from '@capacitor/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { switchMap, map, tap, catchError, finalize, share, take } from 'rxjs/operators';
import * as dayjs from 'dayjs';

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
  public loggedIn$;
  public loggedIn = false;
  private initialCheck = false;


  /**
   * Sends keep-alive request to the server. If the request fails, the user is not logged into the server backend!
   * 
   * @returns Observable(true) when the user is logged in, otherwise Observable(false)
   */
  keepAliveRequest(): Observable<boolean> {
    // send keep alive request
    return this.httpClient.get('omero/webclient/keepalive_ping/', {responseType: 'text'}).pipe(
      map((res) => {
        if(res === 'Connection Failed') {
          // when connection fails --> we are not logged in
          return false
        }
        // otherwise we are logged in
        return true;
      })
    );
  }

  private server$: Observable<number>;

  constructor(private httpClient: HttpClient,
              private router: Router) {

      this.server$ = this.httpClient.get('omero/api/servers/').pipe(
        map((r: DataListResponse<Server>) => {
          if (r.data.length === 0) {
            throw new NoServerAvailableException();
          }

          return r.data[0].id;
        })
      );

      this.loggedIn$ = of(1).pipe(
        switchMap(() => {
          // check whether login state has been initialized
          if(!this.initialCheck) {
            // it's not: we try to get login for the first time
            return this.keepAliveRequest().pipe(
              catchError(() => {
                return of(false)
              }),
              tap(loggedIn => this.loggedIn = loggedIn),
              finalize(() => {
                this.initialCheck = true;
              })
            )
          } else {
            // it has we just return it
            return of(this.loggedIn);
          }
        }),
      );

      // send a keep-alive request every 60 seconds (to prevent csrf-token timeout)
      interval(60 * 1000)
        .subscribe((val) => {
          // console.log('Keep csrf-token alive');
          this.keepAliveRequest().pipe(take(1))
            .subscribe((result) => this.loggedIn = result, () => this.loggedIn = false)
        });      
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
    if (user) {
      this.loggedIn = true;
    } else {
      this.loggedIn = false;
    }
    this.initialCheck = true;
  }

  logout() {
    this.router.navigateByUrl('/');
    this.updateUser(null);
  }
}
