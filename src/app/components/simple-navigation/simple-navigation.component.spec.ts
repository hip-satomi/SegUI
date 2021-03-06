import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';

import { SimpleNavigationComponent } from './simple-navigation.component';

describe('SimpleNavigationComponent', () => {
  let component: SimpleNavigationComponent;
  let fixture: ComponentFixture<SimpleNavigationComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SimpleNavigationComponent ],
      imports: [IonicModule.forRoot(), RouterTestingModule, MatTooltipModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
