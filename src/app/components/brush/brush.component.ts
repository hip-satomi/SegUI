import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { ChangePolygonPoints, JointAction } from 'src/app/models/action';
import { Drawer, Pencil, Tool, UIInteraction } from 'src/app/models/drawing';
import { ApproxCircle, Point, Polygon, Rectangle } from 'src/app/models/geometry';
import { GlobalSegmentationModel, LocalSegmentationModel, SegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { Position, Utils } from 'src/app/models/utils';
import { SegmentationService } from 'src/app/services/segmentation.service';
import { polygon } from 'polygon-tools';

import { rotate, matrix, create, all, chain, subtract, multiply, add } from 'mathjs';
const math = create(all);


const tree = require( 'tree-kit' ) ;

// as a ES module
import RBush from 'rbush';

@Component({
  selector: 'app-brush',
  templateUrl: './brush.component.html',
  styleUrls: ['./brush.component.scss'],
})
export class BrushComponent extends Tool implements Drawer, OnInit {

  // input the current segmentation model and ui
  @Input() localSegModel: LocalSegmentationModel;
  @Input() globalSegModel: GlobalSegmentationModel;
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

  preventOverlap = true;

  // track the polygons that get changed while drawing
  changedPolygons = new Map<string, Polygon>();

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
    return this.localSegModel.activePolygon;
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
        this.segUI.drawPolygons(ctx, false);
        //this.segModel.drawPolygons(ctx, false);
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

      this.changedPolygons = new Map<string, Polygon>();

      if (this.currentPolygon === null) {
          // add a new polygon if there is none selected
          this.localSegModel.addNewPolygon();
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

  smoothBrush(startPos: Position, endPos: Position) {
    // no intersection, most likely due to quick draw
    const originCircle = new ApproxCircle(startPos.x, startPos.y, this.brushSize);
    const endCircle = new ApproxCircle(endPos.x, endPos.y, this.brushSize);

    // make rectangle
    const distance = Utils.euclideanDistance([startPos.x, startPos.y], [this.pointerPos.x, this.pointerPos.y]);

    // angle
    const alpha = Math.asin((this.pointerPos.x - startPos.x) / distance);

    // compute vector between circles
    const betweenCirlces = math.chain([this.pointerPos.x, this.pointerPos.y]).subtract([startPos.x, startPos.y]).done()

    if (math.norm(betweenCirlces) == 0) {
        // no real movement
        return originCircle;
    }

    // use that to compute up direction
    let dirUp = rotate(betweenCirlces, Math.PI/2);
    dirUp = multiply(dirUp, 1./math.norm(dirUp));


    // compute start point
    const start = [startPos.x, startPos.y];

    // compute rectangle points
    const leftUp = add(start, multiply(dirUp, this.brushSize));
    const rightUp = add(leftUp, betweenCirlces);
    const rightLow = subtract(rightUp, multiply(dirUp, 2 * this.brushSize));
    const leftLow = subtract(rightLow, betweenCirlces);

    // polygon between circles
    const interPolygon = new Polygon(...[leftUp, rightUp, rightLow, leftLow]);

    if (!endPos) {
        return null;
    }

    try{
        // join polygons
        originCircle.join(interPolygon);
        originCircle.join(endCircle);
    } catch(e: unknown) {
        return null;
    }
    return originCircle;
  }

  onPan(event: any): boolean {
    const oldPointerPos = Utils.tree.clone(this.pointerPos);
    this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
    if (this.brushActivated) {
        this.dirty = true;
        this.changedPolygons.set(this.localSegModel.activePolygonId, this.currentPolygon);
        const circle = new ApproxCircle(this.pointerPos.x, this.pointerPos.y, this.brushSize);

        // Increase/Decrease depending on selected mode
        if (this.increase) {
            const increase = this.smoothBrush(oldPointerPos, this.pointerPos);
            this.currentPolygon.join(increase);
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
        this.currentPolygon.setPoints(Utils.simplifyPointList(this.currentPolygon.points, this.simplificationTolerance));

        if (this.preventOverlap) {

            // check on other polygons
            const tree = new RBush();

            for (const [uuid, poly] of this.localSegModel.segmentationData.getPolygons()){
                if (poly == this.currentPolygon) {
                    continue;
                }
                const bbox = poly.boundingBox
                tree.insert({
                    minX: bbox.x,
                    minY: bbox.y,
                    maxX: bbox.x + bbox.w,
                    maxY: bbox.y + bbox.h,
                    uuid: uuid,
                });
            }
            const curBbox = this.currentPolygon.boundingBox;
            // coarse intersection test via bbox (but fast)
            const result = tree.search({
                minX: curBbox.x,
                minY: curBbox.y,
                maxX: curBbox.x + curBbox.w,
                maxY: curBbox.y + curBbox.h
            });
            for(const {uuid} of result) {
                const conflictPolygon = this.localSegModel.segmentationData.getPolygon(uuid);
                // detailed intersection test (slow)
                if(this.currentPolygon.isIntersecting(conflictPolygon)) {
                    conflictPolygon.subtract(this.currentPolygon);
                    this.changedPolygons.set(uuid, conflictPolygon);
                }
            }
        }
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

        const actions = [];
        for(const [uuid, poly] of this.changedPolygons.entries()) {
            actions.push(
                new ChangePolygonPoints(poly.points,
                    uuid));
        }

        if (actions.length > 0) {
            this.localSegModel.addAction(new JointAction(...actions), false);
        }

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
      this.localSegModel.addNewPolygon();
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
