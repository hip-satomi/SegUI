import { OmeroAuthService } from './../services/omero-auth.service';
import { take, map } from 'rxjs/operators';
import { AlertController } from '@ionic/angular';
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router,
              private omeroAuth: OmeroAuthService,
              private alertCtrl: AlertController) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> {

    /**
     * Returns observable(true) when the user is logged in.
     * Otherwise observable(false) and user is shown a dialog and navigated back to login page.
     */

    return this.omeroAuth.loggedIn$.pipe(
      take(1),
      map((loggedIn: boolean) => {
        if (!loggedIn) {
          this.alertCtrl.create({
            header: 'Unauthorized',
            message: 'You are not allowed to access that page! Please login first',
            buttons: ['OK']
          }).then(alert => alert.present());

          this.router.navigateByUrl('/');
          return false;
        } else {
          return true;
        }
      })
    );
  }

}
