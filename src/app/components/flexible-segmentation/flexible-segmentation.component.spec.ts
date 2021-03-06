import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { MockStorage } from 'src/app/services/storage.service.spec';

import { FlexibleSegmentationComponent } from './flexible-segmentation.component';

describe('FlexibleSegmentationComponent', () => {
  let component: FlexibleSegmentationComponent;
  let fixture: ComponentFixture<FlexibleSegmentationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FlexibleSegmentationComponent ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, MatTooltipModule, IonicStorageModule.forRoot()],
      providers: [
        {
          provide: Storage,
          useClass: MockStorage
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FlexibleSegmentationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
