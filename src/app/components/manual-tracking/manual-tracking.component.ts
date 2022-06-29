import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Drawer, Pencil, Tool } from 'src/app/models/drawing';
import { SegmentationUI } from 'src/app/models/segmentation-ui';

@Component({
  selector: 'app-manual-tracking',
  templateUrl: './manual-tracking.component.html',
  styleUrls: ['./manual-tracking.component.scss'],
})
export class ManualTrackingComponent extends Tool implements Drawer, OnInit {

  _segUI: SegmentationUI;

  /** Drawing elements */
  ctx;
  canvasElement;
  pencil: Pencil;


  @Output() changedEvent = new EventEmitter<void>();


  @Input() set segUI(value: SegmentationUI) {
      this._segUI = value;
      this.changedEvent.emit();
  }

  get segUI() {
      return this._segUI;
  }


  constructor() {
    super("ManualTrackingTool");

    this.changedEvent
  }

  ngOnInit() {}

  prepareDraw(): Observable<Drawer> {
    return this.segUI.prepareDraw().pipe(
      switchMap(() => of(this))
    );
  }

  /**
   * Draw the segmentation using the brushed view
   * @param ctx the canvas context to draw
   */
  draw(pencil: Pencil = null): void {
    if (pencil) {
        this.pencil = pencil;
        this.ctx = pencil.canvasCtx;
        this.canvasElement = pencil.canvasElement;
    } else {
        // if no new pencil is used we fallback to last one
        pencil = this.pencil;
    }

    // clear the view
    pencil.clear();

    const ctx = pencil.canvasCtx;

    this.segUI.drawPolygons(ctx, true);
    // 2. draw the backgound image
    this.segUI.drawImage(ctx);
  }
}
