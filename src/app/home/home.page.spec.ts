import { OverlayModule } from '@angular/cdk/overlay';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { HomePageModule } from './home.module';

import { HomePage } from './home.page';

class MockActivatedRoute {
  // here you can add your mock objects, like snapshot or parent or whatever
  // example:
  parent = {
    snapshot: {data: {title: 'myTitle ' } },
    routeConfig: { children: { filter: () => {} } }
  };
}


describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HomePage ],
      imports: [IonicModule.forRoot(), RouterTestingModule, HttpClientTestingModule, MatTooltipModule, OverlayModule],
      providers: [{provide: ActivatedRoute, useClass: MockActivatedRoute }]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
