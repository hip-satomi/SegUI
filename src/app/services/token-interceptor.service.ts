import { catchError, tap, throttleTime} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { NavigationExtras, Router } from '@angular/router';
import { OmeroAuthService } from './omero-auth.service';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {

  relogin$ = new Subject();

  constructor(private omeroAuthService: OmeroAuthService,
              private toastController: ToastController,
              private router: Router) {

                // listen for relogin events and call the specific function
                this.relogin$.pipe(
                  // throttle for 5s
                  throttleTime(5000),
                  tap(() => this.__relogin())
                ).subscribe();
              }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    return next.handle(req)
    .pipe(
      tap(() => console.log(this.router.url)),
      catchError(err => {
        if ([401, 403].includes(err.status) && this.omeroAuthService.user) {
          // auto logout if 401 or 403 response returned from api
          this.relogin$.next();
          this.showAuthNotValid();
        }

        if(err.status == 404 && err.url.includes('webclient/login/')) {
          // authentication service redirects because of expired token
          this.relogin$.next();
          this.showAuthNotValid();
        }

        const error = (err && err.error && err.error.message) || err.statusText;
        console.error(err);
        return throwError(error);
      }));
  }

  showAuthNotValid() {
    this.toastController.create({
      message: 'Your authentication has expired! Please login again!',
      duration: 5000
    }).then(toast => toast.present());
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
