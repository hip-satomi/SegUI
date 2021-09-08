import { UIInteraction } from './../../models/drawing';
import { Indicator } from './indicators';
import { UIUtils, Utils, Position } from './../../models/utils';
import { Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener, AfterViewChecked } from '@angular/core';
import { Drawer } from 'src/app/models/drawing';
import { multiply} from 'mathjs';
import { BoundingBox, Rectangle } from 'src/app/models/geometry';

@Component({
  selector: 'app-image-display',
  templateUrl: './image-display.component.html',
  styleUrls: ['./image-display.component.scss'],
})
export class ImageDisplayComponent implements OnInit, AfterViewInit, AfterViewChecked {

  @ViewChild('myCanvas', {static: false}) canvas: ElementRef;

  @Input() drawer: Drawer;
  @Input() interactor: UIInteraction;

  canvasElement;
  ctx;

  enabled = true;

  indicators;

  pinchInfo = {
    pinching: false,
    pinchScale: 0,
    pinchPos: {x: 0, y: 0}
  };


  constructor() {
    this.indicators = new Indicator();
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.canvasElement = this.canvas.nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
  }

  ngAfterViewChecked() {
    // after all the views are present we update the canvas size
    this.fitToContainer(this.canvasElement);
  }

  @HostListener('window:resize', [])
  private onResize() {
    this.fitToContainer(this.canvasElement);
  }

  /**
   * Fits the canvas resolution to the available screen resolution
   * @param canvas the canvast to fit
   */
  async fitToContainer(canvas){
    if (this.enabled) {
      // try to maximize canvas
      const transform = this.ctx.getTransform();
      const changed = UIUtils.fitToContainer(canvas);

      if (changed) {
        // redraw when the container has changed
        this.ctx.setTransform(transform);
        this.draw()
      }
    }
  }

  clear() {
    UIUtils.clearCanvas(this.canvasElement, this.ctx);
  }

  onTap(event) {
    this.interactor.onTap(event);
  }

  onPress(event) {
    this.interactor.onPress(event);
  }

  onPanStart(event) {
    this.interactor.onPanStart(event);
  }

  onPan(event) {
    this.interactor.onPan(event);
  }

  onPanEnd(event) {
    this.interactor.onPanEnd(event);
  }

  move(event) {
    event.preventDefault();

    if (this.pinchInfo.pinching) {
      const oldPos = Utils.screenPosToModelPos(this.pinchInfo.pinchPos, this.ctx);

      // computer center position w.r.t. canvas element
      const newPos = Utils.getMousePosMouse(this.canvasElement, event);

      const newModelPos = Utils.screenPosToModelPos(newPos, this.ctx);

      this.ctx.translate(newModelPos.x - oldPos.x, newModelPos.y - oldPos.y);
      this.pinchInfo.pinchPos = newPos;

      this.draw();

      return false;
    }

    return this.interactor.onMove(event);
  }

    /**
   * This function is called during the pinch event and updates the zoom of the canvas element
   * correspondingly
   * @param evt the pinch event
   */
  onPinch(evt) {
    // adjust size of indicator
    this.indicators.gestureIndicators[0].size = 50 * evt.scale;

    // compute additional zoom
    const zoom = evt.scale / this.pinchInfo.pinchScale;

    // computer center position w.r.t. canvas element
    const mousePos = Utils.getMousePosTouch(this.canvasElement, evt);
    const x = mousePos.x;
    const y = mousePos.y;
    /*const mousePos = this.getMousePos(this.element, evt);
    const x = mousePos.x;
    const y = mousePos.y;*/

    const oldPos = this.pinchInfo.pinchPos;

    // go from screen to model coordinates
    const oldModelPos = Utils.screenPosToModelPos(oldPos, this.ctx);
    const modelPos = Utils.screenPosToModelPos(mousePos, this.ctx);

    const xTranslate = modelPos.x - oldModelPos.x;
    const yTranslate = modelPos.y - oldModelPos.y;

    this.ctx.translate(xTranslate, yTranslate);
    this.pinchInfo.pinchPos = {x, y};
    this.draw();

    // apply additional zoom
    this.zoom(zoom, modelPos);

    // update the current pinch scale (should be equal to evt.scale)
    this.pinchInfo.pinchScale *= zoom;
  }

