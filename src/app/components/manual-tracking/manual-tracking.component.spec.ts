import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';

import { ManualTrackingComponent } from './manual-tracking.component';

describe('ManualTrackingComponent', () => {
  let component: ManualTrackingComponent;
  let fixture: ComponentFixture<ManualTrackingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ManualTrackingComponent ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, MatTooltipModule, FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ManualTrackingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
