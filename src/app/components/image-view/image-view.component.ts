import { AddPointAction, Action, MovedPointAction, JointAction } from './../../models/action';
import { ToastController } from '@ionic/angular';
import { Component, OnInit, ViewChild, ElementRef, Renderer2, AfterViewInit, HostListener } from '@angular/core';
import { ResizedEvent } from 'angular-resize-event';
import { multiply, inv } from 'mathjs';

enum CursorType {
  Drag = 'move',
  Select = 'crosshair',
  Standard = 'crosshair'
}

var inside = require('point-in-polygon');

@Component({
  selector: 'app-image-view',
  templateUrl: './image-view.component.html',
  styleUrls: ['./image-view.component.scss'],
})
export class ImageViewComponent implements OnInit, AfterViewInit {

  @ViewChild('myCanvas', {static: false}) canvas: ElementRef;
  //@ViewChild('parentContainer', {static: false}) container: ElementRef;
  context: any;
  imageUrl: string;
  enabled: boolean;
  element: any;
  points: [number, number][][];
  active: number;
  activePoint: number;
  ctx: any;
  palette: any;
  image: any;
  originalSize;
  dragging = false;
  distanceThreshold = 10;
  actionTimeSplitThreshold = 0.5; // time in seconds, below actions get merged
  xImage = 0;
  yImage = 0;
  scale = 1.;

  originX = 0;
  originY = 0;
  zoomFactor = 1.25;

  draggingOrigPoint: [number, number];

  actions: Action[] = [];

  pos1; pos2; pos3; pos4;

  constructor(private renderer: Renderer2,
      private toastController: ToastController) {
    this.enabled = true;
    const image_src = '../assets/1.png'//'https://cloud.githubusercontent.com/assets/6464002/22788262/182d8192-ef01-11e6-8da0-903c1ddfa70f.png'
    this.imageUrl = image_src;

    this.points = [[]];
    this.active = 0;
    this.activePoint = 0;

    this.palette = ['#ff0000'];
  }

  ngOnInit() {}

  setCursor(cursor: CursorType) {
    this.renderer.setStyle(this.element, 'cursor', cursor);
  }

  @HostListener('document:keydown.arrowleft')
  moveLeft(event) {
    //this.xImage -= 25;
    this.ctx.translate(-25, 0);
    this.draw();
    //this.draw();
  }

  @HostListener('document:keydown.arrowright')
  moveRight() {
    //this.xImage += 25;
    this.ctx.translate(25, 0);
    this.draw();
    //this.draw();
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
    this.ctx.scale(this.zoomFactor, this.zoomFactor);
    this.draw();
  }

  @HostListener('document:keydown.-')
  scaleDown() {
    this.ctx.scale(1. / this.zoomFactor, 1. / this.zoomFactor);
    this.draw();
  }

  mousewheel(event) {
    console.log("wheel");
    event.preventDefault();
    const mousepos = this.getMousePos(this.element, event);
    const mousex = mousepos.x;
    const mousey = mousepos.y;

    const zoom = event.deltaY * -0.01 * 1e-2;

    this.context.translate(this.originX, this.originY);
    this.originX -= mousex / (this.scale * zoom) - mousex / this.scale;
    this.originY -= mousey / (this.scale * zoom) - mousey / this.scale;

    this.context.scale(zoom, zoom);

    this.context.translate(-this.originX, -this.originY);

    this.scale *= zoom;

    this.draw();
  }

  @HostListener('document:keydown.enter', ['$event'])
  saveKey(event) {
    this.save();
  }

  async save() {
    if (this.points[this.active].length === 0) {
      const toast = await this.toastController.create({
        message: 'Please perform a segmentation!',
        duration: 2000
      });
      toast.present();
    } else {
      // insert new empty polygon at the end if needed
      if (this.points[this.points.length - 1].length > 0) {
        this.points.push([]);
      }
      // make the last polygon (empty one) active
      this.active = this.points.length - 1;
      this.draw();
    }
  }

  async undo() {
    if (this.actions.length > 0) {
      const lastAction = this.actions[this.actions.length - 1];
      lastAction.reverse();
      this.actions.pop();
      this.draw();
    }
  }

