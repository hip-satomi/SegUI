import { SegmentationUI } from './../../models/segmentation-ui';
import { SegmentationModel } from './../../models/segmentation-model';
import { Indicator } from './indicators';
import { Position, Utils, UIUtils } from './../../models/utils';
import { AddPointAction, SegmentationAction, AddEmptyPolygon, MovePointAction } from './../../models/action';
import { ToastController } from '@ionic/angular';
import { Component, OnInit, ViewChild, ElementRef, Renderer2, AfterViewInit, HostListener, Input } from '@angular/core';
import { multiply} from 'mathjs';

import { Plugins } from '@capacitor/core';

const { Storage } = Plugins;

enum CursorType {
  Drag = 'move',
  Select = 'crosshair',
  Standard = 'crosshair',
  Panning = 'move'
}

@Component({
  selector: 'app-image-view',
  templateUrl: './image-view.component.html',
  styleUrls: ['./image-view.component.scss'],
})
export class ImageViewComponent implements OnInit, AfterViewInit {

  @ViewChild('myCanvas', {static: false}) canvas: ElementRef;

  context: any;
  @Input() imageUrl: string;
  @Input() enabled: boolean;
  canvasElement: any;
  ctx: any;
  image: any;
  dragging = false;
  distanceThreshold = 10;
  actionTimeSplitThreshold = 0.5; // time in seconds, below actions get merged
  scale = 1.;
  currentMousePos: Position;
  indicators;

  @Input() segmentationModel: SegmentationModel;
  @Input() segmentationUI: SegmentationUI;

  pinchInfo = {
    pinching: false,
    pinchScale: 0,
    pinchPos: {x: 0, y: 0}
  };

  zoomFactor = 1.25;

  draggingOrigPoint: [number, number];


  constructor(private renderer: Renderer2,
              private toastController: ToastController) {
    this.indicators = new Indicator();
  }

  ngOnInit() {}

  async ngAfterViewInit() {
    // init variables
    this.context = this.canvas.nativeElement.getContext('2d');
    this.ctx = this.context;
    this.canvasElement = this.canvas.nativeElement;

    this.segmentationUI.canvasElement = this.canvasElement;
    this.segmentationUI.ctx = this.ctx;

    // activate delayed fit container function
    setTimeout( () => {
      this.fitToContainer(this.canvasElement);
    }, 500);

    // load the image
    this.image = new Image();

    this.image.onload = () => {
      this.draw();
    };

    this.image.src = this.imageUrl;

    this.segmentationModel.onModelChange.subscribe((segmentationModel: SegmentationModel) => {
      this.onSegModelChange(segmentationModel);
    });

    if (this.segmentationModel.polygons.length === 0) {
        this.addAction(new AddEmptyPolygon(this.segmentationModel, UIUtils.randomColor()));
    }

    this.draw();
  }

  /*async dataSave() {
    const serializer = new TypedJSON(SegmentationModel);

    const json = serializer.stringify(this.segmentationModel);

    console.log(json);

    await Storage.set({
      key: 'segmentation',
      value: json
    });
  }

  async dataRestore() {
    const serializer = new TypedJSON(SegmentationModel);

    const jsonString = await Storage.get({key: 'segmentation'});

    if (jsonString.value) {
      console.log(jsonString.value);

      try {
        // try to deserialize the segmentation model
        const segmentationModel = serializer.parse(jsonString.value);

        if (segmentationModel) {
          // if it works we will accept this as the new model
          this.segmentationModel = segmentationModel;
        } else {
          // otherwise we notify the user and use the old segmentation model
          const toast = await this.toastController.create({
            message: 'Could not restore local data!',
            duration: 2000
          });
          toast.present();
        }
      } catch(e) {
          // otherwise we notify the user and use the old segmentation model
          const toast = await this.toastController.create({
            message: 'Could not restore local data!',
            duration: 2000
          });
          toast.present();
      }

      this.draw();
    }

    this.segmentationModel.onModelChange = (segmentationModel: SegmentationModel) => {
      this.onSegModelChange(segmentationModel);
    };

    if (this.segmentationModel.polygons.length === 0) {
      this.addAction(new AddEmptyPolygon(this.segmentationModel, UIUtils.randomColor()));
    }
  }*/

  /**
   * Called when the action model is modified
   */
  onSegModelChange(segmentationModel: SegmentationModel) {
    this.draw();

    //this.dataSave();
  }

  // ----- Basic touch/click events -----

  async onTap(event) {
    // handle a tap like a mousedown event
    //this.mousedown(event);
    this.segmentationUI.onTap(event);
  }

  onPanStart(event) {
    this.segmentationUI.onPanStart(event);
  }

  onPan(event) {
    this.segmentationUI.onPan(event);
  }

