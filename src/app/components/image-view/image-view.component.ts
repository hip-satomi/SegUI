import { Indicator } from './indicators';
import { Rectangle } from './../../models/geometry';
import { Position, dotLineLength, hexToRgb } from './../../models/utils';
import { AddPointAction, Action, MovedPointAction, JointAction, ActionManager } from './../../models/action';
import { ToastController } from '@ionic/angular';
import { Component, OnInit, ViewChild, ElementRef, Renderer2, AfterViewInit, HostListener } from '@angular/core';
import { ResizedEvent } from 'angular-resize-event';
import { multiply, inv } from 'mathjs';
import { Polygon } from 'src/app/models/geometry';

enum CursorType {
  Drag = 'move',
  Select = 'crosshair',
  Standard = 'crosshair'
}

function transformToMatrix(t) {
  return [[t.a, t.c, t.e], [t.b, t.d, t.f], [0, 0, 1]];
}

function matrixToTransform(m) {
  return {
    a: m[0][0],
    b: m[1][0],
    c: m[0][1],
    d: m[1][1],
    e: m[0][2],
    f: m[1][2]
  };
}

@Component({
  selector: 'app-image-view',
  templateUrl: './image-view.component.html',
  styleUrls: ['./image-view.component.scss'],
})
export class ImageViewComponent implements OnInit, AfterViewInit {

  @ViewChild('myCanvas', {static: false}) canvas: ElementRef;

  context: any;
  imageUrl: string;
  enabled: boolean;
  element: any;
  polygons: Polygon[] = [new Polygon()];
  activePolygon: number;
  activePoint: number;
  ctx: any;
  palette: any;
  image: any;
  dragging = false;
  distanceThreshold = 10;
  actionTimeSplitThreshold = 0.5; // time in seconds, below actions get merged
  scale = 1.;
  currentMousePos: Position;
  imageRect: Rectangle;
  indicators;

  actionManager: ActionManager;

  pinchInfo = {
    pinchScale: 0,
    pinchPos: {x: 0, y: 0}
  };

  zoomFactor = 1.25;

  draggingOrigPoint: [number, number];

  actions: Action[] = [];

  constructor(private renderer: Renderer2,
              private toastController: ToastController) {
    this.enabled = true;
    const image_src = '../assets/1.png'//'https://cloud.githubusercontent.com/assets/6464002/22788262/182d8192-ef01-11e6-8da0-903c1ddfa70f.png'
    this.imageUrl = image_src;

    this.activePolygon = 0;
    this.activePoint = 0;

    this.palette = ['#ff0000'];

    this.indicators = new Indicator();
    this.actionManager = new ActionManager(this.actionTimeSplitThreshold);
  }

  ngOnInit() {}

  async onTap(event) {
    const toast = await this.toastController.create({
      message: 'You tapped it!',
      duration: 2000
    });
    toast.present();

    this.mousedown(event);
  }

  async onPress(event) {
    const toast = await this.toastController.create({
      message: 'You pressed it!',
      duration: 2000
    });
    toast.present();
  }

  async onPanStart(event) {
    const toast = await this.toastController.create({
      message: 'Started panning!',
      duration: 2000
    });
    toast.present();

    this.mousedown(event);
  }

  async onPan(event) {
    this.mousemove(event);
  }

  async onPanEnd(event) {
    const toast = await this.toastController.create({
      message: 'Stopped panning!',
      duration: 2000
    });
    toast.present();
  }

  onTouchEnd() {
    if (this.dragging) {
      this.dragging = false;
    }
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
    const rect = this.element.getBoundingClientRect();
    const x: number = evt.center.x - rect.left;
    const y: number = evt.center.y - rect.top;

    const oldPos = this.pinchInfo.pinchPos;

    // go from screen to model coordinates
    const modelPos = this.screenPosToModelPos({x, y});

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

    const rect = this.element.getBoundingClientRect();
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
    //this.pin = null;
  }

  setCursor(cursor: CursorType) {
    this.renderer.setStyle(this.element, 'cursor', cursor);
  }

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

  addAction(action: Action) {
    this.actionManager.addAction(action);
    this.draw();
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

    // 4. move origin back --> mouse position should be invariant to combined (2, 3, 4) transforms
    this.ctx.translate(-mousex, -mousey);

    // extract the new transformation
    const transformNew = this.ctx.getTransform();

    // compute the joint transform from old and new
    const fullTransform = multiply(transformToMatrix(transform), transformToMatrix(transformNew));
    const t = matrixToTransform(fullTransform);

    // set the new transform to canvas
    this.context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    // redraw
    this.draw();
  }

