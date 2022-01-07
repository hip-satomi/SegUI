import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { combineAll, concatAll, concatMap, map, mergeMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-animated-preview',
  templateUrl: './animated-preview.component.html',
  styleUrls: ['./animated-preview.component.scss'],
})
export class AnimatedPreviewComponent implements OnInit, AfterViewInit {

  @ViewChild('slider') slider;

  slideOpts = {
    autoplay: {
      delay:	1000,
    },
    preloadImages: false,
    lazy: true
  }

  @Input() urlList: string[] = [2,3,4].map((imageId: number) => `omero/webclient/render_thumbnail/${imageId}/?version=0`);

  constructor() { }
  ngAfterViewInit(): void {
    this.stopAutoPlay();
  }

  ngOnInit() {
  }

  startAutoPlay() {
    this.slider.startAutoplay();
    console.log('start auto');
  }

  stopAutoPlay() {
    this.slider.stopAutoplay();
    console.log('stop auto');
  }

}