  onPanEnd(event) {
    this.segmentationUI.onPanEnd(event);
  }

  async onPress(event) {
    // TODO useful functionality for press event
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
    const rect = this.canvasElement.getBoundingClientRect();
    const x: number = evt.center.x - rect.left;
    const y: number = evt.center.y - rect.top;
    /*const mousePos = this.getMousePos(this.element, evt);
    const x = mousePos.x;
    const y = mousePos.y;*/

    const oldPos = this.pinchInfo.pinchPos;

    // go from screen to model coordinates
    const modelPos = Utils.screenPosToModelPos({x, y}, this.ctx);

    const xTranslate = x - oldPos.x;
    const yTranslate = y - oldPos.y;

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

    const rect = this.canvasElement.getBoundingClientRect();
    const x: number = evt.center.x - rect.left;
    const y: number = evt.center.y - rect.top;
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

    const zoom = event.deltaY * -1e-2 + 1.;

    this.zoom(zoom, mousepos);

  }


  setCursor(cursor: CursorType) {
    this.renderer.setStyle(this.canvasElement, 'cursor', cursor);
  }

  // ----- Keyboard events -----

  @HostListener('document:keydown.arrowleft')
  moveLeft(event) {
    this.ctx.translate(-25, 0);
    this.draw();
  }

  @HostListener('document:keydown.arrowright')
  moveRight() {
    this.ctx.translate(25, 0);
    this.draw();
  }

  @HostListener('document:keydown.arrowdown')
  moveDown() {
    this.ctx.translate(0, 25);
    this.draw();
  }

  @HostListener('document:keydown.arrowup')
  moveUp() {
    this.ctx.translate(0, -25);
    this.draw();
  }

  @HostListener('document:keydown.+')
  scaleUp() {
    this.zoom(this.zoomFactor, this.currentMousePos);
    this.draw();
  }

  @HostListener('document:keydown.-')
  scaleDown() {
    this.zoom(1. / this.zoomFactor, this.currentMousePos);
    this.draw();
  }

  @HostListener('document:keydown.enter', ['$event'])
  saveKey(event) {
    this.save();
  }

  /**
   * Apply zoom at current mouse pointer position
   * @param factor zoom factor (< 1: shring, > 1 enlarge)
   * @param mousePos current mouse position (in model coordinates)
   */
  zoom(factor, mousePos: Position) {
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

    this.scale *= factor;

    // 4. move origin back --> mouse position should be invariant to combined (2, 3, 4) transforms
    this.ctx.translate(-mousex, -mousey);

    // extract the new transformation
    const transformNew = this.ctx.getTransform();

    // compute the joint transform from old and new
    const fullTransform = multiply(Utils.transformToMatrix(transform), Utils.transformToMatrix(transformNew));
    const t = Utils.matrixToTransform(fullTransform);

    // set the new transform to canvas
    this.context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    // redraw
    this.draw();
  }

  async save() {
    if (this.segmentationModel.activePolygon.numPoints === 0) {
      const toast = await this.toastController.create({
        message: 'Please perform a segmentation!',
        duration: 2000
      });
      toast.present();
    } else {
      this.segmentationModel.addNewPolygon();
      this.draw();
    }
  }

  /**
   * Handles dragging or cursor selection
   * @param e is the event parameter
   */
  move(e) {
    e.preventDefault();

    if (this.pinchInfo.pinching) {
      const oldPos = Utils.screenPosToModelPos(this.pinchInfo.pinchPos, this.ctx);

      // computer center position w.r.t. canvas element
      const newPos = Utils.getMousePosMouse(this.canvasElement, e);

      const newModelPos = Utils.screenPosToModelPos(newPos, this.ctx);

      this.ctx.translate(newModelPos.x - oldPos.x, newModelPos.y - oldPos.y);
      this.pinchInfo.pinchPos = newPos;

      this.draw();
    }
    /*else if (this.enabled && this.dragging) {
      // get active polygon and point and update position
      const polygon = this.segmentationModel.activePolygon;
      this.addAction(new MovePointAction([mousePos.x, mousePos.y],
                                          this.segmentationModel.activePointIndex,
                                          this.segmentationModel.activePolygonIndex,
                                          this.segmentationModel.segmentationData));

      //polygon.setPoint(this.segmentationModel.activePointIndex, [mousePos.x, mousePos.y]);

      // redraw the canvas
      //this.draw();
    } else {
      // we want to select the correct cursor type

      const polygon = this.segmentationModel.activePolygon;

      let cursorSelected = false;

      // check if we are close to a polygon point ---> drag cursor
      if (polygon.numPoints > 0) {
        // compute distance to next active point
        const closestDistanceInfo = polygon.closestPointDistanceInfo([mousePos.x, mousePos.y]);
        const closestDistance = closestDistanceInfo.distance;

        if (closestDistance < this.distanceThreshold) {
          // if the distance is within threshold --> display drag cursor
          this.setCursor(CursorType.Drag);
          cursorSelected = true;
        }
      }

      // if no drag cursor --> standard cross cursor
      if (!cursorSelected) {
        this.setCursor(CursorType.Standard);
      }
    }*/
  }

