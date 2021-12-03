import { OmeroAuthService } from './../services/omero-auth.service';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from './../services/auth.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  credentials = {
    username: '',
    password: ''
  };

  redirectUrl = '';

  version$: Observable<string>;

  constructor(
    private auth: AuthService,
    private omeroAuth: OmeroAuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private route: ActivatedRoute,
    private httpClient: HttpClient
  ) {
    this.version$ = this.httpClient.get('assets/info.json').pipe(
      tap(data => console.log(data)),
      map(data => data['version']),
      tap(version => console.log(version))
    );
  }

  ngOnInit() {
    this.route.queryParams.subscribe(
      params => {
        console.log(params);

        this.credentials.username = params['u'] || '';
        this.credentials.password = params['p'] || '';
        this.redirectUrl = params['r'] || null;

        if(this.credentials.username !== '' && this.credentials.password !== '') {
          this.login();
        }
      }
    )
  }

  login() {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Logging in...',
    }).then(l => {l.present(); return l; });
    
    this.omeroAuth.login(this.credentials).subscribe(async res => {
      if (res) {
        if (this.redirectUrl) {
          // redirect if possible
          this.router.navigateByUrl(this.redirectUrl);
        } else {
          this.router.navigateByUrl('/omero-dashboard');
        }
      } else {
        const alert = await this.alertCtrl.create({
          header: 'Login Failed',
          message: 'Wrong credentails.',
          buttons: ['OK']
        });
      }
    }, (err) => {
      // now we have the id of the image set
      console.log(err);
      const toast = this.toastCtrl.create({
        message: JSON.stringify(err),
        duration: 2000
      }).then((toast) => toast.present());
      loading.then(l => l.dismiss());
    },
    () => loading.then(l => l.dismiss()));
  }

}
