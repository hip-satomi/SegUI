import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, delay, map, switchMap, tap } from 'rxjs/operators';
import { AddLinkAction } from 'src/app/models/action';
import { Drawer, Pencil, Tool } from 'src/app/models/drawing';
import { Line, Point, Polygon } from 'src/app/models/geometry';
import { GlobalSegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { GlobalTrackingOMEROStorageConnector, SimpleTrackingOMEROStorageConnector } from 'src/app/models/storage-connectors';
import { Link } from 'src/app/models/tracking/data';
import { SimpleTrackingView } from 'src/app/models/tracking/model';
import { UIUtils, Utils } from 'src/app/models/utils';
import { OmeroAPIService } from 'src/app/services/omero-api.service';
import { TrackingService } from 'src/app/services/tracking.service';
import { UserQuestionsService } from 'src/app/services/user-questions.service';

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

  /** show segmentation overlay */
  showSegmentation = true;

  @Input() globalSegModel: GlobalSegmentationModel;
  @Input() activeView: number;
  @Output() activeViewChange = new EventEmitter<number>();
  @Input() segUIs: Array<SegmentationUI>;
  @Input() imageId;

  protected destroySignal: Subject<void> = new Subject<void>();

  @Output() changedEvent = new EventEmitter<void>();

  trackingConnector: GlobalTrackingOMEROStorageConnector;


  @Input() set segUI(value: SegmentationUI) {
      this._segUI = value;
      this.changedEvent.emit();
  }

  get segUI() {
      return this._segUI;
  }


  constructor(private userQuestionService: UserQuestionsService,
              private omeroAPI: OmeroAPIService,
              private trackingService: TrackingService) {
    super("ManualTrackingTool");
  }

  ngOnInit() {
    console.log("init");
    console.log(`Image id ${this.imageId}`);

  }

  ngAfterViewInit() {
    this.trackingService.$currentTrackingModel.subscribe((trCon) => this.trackingConnector = trCon);

    // TODO: the delay is dirty!!!!! When not using this.globalSegModel was undefined!!
    setTimeout(() => this.trackingService.loadById(this.imageId, this.globalSegModel), 2000);
  }

  ngOnDestroy() {
    this.destroySignal.next();
  }

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

    const trModel = this.trackingConnector.getModel();

    if (this.showSegmentation) {
      this.segUIs[this.activeView].drawPolygons(ctx, false);
    }

    if (this.selectedSegment) {
        // forward track
        UIUtils.drawSingle(this.segUIs[this.selectedSegment.frame].segModel.segmentationData.getPolygon(this.selectedSegment.id).points, false, ctx, "ff0000");
    }

    // draw existing trackings
    for (const [uuid, poly] of this.segUIs[this.activeView].segModel.getVisiblePolygons()) {
      // do we have a link to the future
      const outgoingLinks = trModel.trackingData.listFrom(uuid);
      const incomingLinks = trModel.trackingData.listTo(uuid);

      if(this.showTracking) {
        // render outgoing links (red)
        for (const oLink of outgoingLinks) {
          const sourceCenter = this.segUIs[this.activeView].segModel.segmentationData.getPolygon(oLink.sourceId).center;
          const targetCenter = this.segUIs[this.activeView+1].segModel.segmentationData.getPolygon(oLink.targetId).center;
          this.drawArrow(ctx, sourceCenter, targetCenter, "rgb(255, 0, 0)", 1.);
        }

        // render incoming links (green)
        for (const iLink of incomingLinks) {
          const sourceCenter = this.segUIs[this.activeView-1].segModel.segmentationData.getPolygon(iLink.sourceId).center;
          const targetCenter = this.segUIs[this.activeView].segModel.segmentationData.getPolygon(iLink.targetId).center;
          this.drawArrow (ctx, sourceCenter, targetCenter, "rgb(100, 100, 100)", 1.);
        }
      }
    }

    // draw linking line
    if (this.selectedSegment && this.line) {
      this.drawArrow(ctx, this.line.points[0], this.line.points[1], "rgb(255, 0, 0)", 1);
    }

    // 2. draw the backgound image
    this.segUIs[this.activeView].drawImage(ctx);
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

            if (!this.selectedSegment) {
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
              if (this.selectedSegment.frame < this.activeView) {
                // forward track
                sourceId = this.selectedSegment.id;
                targetId = index;
                targetFrame = this.activeView;
              } else if (this.selectedSegment.frame > this.activeView) {
                // backward track
                sourceId = index;
                targetId = this.selectedSegment.id;
                targetFrame = this.selectedSegment.frame;
              } else {
                this.userQuestionService.showError("Cannot link between segmentations of the same frame!")
                return true;
              }
              this.userQuestionService.showInfo(`Linking cells ${sourceId} --> ${targetId}`);
              this.trackingConnector.getModel().addAction(new AddLinkAction(new Link(sourceId, targetId)));
              if (this.fastTrackAnnotation) {
                // continue to track the same object
                this.selectTrackSource(targetId, targetFrame);
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

    this.selectedSegment = null;
    this.draw();

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

  /**
   * Selects earliest cell to annotate
   */
  selectNextCell(): void {
    // TODO: this function has a problem with divisions!!! We also need to check whether all cells have an incoming edge. If they do not we have to backtrack and then continue tracking forward!

    this.stopTrackAnnotation();

    let frame = 0;
    for (const segUI of this.segUIs) {
      let out_candidate = null;
      for (const [id, poly] of segUI.segModel.getVisiblePolygons()) {
        const targetList = this.trackingConnector.getModel().trackingData.listFrom(id);
        const sourceList = this.trackingConnector.getModel().trackingData.listTo(id);
        if (sourceList.length == 0 && frame > 0) {
          this.selectTrackTarget(id, frame);
          return;
        }
        if (targetList.length == 0) {
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
  }

  get canRedo(): boolean {
    return this.trackingConnector.getModel().canRedo;
  }

  get canUndo(): boolean {
    return this.trackingConnector.getModel().canUndo;
  }

  redo(): void {
    if (this.canRedo) {
      this.trackingConnector.getModel().redo();
      this.draw();
    }
  }

  undo(): void {
    if (this.canUndo) {
      this.trackingConnector.getModel().undo();
      this.draw();
    }
  }
}
