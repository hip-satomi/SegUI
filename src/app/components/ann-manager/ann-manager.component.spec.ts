import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { GlobalSegmentationModel } from 'src/app/models/segmentation-model';

import { AnnManagerComponent } from './ann-manager.component';

describe('AnnManagerComponent', () => {
  let component: AnnManagerComponent;
  let fixture: ComponentFixture<AnnManagerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AnnManagerComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnManagerComponent);
    component = fixture.componentInstance;
    component.globalSegModel = new GlobalSegmentationModel(null, 10);
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
