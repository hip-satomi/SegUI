import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { AiConfigPage } from './ai-config.page';

describe('AiConfigPage', () => {
  let component: AiConfigPage;
  let fixture: ComponentFixture<AiConfigPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AiConfigPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(AiConfigPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