  /**
   * Handles end of dragging event
   * 
   * Creates the corresponding movement action
   * @param event 
   */
  stopdrag(event) {
    const e = event;
    e.preventDefault();

    if (this.dragging) {
      //const act = new MovedPointAction(this.draggingOrigPoint, this.segmentationModel.activePointIndex,
      //                                 this.segmentationModel.activePolygonIndex, this.segmentationModel);
      //this.addAction(act);

      //this.activePoint = null;
      this.dragging = false;
    }

    if (this.pinchInfo.pinching) {
      this.pinchInfo.pinching = false;
    }

    return false;
  }

  
  mousedown(event, dragOnly=false) {

    if (event.button === 1) {
      // wheel mouse button --> TODO add some panning here
      this.pinchInfo.pinching = true;
      this.pinchInfo.pinchPos = Utils.getMousePosMouse(this.canvasElement, event);
      this.pinchInfo.pinchScale = 1.;

      this.setCursor(CursorType.Panning);
    }

    /*if (this.pinchInfo.pinching) {
      // if we are pinching we will not recognize any mousedown events
      return false;
    }

    console.log("touch start");
    const e = event;

    //alert('Mouse down');
    e.preventDefault();
    if (this.enabled && !this.dragging) {
      const poly = this.segmentationModel.activePolygon;
      let x, y, insertAt = poly.numPoints;

      if (e.which === 3) {
        return false;
      }

      if (!e.offsetX) {
        e.offsetX = e.target.offsetLeft; //(e.pageX - e.target.offsetLeft);
        e.offsetY = e.target.offsetTop; //(e.pageY - e.target.offsetTop);
      }
      const mousePos = Utils.getMousePos(this.canvasElement, e);
      x = mousePos.x;
      y = mousePos.y;


      // compute closest distance to the polygon (in case of dragging a point)
      const distanceInfo = poly.closestPointDistanceInfo([x, y]);
      const minDis = distanceInfo.distance;
      const minDisIndex = distanceInfo.index;
      if (minDis < 10 && minDisIndex >= 0) {
        this.segmentationModel.activePointIndex = minDisIndex;
        this.dragging = true; // enable dragging mode

        this.draggingOrigPoint = [...this.segmentationModel.activePoint];

        return false;
      }

      // compute closest distance to line (in case of inserting a point in between)
      if (!dragOnly) {
        let lineInsert = false;
        const di = poly.distanceToOuterShape([x, y]);
        if (di.index !== -1 && di.distance < this.distanceThreshold) {
          insertAt = di.index;
          lineInsert = true;
        }

        if (!lineInsert) {
          // check whether you did click onto another polygon
          for (const [index, polygon] of this.segmentationModel.polygons.entries()) {
            if (index === this.segmentationModel.activePolygonIndex) {
              continue;
            }
            if (polygon.isInside([x, y])) {
              // clicke inside a non active polygon
              this.segmentationModel.activePolygonIndex = index;
              this.draw();
              return false;
            }
          }

        }

        // place at correct place (maybe close to line --> directly on the line)
        const act = new AddPointAction([x, y], insertAt, this.segmentationModel.activePolygonIndex, this.segmentationModel);
        this.addAction(act);

        this.segmentationModel.activePointIndex = insertAt;

        // redraw
        this.draw();
      }
    }*/
    return false;
  }

  

  /**
   * Refresh the cavas drawing
   */
  draw() {
    UIUtils.clearCanvas(this.canvasElement, this.ctx);

    this.segmentationModel.draw(this.ctx);
  }

  /**
   * Fits the canvas resolution to the available screen resolution
   * @param canvas the canvast to fit
   */
  async fitToContainer(canvas){
    if (this.enabled) {
      // try to maximize canvas
      const changed = UIUtils.fitToContainer(canvas);

      if (changed) {
        // redraw when the container has changed
        this.draw();
      }
    }

    // TODO: this is a dirty hack to resize the container if the window size changes (resize borser, rotate device)
    setTimeout(() => {
      this.fitToContainer(this.canvasElement);
    }, 1000);
  }

  // ----- pure data manipulation -----
  addAction(action: SegmentationAction) {
    this.segmentationModel.addAction(action);
  }

  async undo() {
    // perform undo --> redraw will be called automatically as action manager changes
    this.segmentationModel.undo();
  }

  async redo() {
    // perform redo --> redraw will be called automatically as action manager changes
    this.segmentationModel.redo();
  }

}
