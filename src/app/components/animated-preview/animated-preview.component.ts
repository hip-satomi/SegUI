import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';

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

  /** Urls for loading thumbnails for Omero project/dataset content */
  @Input() urlList: string[];

  constructor() { }
  ngAfterViewInit(): void {
    this.stopAutoPlay();
  }

  ngOnInit() {
  }

  startAutoPlay() {
    this.slider.startAutoplay();
    //console.log('start auto');
  }

  stopAutoPlay() {
    this.slider.stopAutoplay();
    //console.log('stop auto');
  }

}
