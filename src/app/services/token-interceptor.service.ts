import { CsrfService } from './csrf.service';
import { catchError, delayWhen, retryWhen, shareReplay, switchMap, tap, map, concatMap, mergeMap, take, delay } from 'rxjs/operators';
import { AuthService, NoValidTokenException } from './auth.service';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, merge, timer, from, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { OmeroAuthService } from './omero-auth.service';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {

  constructor(private authService: AuthService,
              private csrfService: CsrfService,
              private toastController: ToastController,
              private omeroAuthService: OmeroAuthService) { }

  loginAttempts = 2;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    return next.handle(req)
    .pipe(
      catchError(err => {
        if ([401, 403].includes(err.status) && this.authService.user) {
            // auto logout if 401 or 403 response returned from api
            this.authService.logout();
            this.showAuthNotValid();
        }

        if(err.status == 404 && err.url.includes('webclient/login/')) {
          // authentication service redirects because of expired token
          this.authService.logout();
          this.showAuthNotValid();
        }

        const error = (err && err.error && err.error.message) || err.statusText;
        console.error(err);
        return throwError(error);
      }));

    /*if (req.url.startsWith('assets')) {
      return next.handle(req);
    }

    if (req.url.match('/api/token')) {
      // do not ask for a token if we are managing the tokens right now
      return next.handle(req);
    }

    if (req.url.match('^/omero/api/token')) {
      return next.handle(req);
    }

    if (req.url.match('^/omero/api/login')) {
      // special handling of login api: force new token
      return this.csrfService.getToken(true).pipe(
        switchMap((token: string) => {
          console.log(`token: ${token}`);
          const newRequest = req.clone({ setHeaders: {'X-CSRFToken': token}, body: req.body});
          return next.handle(newRequest);
        })
      );
    }

    if (req.url.match('^/omero')) {
      return this.csrfService.getToken().pipe(
        switchMap((token: string) => {
          console.log(`token: ${token}`);
          const newRequest = req.clone({ setHeaders: {'X-CSRFToken': token}, body: req.body});
          return next.handle(newRequest);
        }),
        // make sure the refresh timer is running! (so that the session cookie does not expire)
        tap(() => this.omeroAuthService.startRefreshTokenTimer())
      ).pipe(
        catchError(err => {
          if ([401, 403].includes(err.status) && this.authService.user) {
              // auto logout if 401 or 403 response returned from api
              this.authService.logout();
              this.showAuthNotValid();
          }

          if(err.status == 404 && err.url.includes('webclient/login/')) {
            // authentication service redirects because of expired token
            this.authService.logout();
            this.showAuthNotValid();
          }

          const error = (err && err.error && err.error.message) || err.statusText;
          console.error(err);
          return throwError(error);
        }));
    } else if (req.url.match('^/pt') || req.url.match('^/tf') || req.url.match('^/tracking')) {
      return next.handle(req);
    } else {
      // use custom backend
      return this.authService.getValidToken().pipe(
        map(token => req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })),
        concatMap(authReq => next.handle(authReq)),
        retryWhen((errors: Observable<any>) => errors.pipe(
          mergeMap((error, index) => {
            // we can handle only Unauthroized errors
            if (!(error instanceof NoValidTokenException) && error.status !== 401) {
              return throwError(error);
            }

            // check whether we are inside login attempts
            if (index < this.loginAttempts) {
              // show alert login dialog and wait for the result
              return this.authService.showAlertLogin({index, totalAvailable: this.loginAttempts});
            }

            // if we have too many false logins --> logout
            this.authService.logout();
            return throwError(error);
          }),
          take(this.loginAttempts + 1)
        )
        ));
    }*/
  }

  showAuthNotValid() {
    this.toastController.create({
      message: 'Your authentication has expired! Please login again!',
      duration: 5000
    }).then(toast => toast.present());
  }
}
