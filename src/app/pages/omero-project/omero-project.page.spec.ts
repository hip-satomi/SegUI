import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { OmeroProjectPage } from './omero-project.page';

describe('OmeroProjectPage', () => {
  let component: OmeroProjectPage;
  let fixture: ComponentFixture<OmeroProjectPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroProjectPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(OmeroProjectPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