  mousewheel(event) {
    event.preventDefault();
    const mousepos = this.getMousePos(this.element, event, false);
    const mousex = mousepos.x;
    const mousey = mousepos.y;

    const zoom = event.deltaY * -1e-2 + 1.;

    this.zoom(zoom, mousepos);

  }

  @HostListener('document:keydown.enter', ['$event'])
  saveKey(event) {
    this.save();
  }

  async save() {
    if (this.polygons[this.activePolygon].numPoints === 0) {
      const toast = await this.toastController.create({
        message: 'Please perform a segmentation!',
        duration: 2000
      });
      toast.present();
    } else {
      // insert new empty polygon at the end if needed
      if (this.polygons[this.polygons.length - 1].numPoints > 0) {
        this.polygons.push(new Polygon());
      }
      // make the last polygon (empty one) active
      this.activePolygon = this.polygons.length - 1;
      this.draw();
    }
  }

  async undo() {
    if (this.actionManager.canUndo) {
      this.actionManager.undo();
      this.draw();
    } else {
      const toast = await this.toastController.create({
        message: 'There are no actions to undo',
        duration: 2000
      });
      toast.present();
    }
  }

  async redo() {
    if (this.actionManager.canRedo) {
      this.actionManager.redo();
      this.draw();
    } else {
      const toast = await this.toastController.create({
        message: 'There are no actions to redo',
        duration: 2000
      });
      toast.present();
    }
  }

  move(e) {
    e.preventDefault();
    const mousePos = this.getMousePos(this.element, e);
    this.currentMousePos = mousePos;
    if (this.enabled && this.dragging) {
        /*if (!e.offsetX) {
          e.offsetX = (e.pageX - e.target.offsetLeft);
          e.offsetY = (e.pageY - e.target.offsetTop);
        }*/
        if (!e.offsetX) {
          e.offsetX = e.target.offsetLeft; //(e.pageX - e.target.offsetLeft);
          e.offsetY = e.target.offsetTop; //(e.pageY - e.target.offsetTop);
        }

        const polygon = this.polygons[this.activePolygon];

        polygon.setPoint(this.activePoint, [mousePos.x, mousePos.y]);

        this.draw();
      } else {
        // we want to select the correct cursor type

        const polygon = this.polygons[this.activePolygon];

        let cursorSelected = false;

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

        if (!cursorSelected) {
          this.setCursor(CursorType.Standard);
        }
      }
  }
  
  mousemove(event) {
    this.move(event);
  }

  ngAfterViewInit(): void {
    this.context = this.canvas.nativeElement.getContext('2d');
    this.ctx = this.context;
    this.element = this.canvas.nativeElement;
    // activate delayed fit container function
    setTimeout( () => {
      this.fitToContainer(this.element);
    }, 500);
    this.init();
  }

  /**
   * Converts positions between screen and model coordinates (applies the inverse transformation matrix)
   * @param pos screen position
   */
  screenPosToModelPos(pos: Position): Position {
    let x = pos.x;
    let y = pos.y;

    // convert to geometry coordnate space
    const t = this.ctx.getTransform();

    const transformMatrix = inv(transformToMatrix(t));

    const transformedMouse = multiply(transformMatrix, [x, y, 1]);

    x = transformedMouse[0];
    y = transformedMouse[1];

    return {x, y};
  }

  getMousePos(canvas, evt, onScreen=false): Position {
    // special handling for touch events
    if (evt.touches) {
      evt = evt.touches[0];
    }

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if (evt.center) {
      // if this is a tap or press event (from hammer js)
      x = evt.center.x - rect.left;
      y = evt.center.y - rect.top;
    } else {
      // otherwise (native browser event)
      x = evt.clientX - rect.left;
      y = evt.clientY - rect.top;
    }

    if (!onScreen) {
      // convert to geometry coordnate space
      const modelPos = this.screenPosToModelPos({x, y});
      x = modelPos.x;
      y = modelPos.y;
    }
    return {
      x, y
      };
  }

