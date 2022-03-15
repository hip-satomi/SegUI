import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ChangeLabelActivityAction, ChangePolygonPoints, JointAction, SelectPolygon} from 'src/app/models/action';
import { Drawer, Pencil, Tool } from 'src/app/models/drawing';
import { ApproxCircle, Point, Polygon, Rectangle } from 'src/app/models/geometry';
import { GlobalSegmentationModel, LocalSegmentationModel } from 'src/app/models/segmentation-model';
import { SegmentationUI } from 'src/app/models/segmentation-ui';
import { Position, Utils } from 'src/app/models/utils';
import { polygon } from 'polygon-tools';

import { rotate, create, all, subtract, multiply, add } from 'mathjs';
const math = create(all);


const tree = require( 'tree-kit' ) ;

// as a ES module
import RBush from 'rbush';
import { AnnotationLabel } from 'src/app/models/segmentation-data';
import { UserQuestionsService } from 'src/app/services/user-questions.service';
import { BrushState, StateService } from 'src/app/services/state.service';

/**
 * Brush drawing modes
 */
enum BrushMode {
    Increase,
    Decrease
}

@Component({
  selector: 'app-brush',
  templateUrl: './brush.component.html',
  styleUrls: ['./brush.component.scss'],
})
export class BrushComponent extends Tool implements Drawer, OnInit {

    // input the current segmentation models and ui
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

    /** Current mouse/touch pos */
    pointerPos: Position;

    /** Brush is actively drawing */
    brushActivated = false;

    /** Current brush mode */
    brushMode = BrushMode.Increase;

    /** Synched with segmentation model? */
    dirty = false;

    /** Control key (can be used for moving) */
    controlKeyDown = false;

    /** Drawing elements */
    ctx;
    canvasElement;
    pencil: Pencil;


    /* Brush configuration variables (size, ...) in state */
    brushState: BrushState;

    /* track the polygons that get changed while drawing */
    changedPolygons = new Map<string, Polygon>();

    @Output()
    changedEvent = new EventEmitter<void>();

