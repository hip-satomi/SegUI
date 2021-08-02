import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';

import { ImageSetListPage } from './image-set-list.page';

describe('ImageSetListPage', () => {
  let component: ImageSetListPage;
  let fixture: ComponentFixture<ImageSetListPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ImageSetListPage ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageSetListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
