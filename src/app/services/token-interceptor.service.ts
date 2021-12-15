import { catchError, delayWhen, retryWhen, shareReplay, switchMap, tap, map, concatMap, mergeMap, take, delay } from 'rxjs/operators';
import { AuthService, NoValidTokenException } from './auth.service';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, merge, timer, from, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { OmeroAuthService } from './omero-auth.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {

  constructor(private authService: AuthService,
              private toastController: ToastController,
              private router: Router) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    return next.handle(req)
    .pipe(
      tap(() => console.log(this.router.url)),
      catchError(err => {
        if ([401, 403].includes(err.status) && this.authService.user) {
            // auto logout if 401 or 403 response returned from api
            this.authService.logout(this.router.url);
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
  }

  showAuthNotValid() {
    this.toastController.create({
      message: 'Your authentication has expired! Please login again!',
      duration: 5000
    }).then(toast => toast.present());
  }
}
