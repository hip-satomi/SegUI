import { OverlayModule } from '@angular/cdk/overlay';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { EMPTY, of } from 'rxjs';
import { OmeroAuthService } from '../services/omero-auth.service';
import { MockStorage } from '../services/storage.service.spec';
import { SharedComponentsModule } from '../shared-components-module/shared-components.module';
import { HomePageModule } from './home.module';

import { HomePage } from './home.page';

class MockAuthService {
  // mock the loggedIn behavior
  public loggedIn$ = of(true);
}
class MockActivatedRoute {
  // here you can add your mock objects, like snapshot or parent or whatever
  // example:
  parent = {
    snapshot: {data: {title: 'myTitle ' } },
    routeConfig: { children: { filter: () => {} } }
  };
  // Empty param map in test --> no loading of image data
  public paramMap = EMPTY;
}


describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HomePage ],
      imports: [IonicModule.forRoot(), RouterTestingModule, HttpClientTestingModule, MatTooltipModule, OverlayModule, SharedComponentsModule, IonicStorageModule.forRoot()],
      providers: [
        {
          provide: ActivatedRoute,
          useClass: MockActivatedRoute
        },
        {
          provide: OmeroAuthService,
          useClass: MockAuthService
        },
        {
          provide: Storage,
          useClass: MockStorage
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
