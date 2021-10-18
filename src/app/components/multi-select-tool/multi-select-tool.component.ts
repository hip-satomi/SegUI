import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { JointAction, RemovePolygon, Action, ChangePolygonPoints } from 'src/app/models/action';
import { Pencil, Tool } from 'src/app/models/drawing';
import { Point, Polygon, Rectangle } from 'src/app/models/geometry';
import { SegmentationData } from 'src/app/models/segmentation-data';
import { GlobalSegmentationModel, LocalSegmentationModel, SegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { Position, Utils } from 'src/app/models/utils';

@Component({
  selector: 'app-multi-select-tool',
  templateUrl: './multi-select-tool.component.html',
  styleUrls: ['./multi-select-tool.component.scss'],
})
export class MultiSelectToolComponent extends Tool {

  constructor() {
    super();
  }

  @Output() changedEvent = new EventEmitter<void>();

  @Input()
  localSegModel: LocalSegmentationModel;
  @Input()
  globalSegModel: GlobalSegmentationModel;
  _segUI: SegmentationUI;
  ctx;
  canvasElement;
  @Input() set segUI(segUI: SegmentationUI) {
    this._segUI = segUI;

    // TODO: notify changes
    this.changedEvent.emit();
  }

  get segUI() {
    return this._segUI;
  }

  pointerPos: Position;
  rectangleStartPos: Position;
  rectangleEndPos: Position;

  rectangle: Polygon;

  brushActivated = false;
  oldPoints: Point[];
  radius = 2;

  increase = true;
  dirty = false;

  simplificationTolerance = 0.2;


  delete(): boolean {
      if (!this.rectangle) {
          return false;
      }

      const actions: Action<SegmentationData>[] = [];
      // TODO more efficient with rtree
      for (const [uuid, poly] of this.localSegModel.segmentationData.getPolygonEntries()) {
          if (this.rectangle.isInside(poly.center)) {
              actions.push(new RemovePolygon(uuid));
          }
      }

      this.localSegModel.addAction(new JointAction(...actions));

      return true;
  }

  get currentPolygon(): Polygon {
      return this.localSegModel.activePolygon;
  }

  /**
   * Updates segmentation model and resets the brush tool
   * @param segModel the new segmentation model
   */
  setModel(segModel: LocalSegmentationModel, segUI: SegmentationUI) {
      this.localSegModel = segModel;
      this.segUI = segUI;
  }

  prepareDraw()  {
      return this.segUI.prepareDraw().pipe(
          switchMap(() => of(this))
      );
  }

  /**
   * Draw the segmentation using the brushed view
   * @param ctx the canvas context to draw
   */
  draw(pencil: Pencil): void {
      pencil.clear();

      const ctx = pencil.canvasCtx;
      this.ctx = ctx;
      this.canvasElement = pencil.canvasElement;
      ctx.font = '30px Arial';

      ctx.strokeStyle = 'rgb(255, 0, 0)';
      ctx.fillText('Rectangle Tool', 10, 50);

      if (this.rectangle) {
          ctx.strokeStyle = 'rgb(255, 0, 0)';
          ctx.fillStyle = 'rgb(255, 0, 0, 0.2)';
          this.rectangle.draw(ctx);
          /*ctx.fillRect(this.rectangleStartPos.x,
              this.rectangleStartPos.y,
              this.rectangleEndPos.x - this.rectangleStartPos.x,
              this.rectangleEndPos.y - this.rectangleStartPos.y);*/
      }

      // 1. Draw all other detections
      this.segUI.drawPolygons(ctx, false, ([uuid, poly]) => {
          return !this.rectangle?.isInside(poly.center);
      });
      for (const [uuid, poly] of this.localSegModel.segmentationData.getPolygonEntries()) {
          if (this.rectangle?.isInside(poly.center)) {
              poly.draw(ctx, true);
          }
      }
      // 2. draw the backgound image
      this.segUI.drawImage(ctx);
  }

  /**
   * Handles pointer (mouse or toch) down events
   * Activates increase/decrease brush
   * 
   * @param event event
   */
  onPointerDown(event: any): boolean {
      return false;
  }

  /**
   * Handles pointer (mouse/touch) move events
   * Especially cares for live increasing and decreasing of the polygon shape
   * 
   * @param event event
   */
  onPointerMove(event: any): boolean {
      return false;
  }

  /**
   * 
   * @param event 
   */
  onPointerUp(event: any): boolean {
      return false;
  }

  onTap(event: any): boolean {
      this.brushActivated = false;

      return false;
  }

  onPress(event: any): boolean {
      // prevent brushing behavior but do not prevent default behavior
      this.brushActivated = false;
      return false;
  }
  onPanStart(event: any): boolean {
      event.preventDefault();
      this.brushActivated = true;
      this.rectangleStartPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

      // Notify change event
      this.changedEvent.emit();
      return true;
  }
  onPan(event: any): boolean {
      const pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
      
      this.rectangleEndPos = pointerPos;

      this.rectangle = new Rectangle(this.rectangleStartPos.x,
                                      this.rectangleStartPos.y,
                                      this.rectangleEndPos.x - this.rectangleStartPos.x,
                                      this.rectangleEndPos.y - this.rectangleStartPos.y);

      this.rectangle.setColor('rgba(255, 0, 0, 0.3)');

      // Notify change
      this.changedEvent.emit();
      return true;
  }

  onPanEnd(event: any): boolean {
      this.brushActivated = false;
      
      this.rectangleEndPos = null;
      this.rectangleStartPos = null;

      this.changedEvent.emit();
      return true;
  }

  onMove(event: any): boolean {
      return true;
  }

  commitChanges() {
      if (this.dirty) {
          // only add actions if we have changed something
          this.localSegModel.addAction(new ChangePolygonPoints(this.currentPolygon.points,
                                  this.localSegModel.activePolygonId));
      }
      this.dirty = false;

      this.changedEvent.emit();
  }

  stop() {
      this.commitChanges();
  }

  /**
   * Is called when the user presses Enter or clicks the tick button
   * 
   * Creates a new polygon
   */
  save() {
      // TODO: Default label?
      this.localSegModel.addNewPolygon(0);
  }

  get canSave() {
      return true;
  }

  get canUndo() {
      return this.globalSegModel.canUndo;
  }

  get canRedo() {
      return this.globalSegModel.canRedo;
  }

  undo() {
      return this.globalSegModel.undo();
  }

  redo() {
      return this.globalSegModel.redo();
  }  

}
