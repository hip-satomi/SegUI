import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';
import { SharedComponentsModule } from 'src/app/shared-components-module/shared-components.module';

import { OmeroProjectPage } from './omero-project.page';


class MockActivatedRoute {
  // here you can add your mock objects, like snapshot or parent or whatever
  // example:
  public paramMap = of(convertToParamMap(
    {
      id: 1
    }
  ));
}


describe('OmeroProjectPage', () => {
  let component: OmeroProjectPage;
  let fixture: ComponentFixture<OmeroProjectPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroProjectPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, SharedComponentsModule, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useClass: MockActivatedRoute
        }]
    }).compileComponents();

    fixture = TestBed.createComponent(OmeroProjectPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
