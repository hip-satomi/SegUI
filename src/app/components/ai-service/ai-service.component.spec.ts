import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';
import { AIService } from 'src/app/services/aiconfig.service';

import { AiServiceComponent } from './ai-service.component';

describe('AiServiceComponent', () => {
  let component: AiServiceComponent;
  let fixture: ComponentFixture<AiServiceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AiServiceComponent ],
      imports: [IonicModule.forRoot(), MatTooltipModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AiServiceComponent);
    component = fixture.componentInstance;
    component.service = new AIService("", "", "", "", "", {});
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