  /**
   * Notifies the start of the pinch event
   * @param evt pinch event
   */
  onPinchStart(evt) {
    this.indicators.gestureIndicators = [];
    this.indicators.display(evt.center.x, evt.center.y, 50);

    const mousePos = Utils.getMousePosTouch(this.canvasElement, evt);
    const x = mousePos.x;
    const y = mousePos.y;

    this.pinchInfo.pinchScale = 1.;
    this.pinchInfo.pinchPos = {x, y};
  }

  /**
   * Notifies the end of the pinch event
   * @param evt pinch event
   */
  onPinchEnd(evt) {
    this.indicators.hide(this.indicators.gestureIndicators[0]);
    this.pinchInfo.pinching = false;
  }

    /**
   * Handles mouse wheel movement (up/down) to zoom in and out
   * @param event mousewheel event
   */
  mousewheel(event) {
    event.preventDefault();
    const mousepos = Utils.getMousePos(this.canvasElement, event, false);
    const mousex = mousepos.x;
    const mousey = mousepos.y;

    const zoom = event.deltaY * -1e-3 + 1.;

    this.zoom(zoom, mousepos);

  }

  mousedown(event) {

    if (event.button === 1) {
      // wheel mouse button --> TODO add some panning here
      this.pinchInfo.pinching = true;
      this.pinchInfo.pinchPos = Utils.getMousePosMouse(this.canvasElement, event);
      this.pinchInfo.pinchScale = 1.;

      //this.setCursor(CursorType.Panning);
    }
  }

  mouseup(event) {
    if (this.pinchInfo.pinching) {
      this.pinchInfo.pinching = false;
    }
  }

  /**
   * 
   * @param box the box to center and show (zooming)
   */
  showFixedBox(box: BoundingBox) {
    // obtain canvas (drawing) dimensions
    const cWidth = this.canvasElement.width
    const cHeight = this.canvasElement.height

    // obtain box dimensions
    const boxWidth = box.w;
    const boxHeight = box.h;

    // reset current transform
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // compute the zoom factor
    const xZoomFactor = cWidth / boxWidth;
    const yZoomFactor = cHeight / boxHeight;

    const zoomFactor = Math.min(xZoomFactor, yZoomFactor);

    // compute zoomed translation
    const xTranslate = (cWidth - boxWidth * zoomFactor) / 2;
    const yTranslate = (cHeight - boxHeight * zoomFactor) / 2;

    // create the full transform
    const transform = Utils.createTransform(zoomFactor, zoomFactor, xTranslate, yTranslate);

    // update transform
    this.ctx.setTransform(transform);

    console.log('zoomToShowFixedBox');
  }



    /**
   * Apply zoom at current mouse pointer position
   * @param factor zoom factor (< 1: shring, > 1 enlarge)
   * @param mousePos current mouse position (in model coordinates)
   */
  zoom(factor, mousePos: Position, draw=true) {
    const mousex = mousePos.x;
    const mousey = mousePos.y;

    // perform transforms such that zoom is applied a current mouse pointer position

    // 1. get current transform and reset canvas transforms
    const transform = this.ctx.getTransform();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 2. move origin to mouse position
    this.ctx.translate(mousex, mousey);

    // 3. scale canvas by factor
    this.ctx.scale(factor, factor);

    //this.scale *= factor;

    // 4. move origin back --> mouse position should be invariant to combined (2, 3, 4) transforms
    this.ctx.translate(-mousex, -mousey);

    // extract the new transformation
    const transformNew = this.ctx.getTransform();

    // compute the joint transform from old and new
    const fullTransform = multiply(Utils.transformToMatrix(transform), Utils.transformToMatrix(transformNew));
    const t = Utils.matrixToTransform(fullTransform);

    // set the new transform to canvas
    this.ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    if (draw) {
      // redraw
      this.draw();
    }
  }

  // --- Redirect pointer events ---
  onPointerDown(event) {
    this.interactor.onPointerDown(event);
  }

  onPointerMove(event) {
    this.interactor.onPointerMove(event);
  }

  onPointerUp(event) {
    this.interactor.onPointerUp(event);
  }

  draw() {
    if (this.drawer) {
      this.drawer.draw(this.ctx);
    }
  }

}
