import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { asyncScheduler, interval, Observable, of, Subject, Subscription } from 'rxjs';
import { filter, switchMap, takeUntil, takeWhile, tap, throttleTime } from 'rxjs/operators';
import { AddLinkAction, ForceTrackEndAction, JointAction, RemoveLinkAction } from 'src/app/models/action';
import { ChangeType } from 'src/app/models/change';
import { Drawer, Pencil, Tool } from 'src/app/models/drawing';
import { Line, Point } from 'src/app/models/geometry';
import { GlobalSegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { GlobalTrackingOMEROStorageConnector } from 'src/app/models/storage-connectors';
import { Link } from 'src/app/models/tracking/data';
import { hexToRgb, pointToPosition, Utils } from 'src/app/models/utils';
import { OmeroAPIService } from 'src/app/services/omero-api.service';
import { TrackingService } from 'src/app/services/tracking.service';
import { UserQuestionsService } from 'src/app/services/user-questions.service';
import {
  checkIntersection,
  colinearPointWithinSegment
} from 'line-intersect';

class Selection {
  id: string;
  frame: number;

  constructor(id: string, frame: number) {
    this.id = id;
    this.frame = frame;
  }
}

/**
 * Draws an arrow on a canvas
 * from: https://stackoverflow.com/a/64756256
 * 
 * @param context canvas context
 * @param fromx source x coordinate
 * @param fromy source y coordinate
 * @param tox target x coordinate
 * @param toy target y coordinate
 */
const draw_arrow = ( context, fromx, fromy, tox, toy ) => {
  const dx = tox - fromx;
  const dy = toy - fromy;
  const headlen = Math.sqrt( dx * dx + dy * dy ) * 0.3; // length of head in pixels
  const angle = Math.atan2( dy, dx );
  context.beginPath();
  context.moveTo( fromx, fromy );
  context.lineTo( tox, toy );
  context.stroke();
  context.beginPath();
  context.moveTo( tox - headlen * Math.cos( angle - Math.PI / 6 ), toy - headlen * Math.sin( angle - Math.PI / 6 ) );
  context.lineTo( tox, toy );
  context.lineTo( tox - headlen * Math.cos( angle + Math.PI / 6 ), toy - headlen * Math.sin( angle + Math.PI / 6 ) );
  context.stroke();
}

function sqr(x) { 
  return x * x 
}

function dist2(v, w) { 
  return sqr(v.x - w.x) + sqr(v.y - w.y) 
}

function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
    
  if (l2 == 0) return dist2(p, v);
    
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    
  if (t < 0) return dist2(p, v);
  if (t > 1) return dist2(p, w);
    
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

function distToSegment(p, v, w) { 
  return Math.sqrt(distToSegmentSquared(p, v, w));
}

const drawSingle = (points: Point[], active: boolean, ctx, color: string, strokeColor: string) => {
  ctx.globalCompositeOperation = 'source-over'; //'destination-over';
  ctx.strokeStyle = strokeColor;
  // small line width (to allow precise segmentation)
  ctx.lineWidth = .2;

  const ticks = new Date().getTime()/1000;

  // perform the filling
  if (!color.startsWith('rgb')) {
    const fillColor = hexToRgb(color);
    ctx.fillStyle = `rgba(${fillColor.r}, ${fillColor.g}, ${fillColor.b}, ${((Math.sin(ticks)+1)*0.5)*0.25+0.1})`;
  } else {
    ctx.fillStyle = color;
  }
  ctx.strokeStyle = ctx.fillStyle;

  // create the path for polygon
  ctx.beginPath();
  for (const point of points) {
    if (active) {
      ctx.fillRect(point[0] - 1, point[1] - 1, 2, 2);
      ctx.strokeRect(point[0] - 1, point[1] - 1, 2, 2);
    }
    ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();

  ctx.fill();
  ctx.stroke();
}


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

  /** Currently visualized frame */
  _activeView: number = 0;

  /** Current source selection for tracking */
  selectedSegment: Selection;
  /** line for connecting selection and target */
  line: Line;

  /** annotate one track in a row */
  fastTrackAnnotation = true;

  /** show tracking overlay */
  showTracking = true;

  showTrackedCells = true;

  /** show segmentation overlay */
  showSegmentation = true;

  preventTwoParents = true;
  maxChildren = 2;
  preventFrameJumps = true;

  /** true when the user wants to select multiple children */
  divisionAnnotation = false;

  cuttingMode = false;
  cuttingLine: Array<Point> = [];

  drawEvent$ = new Subject<Pencil>();

  @Input() _globalSegModel: GlobalSegmentationModel;
  @Input() activeView: number;
  @Output() activeViewChange = new EventEmitter<number>();
  @Input() segUIs: Array<SegmentationUI>;
  @Input() imageId;

  @Output() selectedNode = new EventEmitter<string>();

  protected destroySignal: Subject<void> = new Subject<void>();

  @Output() changedEvent = new EventEmitter<void>();

  trackingConnector: GlobalTrackingOMEROStorageConnector;

  /** image to visualize track ends */
  trackEndImage = null;
  /** image to visualize track begins */
  trackStartImage = null;

  intervalSub: Subscription = null;


  @Input() set segUI(value: SegmentationUI) {
      this._segUI = value;
      this.changedEvent.emit();
  }

  get segUI() {
      return this._segUI;
  }

  @Input() set globalSegModel(segModel) {
    this._globalSegModel = segModel;
    if (segModel) {
      this.trackingService.loadById(this.imageId, this.globalSegModel);
    }
  }

  get globalSegModel() {
    return this._globalSegModel;
  }


  constructor(private userQuestionService: UserQuestionsService,
              private omeroAPI: OmeroAPIService,
              private trackingService: TrackingService) {
    super("ManualTrackingTool");
  }

  ngOnInit() {
    console.log("init");
    console.log(`Image id ${this.imageId}`);

    this.trackEndImage = new Image();
    this.trackEndImage.src = "/assets/close-circle-outline.svg";
    this.trackStartImage = new Image();
    this.trackStartImage.src = "/assets/locate-outline.svg"

    // debounced drawing to reduce load
    this.drawEvent$.pipe(
      throttleTime(30, asyncScheduler, { trailing: true }),
      tap((pencil: Pencil) => this.__draw(pencil))
    ).subscribe();
  }

  ngAfterViewInit() {
    this.trackingService.$currentTrackingModel.subscribe((trCon) => {
      this.trackingConnector = trCon;

      this.trackingConnector.getModel().modelChanged.pipe(
        takeUntil(this.destroySignal)
      ).subscribe((modelChange) =>{
        if (modelChange.changeType == ChangeType.HARD) {
          this.draw()
        }
      });
    });
  }

  ngDestroy() {
    this.destroySignal.next();
    // unsubscribe from render loop
    if (this.intervalSub) {
      this.intervalSub.unsubscribe();
    }
  }

  prepareDraw(): Observable<Drawer> {
    // TODO: that's a bit dirty here. But placing in ngAfterViewInit will lead to test failing due to timeout
    // Create a render loop for pulsing drawing when we would like to make a connection
    if (this.intervalSub == null) {
      this.intervalSub = interval(1000/30).pipe(
        // only run when this tool is active and we are connecting cells
        filter(() => this.show && (this.line != null)),
        tap(() => this.draw())
      ).subscribe();
    }
    return this.segUI.prepareDraw().pipe(
      switchMap(() => of(this))
    );
  }

  @HostListener('document:keyup.x', ['$event'])
  overlayToggle(event) {
      if(this.show) {
          // if the brush tool is shown we do toggle the overlay
          if (this.selectedSegment) {
            this.trackingConnector.getModel().addAction(new ForceTrackEndAction(this.selectedSegment.id));
            this.selectedSegment = null;
          }
      }
  }

  @HostListener('document:keydown.d', ['$event'])
  activateDivisionAnnotation(event) {
      this.divisionAnnotation = true;
  }

  @HostListener('document:keydown.c', ['$event'])
  activateCutting(event) {
      this.cuttingMode = !this.cuttingMode;
  }

  @HostListener('document:keyup.d', ['$event'])
  deactivateDivisionAnnotation(event) {
      this.divisionAnnotation = false;
  }

  draw(pencil: Pencil = null): void {
    this.drawEvent$.next(pencil);
  }

  /**
   * Draw the segmentation using the brushed view
   * @param ctx the canvas context to draw
   */
  __draw(pencil: Pencil = null): void {
    if (pencil) {
        this.pencil = pencil;
        this.ctx = pencil.canvasCtx;
        this.canvasElement = pencil.canvasElement;
    } else {
        // if no new pencil is used we fallback to last one
        pencil = this.pencil;
    }

    if (!pencil) {
      console.warn("Cannot draw tracking due to unedfined pencil!");
      return;
    }

    // clear the view
    pencil.clear();

    const ctx = pencil.canvasCtx;

    const trModel = this.trackingConnector.getModel();

    const forwardTracking = this.selectedSegment && this.selectedSegment.frame < this.activeView;

    // 1. draw the backgound image
    this.segUIs[this.activeView].drawImage(ctx);

    if (this.selectedSegment) {
      // forward track: draw parent in frame before
      drawSingle(this.segUIs[this.selectedSegment.frame].segModel.segmentationData.getPolygon(this.selectedSegment.id).points, false, ctx, "#ffffff", "#ffffff");
    }

    // draw the overlay
    if (this.showSegmentation) {
      if (this.showTrackedCells) {
        this.segUIs[this.activeView].drawPolygonsAdv(ctx, false, p => true, ({uuid, poly}) => "#ffff00");
      } else {
        this.segUIs[this.activeView].drawPolygonsAdv(ctx, false, p => {
          return (this.selectedSegment || trModel.trackingData.listFrom(p[0]).length == 0)
            && (!forwardTracking || trModel.trackingData.listTo(p[0]).length == 0); // forwardTracking => only show parentless cells
        },
        ({uuid, poly}) => "#ffff00");
      }
    }

    if (this.cuttingMode && this.cuttingLine.length == 2) {
      // draw cutting line
      this.drawLine(ctx, this.cuttingLine[0], this.cuttingLine[1], "rgb(255, 255, 255)", 1)
    }

    // draw existing trackings
    for (const [uuid, poly] of this.segUIs[this.activeView].segModel.getVisiblePolygons()) {
      // do we have a link to the future
      const outgoingLinks = trModel.trackingData.listFrom(uuid);
      const incomingLinks = trModel.trackingData.listTo(uuid);

      if(this.showTracking) {
        // render outgoing links (red)
        for (const oLink of outgoingLinks) {
          const sourceCenter = this.segUIs[this.activeView].segModel.segmentationData.getPolygon(oLink.sourceId)?.center;
          const targetCenter = this.segUIs[this.activeView+1].segModel.segmentationData.getPolygon(oLink.targetId)?.center;
          if (sourceCenter && targetCenter) {
            let color = "rgb(255, 0, 0)"
            if (outgoingLinks.length > 1) {
              color = "rgb(0, 0, 255)"
            }

            if(Utils.euclideanDistance(sourceCenter, targetCenter) < 2) {
              this.drawCircle(ctx, sourceCenter, color, .5);
            } else {
              this.drawArrow(ctx, sourceCenter, targetCenter, color, 1.);
            }
          }
        }

        // render incoming links (gray)
        for (const iLink of incomingLinks) {
          const sourceCenter = this.segUIs[this.activeView-1].segModel.segmentationData.getPolygon(iLink.sourceId)?.center;
          const targetCenter = this.segUIs[this.activeView].segModel.segmentationData.getPolygon(iLink.targetId)?.center;
          if (sourceCenter && targetCenter) {

            const color = "rgb(100, 100, 100)"

            if(Utils.euclideanDistance(sourceCenter, targetCenter) < 2) {
              this.drawCircle(ctx, sourceCenter, color, .5);
            } else {
              this.drawArrow(ctx, sourceCenter, targetCenter, color, 1.);
            }
          }

        }

        // visualize birth events
        if (incomingLinks.length == 0) {
          const center = poly.center;
          const size = 10;
          ctx.drawImage(this.trackStartImage, center[0] - size/2, center[1] - size/2, size, size);  
        }
      }
    }

    // draw track ends
    for (const [uuid, poly] of this.segUIs[this.activeView].segModel.getVisiblePolygons()) {
      if (this.trackingConnector.getModel().trackingData.forcedTrackEnds.has(uuid)) {
        const center = poly.center;
        const size = 10;
        ctx.drawImage(this.trackEndImage, center[0] - size/2, center[1] - size/2, size, size);
      }
    }

    // draw linking line
    if (this.selectedSegment && this.line) {

      // make it red
      const color = "rgb(255, 0, 0)";

      if(Utils.euclideanDistance(this.line.points[0], this.line.points[1]) < 2) {
        this.drawCircle(ctx, this.line.points[0], color, .5);
      } else {
        this.drawArrow(ctx, this.line.points[0], this.line.points[1], color, 1.);
      }
    }
  }

  /**
   * Draws an arrow on the canvas
   * @param ctx canvas context
   * @param from source point
   * @param to target point
   * @param color color of the arrow
   * @param width stroke width
   */
  drawArrow(ctx, from: Point, to: Point, color: string, width: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    draw_arrow(ctx, ...from, ...to);
  }

  /**
   * Draws an arrow on the canvas
   * @param ctx canvas context
   * @param from source point
   * @param to target point
   * @param color color of the arrow
   * @param width stroke width
   */
   drawCircle(ctx, from: Point, color: string, radius: number, width: number = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    // draw circle
    ctx.beginPath();
    ctx.arc(from[0], from[1], radius, 0, 2 * Math.PI);
    ctx.stroke();
  }

  /**
   * Draws a line on a canvas
   * @param ctx canvas context
   * @param from source point
   * @param to target point
   * @param color color of the line
   * @param width stroke width of the line
   */
  drawLine(ctx, from: Point, to: Point, color: string, width: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
  }

  /**
   * Stops user annotation of a track
   */
  stopTrackAnnotation() {
    const preSource = this.selectedSegment;
    this.selectedSegment = null;

    if (preSource) {
      // when we have changed something --> redraw
      this.draw();
    }
  }

  /**
   * Handles pointer (mouse or toch) down events
   * Activates increase/decrease brush
   * 
   * @param event event
   */
  onTap(event: any): boolean {
    // check whether you did click onto another polygon
    const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
    const x = mousePos.x;
    const y = mousePos.y;

    const segModel = this.globalSegModel.getLocalModel(this.activeView);
    for (const [index, polygon] of segModel.getVisiblePolygons()) {
        if (polygon.isInside([x, y])) {
            // clicke inside a non active polygon

            if (!this.selectedSegment && this.activeView < this.globalSegModel.segmentationModels.length - 1) {
              this.selectTrackSource(index, this.activeView);
              //this.source = new Selection(index, this.activeView);

              //this.segModel.activePolygonId = index;
              //this.activeViewChange.emit(this.activeView + 1);
              return true;
            } else {
              // make the connection
              let sourceId = null;
              let targetId = null;
              let targetFrame = -1;
              let sourceFrame = -1;
              if (this.selectedSegment.frame < this.activeView) {
                // forward track
                sourceId = this.selectedSegment.id;
                sourceFrame = this.selectedSegment.frame;
                targetId = index;
                targetFrame = this.activeView;
              } else if (this.selectedSegment.frame > this.activeView) {
                // backward track
                sourceId = index;
                sourceFrame = this.activeView;
                targetId = this.selectedSegment.id;
                targetFrame = this.selectedSegment.frame;
              } else {
                this.userQuestionService.showError("Cannot link between segmentations of the same frame!")
                return true;
              }

              // that's the new link we want to create
              const link = new Link(sourceId, targetId);

              // safety checks
              if (this.preventTwoParents) {
                if (this.trackingConnector.getModel().trackingData.listTo(targetId).length >= 1) {
                  // we do not allow to have two parents!
                  this.userQuestionService.showError("This link is not possible as the target cell already has a parent!");
                  return;
                }
              }
              if (this.trackingConnector.getModel().trackingData.listFrom(sourceId).length >= this.maxChildren) {
                this.userQuestionService.showError(`This cell already has reached the maximum number of ${this.maxChildren} children`);
                return;
              }
              if (this.preventFrameJumps && Math.abs(sourceFrame - targetFrame) > 1) {
                this.userQuestionService.showError("Frame jumps are not allowed! Please only link cells in consecutive frames!");
                return;
              }



              this.userQuestionService.showInfo(`Linking cells ${sourceId} --> ${targetId}`);
              this.trackingConnector.getModel().addAction(new AddLinkAction(link));
              if (this.divisionAnnotation) {
                // do nothing because we want to add another child
              }
              else if (this.fastTrackAnnotation) {
                // continue to track the same object
                if (targetFrame < this.globalSegModel.segmentationModels.length - 1) {
                  // only when we are not reaching the end!
                  this.selectTrackSource(targetId, targetFrame);
                } else {
                  this.stopTrackAnnotation();
                }
                //this.source = new Selection(targetId, targetFrame+1);
                //this.activeViewChange.emit(this.activeView + 1);
              } else {
                this.stopTrackAnnotation();
              }
              //this.changedEvent.emit();
              return true;
            }
        }
    }

    if (this.selectedSegment) {
      this.stopTrackAnnotation();
    }
    //this.draw();

    return true;    
  }

  onPress(event) {
    return true;
  }

  onMove(event: any): boolean {
    const mousePos = Utils.screenPosToModelPos(Utils.getMousePosMouse(this.canvasElement, event), this.ctx);
    const x = mousePos.x;
    const y = mousePos.y;

    const ctx = this.ctx;

    if (this.selectedSegment) {
      // draw line from center to mouse
      const segModel = this.globalSegModel.getLocalModel(this.activeView);
      let targetPoint: Point = [x,y]
      for (const [index, polygon] of segModel.getVisiblePolygons()) {
        if (polygon.isInside([x, y])) {
          targetPoint = polygon.center;
        }
      }

      if (this.activeView > this.selectedSegment.frame) {
        this.line = new Line(...this.globalSegModel.getLocalModel(this.selectedSegment.frame).segmentationData.getPolygon(this.selectedSegment.id).center, ...targetPoint);
      } else if (this.activeView < this.selectedSegment.frame) {
        this.line = new Line(...targetPoint, ...this.globalSegModel.getLocalModel(this.selectedSegment.frame).segmentationData.getPolygon(this.selectedSegment.id).center);        
      } else {
        // do not draw: no tracking in same frame
      }
      this.draw();
    }

    return false;
  }

  onPanStart(event: any): boolean {
    if (this.cuttingMode) {
      event.preventDefault();

      // Notify change event
      //this.changedEvent.emit();
      //this.draw();
      const pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
      this.cuttingLine = [[pointerPos.x, pointerPos.y]];
      return true;
    }

    return false;
  }

  onPan(event: any): boolean {
    if (this.cuttingMode) {
      const pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

      const point: Point = [pointerPos.x, pointerPos.y]

      if (this.cuttingLine.length == 2) {
        this.cuttingLine[1] = point;
      } else {
        this.cuttingLine.push(point);
      }

      // Notify change
      //this.changedEvent.emit();
      this.draw();
      return true;
    }

    return false;
  }

  /**
   * 
   * @param lineA first line
   * @param lineB second line
   * @returns true when the lines are intersecting and false otherwise
   */
  lineIntersection(lineA: [Point, Point], lineB: [Point, Point]): boolean {
    return checkIntersection(...lineA[0], ...lineA[1], ...lineB[0], ...lineB[1]).type == "intersecting";
  }

  onPanEnd(event: any): boolean {
    // TODO: remove all the edges

    if (this.cuttingMode) {
      const trModel = this.trackingConnector.getModel();
      const segModel = this.globalSegModel.getLocalModel(this.activeView);

      // TODO: this is unsafe when the outgoing edge leads not to the next view
      const nextModel = this.globalSegModel.getLocalModel(this.activeView+1);

      // array for links to cut
      const cuttedLinks: Array<Link> = [];

      // loop over visible polyogns
      for (const [index, polygon] of segModel.getVisiblePolygons()) {
        // list of the outgoing edges
        const outgoingEdges = trModel.trackingData.listFrom(index);
        for (const link of outgoingEdges) {
          // create line for the link
          const linkLine: [Point, Point] = [polygon.center, nextModel.segmentationData.getPolygon(link.targetId).center];

          // check whether line intersects with the human drawn line
          if (Utils.euclideanDistance(linkLine[0], linkLine[1]) > 1) {
            if(this.lineIntersection(linkLine, this.cuttingLine as [Point, Point])) {
              cuttedLinks.push(link);
            }
          } else {
            // for super short links intersection can be difficult
            const distance = distToSegment(pointToPosition(polygon.center), pointToPosition(this.cuttingLine[0]), pointToPosition(this.cuttingLine[1]));
            if (distance < 2) {
              cuttedLinks.push(link);
            }
          }
        }
      }

      // removing action into a joint action
      const removeActions = [];
      for (const link of cuttedLinks) {
        removeActions.push(new RemoveLinkAction(link.sourceId, link.targetId));
      }

      console.log(cuttedLinks);
      trModel.addAction(new JointAction(removeActions));

      this.userQuestionService.showInfo(`Removed ${removeActions.length} tracking links!`)

      this.cuttingLine = [];
      //this.changedEvent.emit();
      this.draw();
      return true;
    }
  }


  /**
   * Selects earliest cell to annotate
   */
  selectNextCell(): void {
    this.stopTrackAnnotation();

    const trData = this.trackingConnector.getModel().trackingData;

    let frame = 0;
    for (const segUI of this.segUIs) {
      let out_candidate = null;
      // loop over all visible polygons in the segmentation model
      for (const [id, poly] of segUI.segModel.getVisiblePolygons()) {
        // scan for successors
        const targetList = this.trackingConnector.getModel().trackingData.listFrom(id);
        // scan for predecessors
        const sourceList = this.trackingConnector.getModel().trackingData.listTo(id);

        if (sourceList.length == 0 && frame > 0) {
          // when we have no parent, we need to find that first
          this.selectTrackTarget(id, frame);
          return;
        }
        if (targetList.length == 0 && !(trData.forcedTrackEnds.has(id)) && frame < (this.segUIs.length-1)) {
          // after the and: if this is a forced track end we do not need any outgoing links!!!

          // we have no outgoing link --> we need to track this
          // but having sources is more important --> memorize
          if (!out_candidate) {
            out_candidate = id;
          }
          // TODO: move view to center id cell
        }
      }
      // no missing source link found --> check whether we had a missing outgoing link
      if (out_candidate) {
        this.selectTrackSource(out_candidate, frame);
        return;
      }

      frame += 1;
    }

    this.userQuestionService.showInfo("No cells with missing links found! Seems you have a fully annotated tracking!");
  }

  /**
   * Selects a source for tracking
   * @param id source segmentation id
   * @param frame frame for the segmentation
   */
  selectTrackSource(id: string, frame: number) {
    // create selection object
    this.selectedSegment = new Selection(id, frame);
    // jump to next cell to select forward tracking
    this.activeViewChange.emit(frame + 1);
    this.userQuestionService.showInfo(`"Selected source: ${id}"`)

    this.selectedNode.emit(id);
  }

  /**
   * Select a target for tracking and perform backtracking
   * @param id target segmentaiton id
   * @param frame segmentation frame
   */
  selectTrackTarget(id: string, frame: number) {
    // create selection object
    this.selectedSegment = new Selection(id, frame);
    this.activeViewChange.emit(frame - 1);
    this.userQuestionService.showInfo(`Selected target: ${id}. Backtrack`);

    this.selectedNode.emit(id);
  }

  get canRedo(): boolean {
    return this.trackingConnector && this.trackingConnector.getModel().canRedo;
  }

  get canUndo(): boolean {
    return this.trackingConnector && this.trackingConnector.getModel().canUndo;
  }

  redo(): void {
    if (this.canRedo) {
      this.trackingConnector.getModel().redo();
    }
  }

  undo(): void {
    if (this.canUndo) {
      this.trackingConnector.getModel().undo();
    }
  }

  delete() {
    console.log("Not yet implemented!");

    const trModel = this.trackingConnector.getModel();

    for (const nodeId of this.trackingService.selectedNodes) {

      const touchedLinks = trModel.trackingData.links.filter(link => nodeId == link.sourceId || nodeId == link.targetId);

      for (const link of touchedLinks) {
        trModel.addAction(new RemoveLinkAction(link.sourceId, link.targetId));
      }

      /**const frame = this.globalSegModel.getFrameById(nodeId)

      this.globalSegModel.getLocalModel(frame).addAction(new RemovePolygon(nodeId));*/
    }
    this.trackingService.selectedNodes = [];

    for (const edge of this.trackingService.selectedEdges) {
      const source = edge["source"];
      const target = edge["target"];

      // remove the link corresponding to the selected edge
      trModel.addAction(new RemoveLinkAction(source, target));
    }
    this.trackingService.selectedEdges = [];
  }
}
