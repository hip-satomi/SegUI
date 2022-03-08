import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';

import { PermissionVizComponent } from './permission-viz.component';

describe('PermissionVizComponent', () => {
  let component: PermissionVizComponent;
  let fixture: ComponentFixture<PermissionVizComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PermissionVizComponent ],
      imports: [IonicModule.forRoot(), MatTooltipModule]
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionVizComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