  stopdrag(event) {
    const e = event;
    e.preventDefault();

    if (this.dragging) {
      const act = new MovedPointAction(this.polygons[this.activePolygon].getPoint(this.activePoint), this.draggingOrigPoint);
      this.addAction(act);

      this.activePoint = null;
      this.dragging = false;
    }
  }

  
  mousedown(event) {
    console.log("touch start");
    const e = event;
    //alert('Mouse down');
    e.preventDefault();
    if (this.enabled && !this.dragging) {
      let poly = this.polygons[this.activePolygon];
      let x, y, insertAt = poly.numPoints;

      if (e.which === 3) {
        return false;
      }

      if (!e.offsetX) {
        e.offsetX = e.target.offsetLeft; //(e.pageX - e.target.offsetLeft);
        e.offsetY = e.target.offsetTop; //(e.pageY - e.target.offsetTop);
      }
      const mousePos = this.getMousePos(this.element, e);
      x = mousePos.x;
      y = mousePos.y;


      // compute closest distance to the polygon (in case of dragging a point)
      const distanceInfo = poly.closestPointDistanceInfo([x, y]);
      const minDis = distanceInfo.distance;
      const minDisIndex = distanceInfo.index;
      if (minDis < 10 && minDisIndex >= 0) {
        this.activePoint = minDisIndex;
        this.dragging = true; // enable dragging mode

        this.draggingOrigPoint = [...this.polygons[this.activePolygon].getPoint(this.activePoint)];

        return false;
      }

      // compute closest distance to line (in case of inserting a point in between)

      let lineInsert = false;
      const di = poly.distanceToOuterShape([x, y]);
      if (di.index !== -1 && di.distance < this.distanceThreshold) {
        insertAt = di.index;
        lineInsert = true;
      }

      if (!lineInsert) {
        // check whether you did click onto another polygon
        for (const [index, polygon] of this.polygons.entries()) {
          if (index === this.activePolygon) {
            continue;
          }
          if (polygon.isInside([x, y])) {
            // clicke inside a non active polygon
            this.activePolygon = index;
            this.draw();
            return false;
          }
        }

      }

      // place at correct place (maybe close to line --> directly on the line)
      const act = new AddPointAction([x, y], insertAt, this.polygons[this.activePolygon]);
      this.addAction(act);

      this.activePoint = insertAt;

      // redraw
      this.draw();
    }
    return false;
  }

  draw() {
    // Store the current transformation matrix
    this.ctx.save();

    // Use the identity matrix while clearing the canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.element.width, this.element.height);

    // Restore the transform
    this.ctx.restore();

    for (const [index, polygon] of this.polygons.entries()) {
      this.drawSingle(polygon.points, index);
    }
    this.ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);

  }

  /**
   * Fits the canvas resolution to the available screen resolution
   * @param canvas the canvast to fit
   */
  async fitToContainer(canvas){
    let changed = false;
    // Make it visually fill the positioned parent
    if (canvas.style.width !== '100%') {
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      changed = true;
    }
    if (canvas.width !== canvas.offsetWidth
       || canvas.height !== canvas.offsetHeight) {
      // ...then set the internal size to match
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      changed = true;
    }

    if (changed) {
      // redraw when the container has changed
      this.draw();
    }

    // TODO: this is a dirty hack to resize the container if the window size changes (resize borser, rotate device)
    setTimeout(() => {
      this.fitToContainer(this.element);
    }, 1000);
  }

  /**
   * Draws a single segmentation polygon
   * @param points the list of polygon border
   * @param p index in the global polygon list
   */
  drawSingle(points, p) {
    this.ctx.globalCompositeOperation = 'destination-over';
    this.ctx.fillStyle = 'rgb(255,255,255)';
    this.ctx.strokeStyle = this.palette[p];
    this.ctx.lineWidth = 1;

    // create the path for polygon
    this.ctx.beginPath();
    for (const point of points) {
      if (this.activePolygon ===  p && this.enabled) {
        this.ctx.fillRect(point[0] - 2, point[1] - 2, 4, 4);
        this.ctx.strokeRect(point[0] - 2, point[1] - 2, 4, 4);
      }
      this.ctx.lineTo(point[0], point[1]);
    }
    this.ctx.closePath();

    // perform the filling
    if (!this.palette[p]) {
      this.palette[p] =  '#'+(function lol(m,s,c){return s[m.floor(m.random() * s.length)] + (c && lol(m,s,c-1));})(Math,'0123456789ABCDEF',4)
    }
    const fillColor = hexToRgb(this.palette[p]);
    this.ctx.fillStyle = 'rgba(' + fillColor.r + ',' + fillColor.g + ',' + fillColor.b + ',0.1)';
    this.ctx.fill();
    this.ctx.stroke();
  }

  init(){
    // load the image
    this.image = new Image();

    this.image.onload = () => {
      this.imageRect = new Rectangle(0, 0, this.image.width, this.image.height);
      this.draw();
    };

    this.image.src = this.imageUrl;
  }
  
}
