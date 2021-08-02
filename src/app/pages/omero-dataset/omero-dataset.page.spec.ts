import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';

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

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroDatasetPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule],
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
