import { catchError, switchMap, tap, throttleTime} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { HttpClient, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { NavigationExtras, Router } from '@angular/router';
import { OmeroAuthService } from './omero-auth.service';
import { UserQuestionsService } from './user-questions.service';
import { CookieService } from 'ngx-cookie-service';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {

  relogin$ = new Subject();
  unknownConErrors$ = new Subject();

  constructor(private omeroAuthService: OmeroAuthService,
              private userQuestionService: UserQuestionsService,
              private router: Router,
              private cookieService: CookieService,
              private httpClient: HttpClient) {

    // listen for relogin events and call the specific function
    this.relogin$.pipe(
      // throttle for 5s
      throttleTime(5000),
      tap(() => this.__relogin())
    ).subscribe();

    this.unknownConErrors$.pipe(
      // throttle for 5s
      throttleTime(5000),
      tap(() => {
        this.userQuestionService.showError("We are experience connection problems! Please check your internet connection or contact your admin!", 5000);
      })
    ).subscribe();
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.cookieService.check('csrftoken') && !req.url.startsWith('omero/api/token/')) {
      console.log('We do not have a valid csrf token yet');
      // TODO: /api/v0/token/
      return this.httpClient.get('omero/api/token/').pipe(
        switchMap(() => {
          return next.handle(req);
        })
      )
    }

    return next.handle(req)
    .pipe(
      tap(() => console.log(this.router.url)),
      catchError(err => {
        if ([401, 403].includes(err.status) && this.omeroAuthService.user) {
          // auto logout if 401 or 403 response returned from api
          this.relogin$.next();
          this.showAuthNotValid();
        } else if(err.status == 404 && err.url.includes('webclient/login/')) {
          // authentication service redirects because of expired token
          this.relogin$.next();
          this.showAuthNotValid();
        } else {
          // unknown connectivity issues
          this.unknownConErrors$.next(err);
        }

        const error = (err && err.error && err.error.message) || err.statusText;
        console.error(err);
        return throwError(error);
      }));
  }

  showAuthNotValid() {
    this.userQuestionService.showError('Your authentication has expired! Please login again!', 5000);
  }

  /**
   * Just navigate to the login page with old url as redirect param
   */
  __relogin() {
    let navigationExtras: NavigationExtras = {
      queryParams: {
        r: this.router.url
      }
    };
    this.router.navigate(['login'], navigationExtras)
  }
}
