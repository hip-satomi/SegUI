import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';

import { AnnLabelChipComponent } from './ann-label-chip.component';

describe('AnnLabelChipComponent', () => {
  let component: AnnLabelChipComponent;
  let fixture: ComponentFixture<AnnLabelChipComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AnnLabelChipComponent ],
      imports: [IonicModule.forRoot(), MatTooltipModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnLabelChipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
