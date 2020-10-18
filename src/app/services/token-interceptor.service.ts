import { catchError, delayWhen, retryWhen, shareReplay, switchMap, tap, map, concatMap, mergeMap, take, delay } from 'rxjs/operators';
import { AuthService, NoValidTokenException } from './auth.service';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, merge, timer, from, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {

  constructor(private authService: AuthService) { }

  loginAttempts = 2;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (req.url.match('^/api/token')) {
      // do not ask for a token if we are managing the tokens right now
      return next.handle(req);
    }

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
  }
}
