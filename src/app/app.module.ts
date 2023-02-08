import { NgModule, Injectable } from '@angular/core';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { AngularResizedEventModule } from 'angular-resize-event';

import { HammerGestureConfig, HAMMER_GESTURE_CONFIG} from '@angular/platform-browser';

import {HttpClientModule, HttpClientXsrfModule, HttpXsrfTokenExtractor, HTTP_INTERCEPTORS} from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TokenInterceptorService } from './services/token-interceptor.service';

import { ColorPickerModule } from 'ngx-color-picker';
import { CookieService } from 'ngx-cookie-service';
import { IonicStorageModule } from '@ionic/storage-angular';

import { Drivers, Storage } from '@ionic/storage';
import { FormsModule } from '@angular/forms';
@Injectable({providedIn: 'root'})
export class MyHammerConfig extends HammerGestureConfig  {
  overrides = {
      // override hammerjs default configuration
      pan: {threshold: 2},
  };
}

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [BrowserModule, IonicModule.forRoot(),
            FormsModule,
            AppRoutingModule,
            AngularResizedEventModule,
            HammerModule,
            HttpClientModule,
            BrowserAnimationsModule,
            ColorPickerModule,
            HttpClientXsrfModule.withOptions({
              cookieName: 'csrftoken', // this is optional
              headerName: 'X-CSRFToken' // this is optional
            }),
            IonicStorageModule.forRoot()
          ],
  providers: [
    StatusBar,
    SplashScreen,
    CookieService,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: MyHammerConfig
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptorService,
      multi: true
    },
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
