import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { EMPTY } from 'rxjs';

import { AiConfigPage } from './ai-config.page';

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


describe('AiConfigPage', () => {
  let component: AiConfigPage;
  let fixture: ComponentFixture<AiConfigPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AiConfigPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useClass: MockActivatedRoute
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AiConfigPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
