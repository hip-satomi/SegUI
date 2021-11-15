import { HttpClientTestingModule } from '@angular/common/http/testing';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { Image, Pixel } from 'src/app/services/omero-api.service';

import { ImageCardComponent } from './image-card.component';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let fixture: ComponentFixture<ImageCardComponent>;

  const testImage = new Image();
  testImage.id = 463;
  testImage.name = 'Test Image';
  testImage.pixels = new Pixel();
  testImage.pixels.sizeZ = 2;
  testImage.pixels.sizeT = 10;


  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ImageCardComponent ],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageCardComponent);
    component = fixture.componentInstance;
    component.image = testImage;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calc num images', () => {
    expect(component.numImages).toEqual(testImage.pixels.sizeZ*testImage.pixels.sizeT);
  })
});