    constructor(private userQuestions: UserQuestionsService,
    private stateService: StateService) {
        super("BrushTool");

        // get brush state from state service
        this.brushState = stateService.brushState;
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

    @HostListener('document:keydown.control', ['$event'])
        ctrlKeyDown(event) {
        this.controlKeyDown = true;
    }

    @HostListener('document:keyup.control', ['$event'])
        ctrlKeyUp(event) {
        this.controlKeyDown = false;
    }

    /**
     * Use the keydown event (for numbers) to switch between label classes efficiently
     * @param event keydown event
     */
    @HostListener('document:keydown', ['$event'])
    keyDown(event) {
        if (this.show) {
            const match = event.key.match(/(\d)/g);
            if (match) {
                // compensate '1' index start ('1' maps to 0)
                const index = Number.parseInt(match[0]) - 1
                if(index < this.globalSegModel?.labels.length && !this.globalSegModel?.labels[index].active) {
                // activate the indexed label
                this.globalSegModel?.addAction(new ChangeLabelActivityAction(this.globalSegModel.labels[index].id, true));
                }
            }
        }
    }

    /**
     * Returns the currently active polygon
     */
    get currentPolygon(): Polygon {
        return this.localSegModel.activePolygon;
    }

    /**
     * Returns the list of annotation laels
     */
    get labels(): AnnotationLabel[] {
        return this.globalSegModel?.segmentationData.labels;
    }

    /**
     * Get the correct drawing color for a polygon
     * @param uuid polygon id
     * @param poly polygon object
     * @returns 
     */
    getPolyColor(uuid, poly) {
        const label = this.globalSegModel.segmentationData.labels[this.localSegModel.segmentationData.getPolygonLabel(uuid)]
        const mode = label.color;

        if (mode == 'random') {
            // when random colors are activated use the internal polygon color
            return poly.color;
        } else {
            // when a specific label color is activated use this label color
            return label.color;
        }
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

    // clear the view
    pencil.clear();

    const ctx = pencil.canvasCtx;

    if (this.currentPolygon) {
        // get current polygon color for brush visualization
        ctx.strokeStyle = this.getPolyColor(this.localSegModel.activePolygonId, this.currentPolygon);
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
        // draw
        this.segUI.drawPolygonsAdv(ctx, false,
            // filter only polygons with visible label
            (p: [string, Polygon]) => {
                return this.globalSegModel.segmentationData.labels[this.localSegModel.segmentationData.getPolygonLabel(p[0])].visible
            },
            ({uuid, poly}) => this.getPolyColor(uuid, poly)
        );
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

        if(this.controlKeyDown) {
            // when the control key is down --> other behavior than just drawing
            return false;
        }

        if (this.currentPolygon === null) {
            // add a new polygon if there is none selected

            // with currently active label
            if (this.localSegModel.activeLabels.length === 1) {
                // we have one active label --> create a polygon there
                this.localSegModel.addNewPolygon(this.localSegModel.activeLabels[0].id);
            }
            // first let the user create a label
            else {
                // we have no active label or multpile actives
                this.userQuestions.askForSingleLabel(this.localSegModel).pipe(
                    tap((annLabel: AnnotationLabel) => this.globalSegModel.addAction(new ChangeLabelActivityAction(annLabel.id, true)))
                ).subscribe();
                return;
            }
        }

        // check that we have active labels
        if (this.localSegModel.activeLabels.length == 0) {
            this.userQuestions.showInfo("Please activate a label to use the brush!")
            return;
        }
        // check that we currently draw with a polygon of an active label --> otherwise switch automatically
        else if (!this.localSegModel.getPolygonLabel(this.localSegModel.activePolygonId).active) {
            // select a polygon from an active label
            const polygons = this.localSegModel.getActivePolygons();

            if (polygons.length == 0) {
                this.localSegModel.addNewPolygon(this.localSegModel.activeLabels[0].id)
            } else {
                const emptyPolygons = polygons.filter(([id, poly]) => poly.points.length == 0);

                if (emptyPolygons.length > 0) {
                    this.localSegModel.addAction(new SelectPolygon(emptyPolygons[0][0]));
                } else {
                    // add an empty polygon
                    this.localSegModel.addNewPolygon(this.localSegModel.activeLabels[0].id)
                }
            }
        }

        this.brushActivated = true;
        this.changedPolygons = new Map<string, Polygon>();

        this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

        if (this.currentPolygon.numPoints === 0) {
            // current polygon is empty --> can only increase
            this.brushMode = BrushMode.Increase;
        } else {
            // measure brush intersection with current polygon
            const circle = new ApproxCircle(this.pointerPos.x, this.pointerPos.y, this.brushSize);
            let inter: Point[][];
            if (this.currentPolygon.numPoints === 0) {
                inter = [];
            } else {
                inter = polygon.intersection(this.currentPolygon.points, circle.points);
            }
            
            if (inter.length === 0 || event.button === 2) {
                // no intersection with current polygon --> Decrease
                this.brushMode = BrushMode.Decrease;
            } else {
                // intersection with current polygon --> Increase
                this.brushMode = BrushMode.Increase;
            }
        }
        //console.log('Brush mode increase?' + this.brushMode);

        // Notify change event
        this.changedEvent.emit();
        return true;
    }

    /**
     * Used to smoothly draw between to positions
     * @param startPos start position
     * @param endPos end position
     * @returns returns a drawn polygon between startPos and endPos
     */
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
        // update pointer position
        const oldPointerPos = Utils.clone(this.pointerPos);
        this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

        if (this.brushActivated) {
            this.dirty = true;
            this.changedPolygons.set(this.localSegModel.activePolygonId, this.currentPolygon);

            // Create smooth drawing path
            const tube = this.smoothBrush(oldPointerPos, this.pointerPos);
            // Increase/Decrease depending on selected mode
            if (this.brushMode == BrushMode.Increase) {
                // increase the current polygon
                this.currentPolygon.join(tube);
            } else {
                // decrease the current polygon
                this.currentPolygon.subtract(tube);
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

                // only do collision checks with active polygons (polygons whoose labels are active)
                for (const [uuid, poly] of this.localSegModel.getActivePolygons()){
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

        // save the changes in segmentation model
        this.commitChanges();

        this.changedEvent.emit();
        return true;
    }

    onMove(event: any): boolean {
        if (this.controlKeyDown) {
            // when the control key is down, we do not consume the event
            return false;
        } else {
            // we consume the event
            return true;
        }
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
        this.userQuestions.activeLabel(this.localSegModel).pipe(
            tap((label: AnnotationLabel) => {
                if (!label.active) {
                    // activate the label
                    this.globalSegModel.addAction(new ChangeLabelActivityAction(label.id, true));
                }
            }),
            tap((label: AnnotationLabel) => {
                this.localSegModel.addNewPolygon(label.id)
            })
        ).subscribe();
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

    // getter and setter for brush state

    get brushSize() {
        return this.brushState.brushSize;
    }

    set brushSize(size: number) {
        this.brushState.brushSize = size;
    }

    get simplificationTolerance() {
        return this.brushState.simplificationTolerance;
    }

    set simplificationTolerance(tol: number) {
        this.brushState.simplificationTolerance = tol;
    }

    get showOverlay() {
        return this.brushState.showOverlay;
    }

    set showOverlay(show: boolean) {
        this.brushState.showOverlay = show;
    }

    get preventOverlap() {
        return this.brushState.preventOverlap;
    }

    set preventOverlap(prevOverlap: boolean) {
        this.brushState.preventOverlap = prevOverlap;
    }

}
