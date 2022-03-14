import { OmeroAuthService } from '../../services/omero-auth.service';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize, map, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { UserQuestionsService } from '../../services/user-questions.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  /** login credentials */
  credentials = {
    username: '',
    password: ''
  };

  /** redirection url after login */
  redirectUrl = '';

  /** pipeline for software version */
  version$: Observable<string>;

  constructor(
    private omeroAuth: OmeroAuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private route: ActivatedRoute,
    private httpClient: HttpClient,
    private questionService: UserQuestionsService,
  ) {
    // get the software version from assets
    this.version$ = this.httpClient.get('assets/info.json').pipe(
      tap(data => console.log(data)),
      map(data => data['version']),
      tap(version => console.log(version))
    );
  }

  ngOnInit() {
    // try to prefill credentials from url
    this.route.queryParams.subscribe(
      params => {
        console.log(params);

        // u --> sepcifies user name
        this.credentials.username = params['u'] || '';
        // p --> can specify password (possibly unsafe)
        this.credentials.password = params['p'] || '';
        // r --> specifies redirection route
        this.redirectUrl = params['r'] || '';

        // if both password and username are specified we directly try to login
        if(this.credentials.username !== '' && this.credentials.password !== '') {
          this.login();
        }
      }
    )
  }

  /**
   * Login with specified user credentials and move forward
   */
  login() {
    // create progress loader
    const loading = this.loadingCtrl.create({
      message: 'Logging in...',
    }).then(l => {l.present(); return l; });
    
    this.omeroAuth.login(this.credentials).pipe(
      finalize(() => loading.then(l => l.dismiss()))
    ).subscribe(() => {
        // successfully logged in --> move to next page
        this.moveToNextPage();
    }, (err) => {
      // show the error
      console.log(err);
      this.questionService.showError(JSON.stringify(err), 5000);
    });
  }

  get loggedIn$() {
    return this.omeroAuth.loggedIn$;
  }

  /**
   * Moves to the next page in line. If no redirect is specified that is the dashboard. Otherwise try to redirect to specified url.
   */
  moveToNextPage() {
    if (this.redirectUrl != '') {
      // redirect if possible
      this.router.navigateByUrl(this.redirectUrl);
    } else {
      // redirect to dashboard
      this.router.navigateByUrl('/omero-dashboard');
    }
  }

}
