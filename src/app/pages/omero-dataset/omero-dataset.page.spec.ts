import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';
import { SharedComponentsModule } from 'src/app/shared-components-module/shared-components.module';

import { OmeroDatasetPage } from './omero-dataset.page';

class MockActivatedRoute {
  // here you can add your mock objects, like snapshot or parent or whatever
  // example:
  public paramMap = of(convertToParamMap(
    {
      id: 1
    }
  ));
}

describe('OmeroDatasetPage', () => {
  let component: OmeroDatasetPage;
  let fixture: ComponentFixture<OmeroDatasetPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroDatasetPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, SharedComponentsModule, RouterTestingModule],
      providers: [{provide: ActivatedRoute, useClass: MockActivatedRoute }]
    }).compileComponents();

    fixture = TestBed.createComponent(OmeroDatasetPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
