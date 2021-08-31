import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';

import { BrushComponent } from './brush.component';

describe('BrushComponent', () => {
  let component: BrushComponent;
  let fixture: ComponentFixture<BrushComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BrushComponent ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, MatTooltipModule]
    }).compileComponents();

    fixture = TestBed.createComponent(BrushComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
