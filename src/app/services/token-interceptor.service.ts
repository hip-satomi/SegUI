import { catchError, tap} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { NavigationExtras, Router } from '@angular/router';
import { OmeroAuthService } from './omero-auth.service';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {

  constructor(private omeroAuthService: OmeroAuthService,
              private toastController: ToastController,
              private router: Router) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    return next.handle(req)
    .pipe(
      tap(() => console.log(this.router.url)),
      catchError(err => {
        if ([401, 403].includes(err.status) && this.omeroAuthService.user) {
          // auto logout if 401 or 403 response returned from api
          this.relogin();
          this.showAuthNotValid();
        }

        if(err.status == 404 && err.url.includes('webclient/login/')) {
          // authentication service redirects because of expired token
          this.relogin();
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
  relogin() {
    let navigationExtras: NavigationExtras = {
      queryParams: {
        r: this.router.url
      }
    };
    this.router.navigateByUrl('/', navigationExtras);
  }
}
