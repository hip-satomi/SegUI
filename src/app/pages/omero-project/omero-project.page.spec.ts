import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';

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

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroProjectPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule],
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
