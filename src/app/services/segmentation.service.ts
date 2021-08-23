import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

/**
 * Contour REST structure
 */
export interface Contour {
  x: Array<number>;
  y: Array<number>;
}

/**
 * Detection REST structure
 */
export interface Detection {
  label: string;
  bbox: [number, number, number, number];
  contours: Array<Contour>;
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class SegmentationService {

  constructor(private httpClient: HttpClient) { }

  public requestCSSegmentationProposal(imageBlob) {
    // put the binary image data into form data
    const fd = new FormData();
    fd.append('data', imageBlob);

    // post this to a segmentation service
    return this.httpClient.post('/tf/predictions/cellcmaskrcnn/', fd).pipe(
      map(data => data as Array<Detection>)
    );
  }

  public requestJSSegmentationProposal(imageBlob, score_thr = 0.4) {
    // put the binary image data into form data
    const fd = new FormData();
    fd.append('data', imageBlob);
    fd.append('test_cfg.rcnn.score_thr', `${score_thr}`)

    // post this to a segmentation service
    return this.httpClient.post('/pt/predictions/cellcmaskrcnn/', fd).pipe(
      map(data => data as Array<Detection>)
    );
  }
}
