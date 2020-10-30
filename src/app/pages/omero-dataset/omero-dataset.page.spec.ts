import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { OmeroDatasetPage } from './omero-dataset.page';

describe('OmeroDatasetPage', () => {
  let component: OmeroDatasetPage;
  let fixture: ComponentFixture<OmeroDatasetPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroDatasetPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(OmeroDatasetPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
