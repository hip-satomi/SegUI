import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { AIService } from 'src/app/services/aiconfig.service';
import { MockStorage } from 'src/app/services/storage.service.spec';
import { Storage } from '@ionic/storage';

import { AiServiceComponent } from './ai-service.component';

describe('AiServiceComponent', () => {
  let component: AiServiceComponent;
  let fixture: ComponentFixture<AiServiceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AiServiceComponent ],
      imports: [IonicModule.forRoot(), MatTooltipModule, HttpClientTestingModule, IonicStorageModule.forRoot()],
      providers: [
        {
          provide: Storage,
          useClass: MockStorage
        }
      ]
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
