import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { SharedComponentsModule } from 'src/app/shared-components-module/shared-components.module';

import { OmeroDashboardPage } from './omero-dashboard.page';

describe('OmeroDashboardPage', () => {
  let component: OmeroDashboardPage;
  let fixture: ComponentFixture<OmeroDashboardPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ OmeroDashboardPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, SharedComponentsModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(OmeroDashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