  /**
   * Adds an action to the action list
   * @param action 
   * @param toPerform 
   */
  addAction(action: Action, toPerform: boolean = true) {
    if (toPerform) {
      action.perform();
    }

  
    if (this.actions.length > 0
      && (+(new Date()) - +this.actions[this.actions.length - 1].lastPerformedTime) / 1000 < this.actionTimeSplitThreshold) {
        const jact = new JointAction(this.actions.pop(), action);
        jact.updatePerformedTime();
        action = jact;
    }

    this.actions.push(action);
  }

  /**
   * returns [min distance index, min distance value]
   * @param pos single position (e.g. mouse)
   * @param positions list of positions (e.g. target points)
   */
  pairwiseDistanceMin(pos: number[], positions: number[][]) {
    const x = pos[0];
    const y = pos[1];
    let minDisIndex = -1;
    let minDis = 0;
    for (const [index, point] of positions.entries()) {
      const dis = Math.sqrt(Math.pow(x - point[0], 2) + Math.pow(y - point[1], 2));
      if (minDisIndex === -1 || minDis > dis) {
        minDis = dis;
        minDisIndex = index;
      }
    }

    return {index: minDisIndex, distance: minDis};
  }

  move(e) {
      e.preventDefault();
      if (this.enabled && this.dragging) {
        /*if (!e.offsetX) {
          e.offsetX = (e.pageX - e.target.offsetLeft);
          e.offsetY = (e.pageY - e.target.offsetTop);
        }*/
        if (!e.offsetX) {
          e.offsetX = e.target.offsetLeft; //(e.pageX - e.target.offsetLeft);
          e.offsetY = e.target.offsetTop; //(e.pageY - e.target.offsetTop);
        }
        let points = this.points[this.active];

        const mousePos = this.getMousePos(this.element, e);
  
        points[this.activePoint][0] = mousePos.x;
        points[this.activePoint][1] = mousePos.y;
        this.record();
        this.draw();
      } else {
        // we want to select the correct cursor type
        const mousePos = this.getMousePos(this.element, e);
        const localPoints = this.points[this.active];

        let cursorSelected = false;

        if (localPoints.length > 0) {
          // compute distance to next active point
          const closestDistanceInfo = this.pairwiseDistanceMin([mousePos.x, mousePos.y], localPoints);
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
      /*else{
        this.pos1 = this.pos3 - e.clientX;
        this.pos2 = this.pos4 - e.clientY;
        var left = $canvas.css('left');
        var top  = $canvas.css('top');

        left = parseInt(left.substr(0, left.length - 2));
        top  = parseInt(top.substr(0, top.length - 2));

        moveImage(left - pos1 , top - pos2);

        pos3 = e.clientX;
        pos4 = e.clientY;
        $canvas.on('mouseup', scope.stopdrag);
      }*/
  }

  record() {
    console.log('record dummy');
  }

  reCalculatePoints() {
    console.log('recalc points dummy');
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

  dotLineLength(x, y, x0, y0, x1, y1, o) {
    function lineLength(x, y, x0, y0){
      return Math.sqrt((x -= x0) * x + (y -= y0) * y);
    }
    if(o && !(o = function(x, y, x0, y0, x1, y1){
      if(!(x1 - x0)) return {x: x0, y: y};
      else if(!(y1 - y0)) return {x: x, y: y0};
      var left, tg = -1 / ((y1 - y0) / (x1 - x0));
      return {x: left = (x1 * (x * tg - y + y0) + x0 * (x * - tg + y - y1)) / (tg * (x1 - x0) + y0 - y1), y: tg * left - tg * x + y};
    }(x, y, x0, y0, x1, y1), o.x >= Math.min(x0, x1) && o.x <= Math.max(x0, x1) && o.y >= Math.min(y0, y1) && o.y <= Math.max(y0, y1))){
      var l1 = lineLength(x, y, x0, y0), l2 = lineLength(x, y, x1, y1);
      return l1 > l2 ? l2 : l1;
    }
    else {
      var a = y0 - y1, b = x1 - x0, c = x0 * y1 - y0 * x1;
      return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
    }
  }

  hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  getMousePos(canvas, evt) {
    // special handling for touch events
    if (evt.touches) {
      evt = evt.touches[0];
    }

    const rect = canvas.getBoundingClientRect();
    let x = evt.clientX - rect.left;
    let y = evt.clientY - rect.top;

    const t = this.ctx.getTransform();

    const transformMatrix = inv([[t.a, t.c, t.e], [t.b, t.d, t.f], [0, 0, 1]]);

    const transformedMouse = multiply(transformMatrix, [x, y, 1]);

    x = transformedMouse[0];
    y = transformedMouse[1];

    return {
      x, y
      };
  }

  stopdrag(event) {
    const e = event;
    e.preventDefault();

    if (this.dragging) {
      const act = new MovedPointAction(this.points[this.active][this.activePoint], this.draggingOrigPoint);
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
      let points = this.points[this.active];
      let x, y, dis, lineDis, insertAt = points.length;

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
      const distanceInfo = this.pairwiseDistanceMin([x,y], points);
      const minDis = distanceInfo.distance;
      const minDisIndex = distanceInfo.index;
      if (minDis < 10 && minDisIndex >= 0) {
        this.activePoint = minDisIndex;
        this.dragging = true; // enable dragging mode

        this.draggingOrigPoint = [...this.points[this.active][this.activePoint]];

        return false;
      }

      // compute closest distance to line (in case of inserting a point in between)
      let lineInsert = false;
      for (let i = 1; i < points.length; i++) {
          lineDis = this.dotLineLength(
            x, y,
            points[i][0], points[i][1],
            points[i - 1][0], points[i - 1][1],
            true
          );
          if (lineDis < this.distanceThreshold) {
            insertAt = i;
            lineInsert = true;
            break;
          }
      }

      if (!lineInsert) {
        // check whether you did click onto another polygon
        for (const [index, polygon] of this.points.entries()) {
          if (index === this.active) {
            continue;
          }
          if (inside([x,y], polygon)) {
            // clicke inside a non active polygon
            this.active = index;
            this.draw();
            return false;
          }
        }

      }

      // place at correct place (maybe close to line --> directly on the line)
      const act = new AddPointAction([Math.round(x), Math.round(y)], insertAt, this.points[this.active]);
      this.addAction(act);
      //points.splice(insertAt, 0, [Math.round(x), Math.round(y)]);
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

    for (const [index, polygon] of this.points.entries()) {
      this.drawSingle(polygon, index);
    }
    this.ctx.drawImage(this.image, this.xImage, this.yImage, this.image.width * this.scale, this.image.height * this.scale);

  }

  onResized(event: ResizedEvent) {
    alert(event.newWidth);
    alert(event.newHeight);
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

      //this.ctx.canvas.width = this.ctx.canvas.width;

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
      if (this.active ===  p && this.enabled) {
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
    const fillColor = this.hexToRgb(this.palette[p]);
    this.ctx.fillStyle = 'rgba(' + fillColor.r + ',' + fillColor.g + ',' + fillColor.b + ',0.1)';
    this.ctx.fill();
    this.ctx.stroke();
  }

  resize() {
    const newHeight = this.element.height();
    const newWidth  = this.element.width();
    const aspectRatio = this.image.width / this.image.height;
    //$canvas.attr('height', newHeight).attr('width', newWidth);
    //$canvas.attr('height', $canvas[0].offsetHeight).attr('width', $canvas[0].offsetWidth);
    this.renderer.setStyle(this.canvas.nativeElement, 'height', newHeight);
    this.renderer.setStyle(this.canvas.nativeElement, 'width', newWidth);
    this.renderer.setStyle(this.canvas.nativeElement, 'height', this.element.offsetHeight);
    this.renderer.setStyle(this.canvas.nativeElement, 'width', this.element.offsetWidth);

    if (this.enabled){
      this.originalSize = {
        width:  newWidth,
        height: newWidth/aspectRatio
      };
    }else {
      this.reCalculatePoints();
    }
    this.draw();
  }


  init(){
    var activePoint, settings = {};
    var $canvas, ctx, image;
    var zoomIncrement = 120;
    var newHeight, newWidth;
    var aspectRatio;
    var pageX, pageY;
    //var originalPoints = angular.copy(scope.points);

    /*if (!scope.points) {
      scope.points = [[]];            
    }
    if (!scope.active) {
      scope.active = 0;
    }*/
    ctx = this.canvas.nativeElement.getContext('2d');
    const element = this.canvas.nativeElement;
    this.image = new Image();

    //element.wdith=element.parentNode.clientWidth;
    //alert(this.container.nativeElement.height);
    element.height=500;//element.parentNode.clientHeight;

    this.image.onload = () => {
      this.draw();
    }

    this.image.src = this.imageUrl;
    //if (image.loaded) scope.resize();
    //$canvas.css({background: 'url('+image.src+')'});
    //this.renderer.setStyle(this.canvas.nativeElement, 'background', 'url(' + this.image.src + ')');
    //this.renderer.setStyle(this.canvas.nativeElement, 'backgroundRepeat', 'no-repeat');
    //this.renderer.setStyle(this.canvas.nativeElement, 'position', 'relative');
    //this.renderer.setStyle(this.canvas.nativeElement, 'left', 0 + 'px');
    //this.renderer.setStyle(this.canvas.nativeElement, 'top', 0 + 'px');
    //this.renderer.setStyle(this.canvas.nativeElement, 'width', '300px');
    //this.renderer.setStyle(this.canvas.nativeElement, 'height', '300px');
    //$canvas.css({backgroundSize: element.width() + "px" });
    /*$canvas.css({backgroundSize: "contain"});
    $canvas.css({backgroundRepeat: 'no-repeat'});
    $canvas.css('position','relative');
    $canvas.css('left', 0 + 'px');
    $canvas.css('top' , 0 + 'px');*/

    /*element.addEventListener('mousedown', e => {
      this.mousedown(e);
    });*/
    /*element.addEventListener('mouseup', e => {
      this.stopdrag(e);
    });*/

    function moveImage(x, y) {
      if(y <= 0 && y > parseInt(element.height()) - parseInt(newHeight)){
        if(y <= 0){
          //$canvas.css('top', Math.round(y) + 'px');
          this.renderer.setStyle(element, 'top', Math.round(y) + 'px');
        }
        if(y > parseInt(element.height()) - parseInt(newHeight)){
          //$canvas.css('top', Math.round(y) + 'px');
          this.renderer.setStyle(element, 'top', Math.round(y) + 'px');
        }
      }
      else {
        if(y > 0){
          //$canvas.css('top', '0px');
          this.renderer.setStyle(element, 'top', '0px');
        }
        if(y < parseInt(element.height()) - parseInt(newHeight)){
          //$canvas.css('top', parseInt(element.height()) - parseInt(newHeight) + 'px');
          this.renderer.setStyle(element, 'top', parseInt(element.height()) - parseInt(newHeight) + 'px');
        }
      }

      //set left - x direction
      if(x <= 0 && x > parseInt(element.width()) - parseInt(newWidth)){
        if(x <= 0){
          //$canvas.css('left', Math.round(x) + 'px');
          this.renderer.setStyle(element, 'left', Math.round(x) + 'px');
        }
        else {
          //$canvas.css('left', '0px');
          this.renderer.setStyle(element, 'left', '0px');
        }
        if(x > parseInt(element.width()) - parseInt(newWidth)){
          //$canvas.css('left', Math.round(x) + 'px');
          this.renderer.setStyle(element, 'left', Math.round(x) + 'px');
        }
        else {
          //$canvas.css('left', parseInt(element.width()) - parseInt(newWidth) + 'px');
          this.renderer.setStyle(element, parseInt(element.width()) - parseInt(newWidth) + 'px');
        }
      }
      else{
        if(x > 0){
          //$canvas.css('left', '0px');
          this.renderer.setStyle(element, 'left', '0px');
        }
        if(x < parseInt(element.width()) - parseInt(newWidth)){
          //$canvas.css('left', parseInt(element.width()) - parseInt(newWidth) + 'px');
          this.renderer.setStyle(element, parseInt(element.width()) - parseInt(newWidth) + 'px');
        }
      }
    }
    /*
    function reCalculatePoints() {
      if(scope.points && scope.points.length > 0) {
        if (scope.points[0].length > 0){
          var height = newWidth / aspectRatio;
          var width = newWidth;
          var widthRatio = width / scope.originalSize.width;
          var heightRatio = height / scope.originalSize.height;
          if (originalPoints && originalPoints.length > 0) {
            scope.points = angular.copy(originalPoints);
          }
          else {
            originalPoints = angular.copy(scope.points);
          }
          for (var i = 0; i < scope.points.length; i++) {
            var point = scope.points[i];
            for (var j = 0; j < point.length; j++) {
              point[j][1] = Math.round(widthRatio * point[j][1]);
              point[j][0] = Math.round(heightRatio * point[j][0]);
            }
          }
        }
      }
    }
    function zoomIn(){
      newWidth  += zoomIncrement * aspectRatio;
      newHeight += zoomIncrement ;
      $canvas.attr('height', newHeight).attr('width', newWidth);
      reCalculatePoints();
      scope.draw();
      setPositionWhileZoomIn();
    }
    function zoomOut(){            
      if(newWidth > element.width() && newHeight > element.height()){
        newWidth -= zoomIncrement * aspectRatio;
        newHeight -= zoomIncrement ;
        if(newWidth < element.width() && newHeight < element.height()){
          newWidth = element.width() ;
          newHeight = element.height();
        }
        $canvas.attr('height', newHeight).attr('width', newWidth);
        reCalculatePoints();
        scope.draw();
        setPositionWhileZoomOut();
      }
    }
    function setPositionWhileZoomIn(){
      var left = $canvas.css('left');
      var top  = $canvas.css('top');
      left = parseInt(left.substr(0, left.length - 2));
      top  = parseInt(top.substr(0, top.length - 2));
      var xdisl = (pageX * zoomIncrement*aspectRatio) / element.width();
      var ydisl = (pageY * zoomIncrement ) / element.height();
      moveImage(left - xdisl, top - ydisl);
    }
    function setPositionWhileZoomOut(){
      var left = $canvas.css('left');
      var top  = $canvas.css('top');
      left = parseInt(left.substr(0, left.length - 2));
      top  = parseInt(top.substr(0, top.length - 2));
      var xdisl = (pageX * zoomIncrement * aspectRatio) / element.width();
      var ydisl = (pageY * zoomIncrement) / element.height();
      moveImage(left + xdisl, top + ydisl);
    }

    scope.resize = function() {
      newHeight = element.height();
      newWidth  = element.width();
      aspectRatio = image.width / image.height;
      $canvas.attr('height', newHeight).attr('width', newWidth);
      $canvas.attr('height', $canvas[0].offsetHeight).attr('width', $canvas[0].offsetWidth);
      if(scope.enabled){
        scope.originalSize = {
          width:  newWidth,
          height: newWidth/aspectRatio
        };
      }else {
        reCalculatePoints();
      }
      scope.draw();
    };

    scope.move = function(e) {
      e.preventDefault();
      if (scope.enabled) {
        if (!e.offsetX) {
          e.offsetX = (e.pageX - $(e.target).offset().left);
          e.offsetY = (e.pageY - $(e.target).offset().top);
        }
        var points = scope.points[scope.active];
        points[activePoint][0] = Math.round(e.offsetX);
        points[activePoint][1] = Math.round(e.offsetY);
        scope.record();
        scope.draw();
      }
      else{
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        var left = $canvas.css('left');
        var top  = $canvas.css('top');

        left = parseInt(left.substr(0, left.length - 2));
        top  = parseInt(top.substr(0, top.length - 2));

        moveImage(left - pos1 , top - pos2);

        pos3 = e.clientX;
        pos4 = e.clientY;
        $canvas.on('mouseup', scope.stopdrag);
      }
    };

    scope.wheel = function(e){
      e.preventDefault();
      if(scope.enabled){
        return false;
      }
      var theEvent = e.originalEvent.deltaY || e.originalEvent.detail * -1;
      if (theEvent / 120 < 0){
        //scrolling up
        zoomIn();
      }
      else{
        //scrolling down
        zoomOut();
      }
    };

    scope.stopdrag = function(e) {
      e.preventDefault();
      if(scope.enabled) {
        element.off('mousemove');
        scope.record();
        activePoint = null;
      }
      else {
        $canvas.off('mousemove',scope.move);
      }
    };

    scope.rightclick = function(e) {
      e.preventDefault();
      if (!scope.enabled) {
        return false;
      }
      if(!e.offsetX) {
        e.offsetX = (e.pageX - $(e.target).offset().left);
        e.offsetY = (e.pageY - $(e.target).offset().top);
      }
      var x = e.offsetX, y = e.offsetY;
      var points = scope.points[scope.active];
      for (var i = 0; i < points.length; ++i) {
        var dis = Math.sqrt(Math.pow(x - points[i][0], 2) + Math.pow(y - points[i][1], 2));
        if ( dis < 6 ) {
          points.splice(i, 1);
          scope.draw();
          scope.record();
          return false;
        }
      }
      return false;
    };

    scope.mousedown = function(e) {
      e.preventDefault();
      if (scope.enabled) {
        var points = scope.points[scope.active];
        var x, y, dis, minDis = 0, minDisIndex = -1, lineDis, insertAt = points.length;

        if (e.which === 3) {
          return false;
        }

        if (!e.offsetX) {
          e.offsetX = (e.pageX - $(e.target).offset().left);
          e.offsetY = (e.pageY - $(e.target).offset().top);
        }
        var mousePos = ctrl.getMousePos($canvas[0], e);
        x = mousePos.x;
        y = mousePos.y;
        for (var i = 0; i < points.length; ++i) {
          dis = Math.sqrt(Math.pow(x - points[i][0], 2) + Math.pow(y - points[i][1], 2));
          if (minDisIndex === -1 || minDis > dis) {
            minDis = dis;
            minDisIndex = i;
          }
        }
        if (minDis < 6 && minDisIndex >= 0) {
          activePoint = minDisIndex;
          element.on('mousemove', scope.move);
          return false;
        }

        for (var i = 0; i < points.length; ++i) {
          if (i > 1) {
            lineDis = ctrl.dotLineLength(
              x, y,
              points[i][0], points[i][1],
              points[i - 1][0], points[i - 1][1],
              true
            );
            if (lineDis < 6) {
              insertAt = i;
            }
          }
        }

        points.splice(insertAt, 0, [Math.round(x), Math.round(y)]);
        activePoint = insertAt;
        element.on('mousemove', scope.move);

        scope.draw();
        scope.record();
      }
      else {
        pos3 = e.clientX;
        pos4 = e.clientY;
        $canvas.on('mousemove', scope.move);
      }
      return false;
    };

    scope.draw = function() {
      ctx.canvas.width = ctx.canvas.width;
      if(scope.points && scope.points.length > 0) {
        scope.drawSingle(scope.points[scope.active], scope.active);
      }
      for(var p = 0; p < scope.points.length; ++p) {
        var points = scope.points[p];
        if (points.length == 0 || scope.active == p) {
          continue;
        }
        scope.drawSingle(points, p);
      }

    };

    scope.drawSingle = function (points, p) {

      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.strokeStyle = scope.palette[p];
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (var i = 0; i < points.length; ++i) {
        if(scope.active ===  p && scope.enabled) {
          ctx.fillRect(points[i][0] - 2, points[i][1] - 2, 4, 4);
          ctx.strokeRect(points[i][0] - 2, points[i][1] - 2, 4, 4);
        }
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      if(!scope.palette[p]) {
        scope.palette[p] =  '#'+(function lol(m,s,c){return s[m.floor(m.random() * s.length)] + (c && lol(m,s,c-1));})(Math,'0123456789ABCDEF',4)
      }
      var fillColor = ctrl.hexToRgb(scope.palette[p]);
      ctx.fillStyle = 'rgba(' + fillColor.r + ',' + fillColor.g + ',' + fillColor.b + ',0.1)';
      ctx.fill();
      ctx.stroke();
    };

    scope.record = function() {
      scope.$apply();
    };

    scope.$watch('points', function (newVal, oldVal) {
      scope.draw();
    }, true);

    scope.$watch('active', function (newVal, oldVal) {
      if (newVal !== oldVal) scope.draw();
    });

    $(image).load(scope.resize);
    $canvas.on('mousedown', scope.mousedown);
    $canvas.on('contextmenu', scope.rightclick);
    $canvas.on('mouseup', scope.stopdrag);
    $canvas.on('mouseleave', scope.stopdrag);
    $canvas.on('dblclick', function () {
      scope.doubleClick();
    });
    element.on('mousemove', function (e) {
      var rect = element.get(0).getBoundingClientRect();
      pageX = e.pageX - rect.left;
      pageY = e.pageY - rect.top;
      var mousePos = ctrl.getMousePos($canvas[0], e);
    });
    if(scope.enabled) {
      $canvas.on('mousemove', scope.move);
    }
    else {
      $canvas.on('wheel', scope.wheel);
    }*/
  }
  
}
