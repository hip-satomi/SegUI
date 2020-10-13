import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from './../services/auth.service';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

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

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
  ) { }

  ngOnInit() {
  }

  login() {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Logging in...',
    }).then(l => {l.present(); return l; });
    
    this.auth.login(this.credentials).subscribe(async res => {
      if (res) {
        this.router.navigateByUrl('/list');
      } else {
        const alert = await this.alertCtrl.create({
          header: 'Login Failed',
          message: 'Wrong credentails.',
          buttons: ['OK']
        });
      }
    }, (err) => {
      // now we have the id of the image set
      const toast = this.toastCtrl.create({
        message: JSON.stringify(err),
        duration: 2000
      }).then((toast) => toast.present());
    },
    () => loading.then(l => l.dismiss()));
  }

}
