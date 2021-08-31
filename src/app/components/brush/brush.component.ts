import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { ChangePolygonPoints } from 'src/app/models/action';
import { Drawer, Pencil, UIInteraction } from 'src/app/models/drawing';
import { ApproxCircle, Point, Polygon, Rectangle } from 'src/app/models/geometry';
import { SegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { Position, Utils } from 'src/app/models/utils';
import { SegmentationService } from 'src/app/services/segmentation.service';
import { polygon } from 'polygon-tools';

const tree = require( 'tree-kit' ) ;


@Component({
  selector: 'app-brush',
  templateUrl: './brush.component.html',
  styleUrls: ['./brush.component.scss'],
})
export class BrushComponent extends UIInteraction implements Drawer, OnInit {

  @Output() close = new EventEmitter<void>();
  // input the current segmentation model and ui
  @Input() segModel: SegmentationModel;
  _segUI: SegmentationUI;

  @Input() set segUI(value: SegmentationUI) {
    this._segUI = value;
    this.changedEvent.emit();
  }

  get segUI() {
      return this._segUI;
  }

  pointerPos: Position;

  brushSize: number = 2;

  brushActivated = false;
  oldPoints: Point[];

  increase = true;
  dirty = false;

  ctx;
  canvasElement;
  pencil: Pencil;


  simplificationTolerance = 0.2;

  showOverlay = true;

  @Output()
  changedEvent = new EventEmitter<void>();

  constructor(private loadingCtrl: LoadingController,
    private httpClient: HttpClient,
    private segmentationService: SegmentationService,
    private toastController: ToastController) {
      super();

      //this.changedEvent.subscribe(() => console.log('Render'));
    }

  ngOnInit() {}

  /**
   * Prepare for Drawing (Drawer)
   */
  prepareDraw() {
    return this.segUI.prepareDraw().pipe(
      switchMap(() => of(this))
    );
  }

  get currentPolygon(): Polygon {
    return this.segModel.activePolygon;
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

      // TODO: why can the pencil be null?
      if(!pencil) {
          return;
      }

      pencil.clear();

      const ctx = pencil.canvasCtx;

      if (this.currentPolygon) {
          ctx.strokeStyle = this.currentPolygon.color;
      } else {
          ctx.strokeStyle = 'rgb(255, 0, 0)';
      }

      // draw the circle around the pointer
      if (this.pointerPos) {
          ctx.beginPath();
          ctx.arc(this.pointerPos.x, this.pointerPos.y, this.brushSize, 0, 2 * Math.PI);
          ctx.stroke();
      }

      // 1. Draw all other detections
      if (this.showOverlay) {
        this.segModel.drawPolygons(ctx, false);
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

      if (this.currentPolygon === null) {
          // add a new polygon if there is none selected
          this.segModel.addNewPolygon();
      }

      this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
      this.oldPoints = Utils.tree.clone(this.currentPolygon.points);

      if (this.currentPolygon.numPoints === 0) {
          this.increase = true;
      } else {
          const circle = new ApproxCircle(this.pointerPos.x, this.pointerPos.y, this.brushSize);
          let inter: Point[][];
          if (this.currentPolygon.numPoints === 0) {
              inter = [];
          } else {
              inter = polygon.intersection(this.currentPolygon.points, circle.points);
          }
          
          if (inter.length === 0 || event.button === 2) {
              this.increase = false;
          } else {
              this.increase = true;
          }
      }
      console.log('Brush mode increase?' + this.increase);

      // Notify change event
      this.changedEvent.emit();
      return true;
  }

  onPan(event: any): boolean {
      this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
      if (this.brushActivated) {
          this.dirty = true;
          const circle = new ApproxCircle(this.pointerPos.x, this.pointerPos.y, this.brushSize);

          // Increase/Decrease depending on selected mode
          if (this.increase) {
            this.currentPolygon.join(circle);
          } else {
              this.currentPolygon.subtract(circle);
          }

        // prevent segmentation outside of the image area
        const imagePolygon = new Rectangle(0, 0, this.segUI.imageWidth, this.segUI.imageHeight);
        const outsideOfAllowed = polygon.subtract(this.currentPolygon.points, imagePolygon.points);
        for (const pointList of outsideOfAllowed) {
            this.currentPolygon.subtract(new Polygon(...pointList));   
        }
          
          // simplify polygon points
          this.currentPolygon.points = Utils.simplifyPointList(this.currentPolygon.points, this.simplificationTolerance);
          /*const points = this.currentPolygon.points.map(p => ({x: p[0], y: p[1]}) );
          const simplePoints = simplify(points, this.simplificationTolerance);
          this.currentPolygon.points = simplePoints.map(sp => [sp.x, sp.y]);*/

      }
      // Notify change
      this.changedEvent.emit();
      return true;
  }

  onPanEnd(event: any): boolean {
      this.brushActivated = false;
      this.pointerPos = null;

      this.commitChanges();

      this.changedEvent.emit();
      return true;
  }

  onMove(event: any): boolean {
      return true;
  }

  commitChanges() {
      if (this.currentPolygon) {
          if (this.dirty) {
              // only add actions if we have changed something
              this.segModel.addAction(new ChangePolygonPoints(this.segModel.segmentationData,
                                      this.currentPolygon.points,
                                      this.segModel.activePolygonId,
                                      this.oldPoints));
          }
          this.dirty = false;

          this.changedEvent.emit();
      }
  }

  stop() {
    this.changedEvent.unsubscribe();
    //this.commitChanges();
  }

  /**
   * Is called when the user presses Enter or clicks the tick button
   * 
   * Creates a new polygon
   */
  save() {
      this.segModel.addNewPolygon();
  }

  get canSave() {
      return true;
  }

  get canUndo() {
      return this.segModel.actionManager.canUndo;
  }

  get canRedo() {
      return this.segModel.actionManager.canRedo;
  }

  undo() {
      return this.segModel.actionManager.undo();
  }

  redo() {
      return this.segModel.actionManager.redo();
  }
}
