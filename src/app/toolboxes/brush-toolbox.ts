import { Point } from './../models/geometry';
import { AddPolygon, RemovePolygon, JointAction, ChangePolygonPoints, SelectPolygon} from './../models/action';
import { ApproxCircle, Polygon } from 'src/app/models/geometry';
import { Utils, Position, UIUtils } from './../models/utils';
import { ModelChanged } from './../models/change';
import { EventEmitter } from '@angular/core';
import { SegmentationModel } from './../models/segmentation-model';
import { Drawer } from 'src/app/models/drawing';
import { UIInteraction } from './../models/drawing';
import * as simplify from 'simplify-js';
import { polygon } from 'polygon-tools';


const tree = require( 'tree-kit' ) ;

export class BrushTool implements UIInteraction, Drawer {

    segModel: SegmentationModel;
    ctx;
    canvasElement;

    pointerPos: Position;

    brushActivated = false;
    oldPoints: Point[];
    radius = 2;

    increase = true;
    dirty = false;

    simplificationTolerance = 0.2;

    changedEvent = new EventEmitter<void>();

    /**
     * 
     * @param segModel current segmentation model
     * @param canvasElement canvas element for mouse position
     */
    constructor(segModel: SegmentationModel, canvasElement) {
        this.segModel = segModel;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
    }

    get currentPolygon(): Polygon {
        return this.segModel.activePolygon;
    }

    /**
     * Updates segmentation model and resets the brush tool
     * @param segModel the new segmentation model
     */
    setModel(segModel: SegmentationModel) {
        this.segModel = segModel;
    }

    /**
     * Draw the segmentation using the brushed view
     * @param ctx the canvas context to draw
     */
    draw(ctx: any): void {
        ctx.font = '30px Arial';

        ctx.strokeStyle = this.currentPolygon.color;
        ctx.fillText('Brush Tool', 10, 50);

        if (this.pointerPos) {
            ctx.beginPath();
            ctx.arc(this.pointerPos.x, this.pointerPos.y, this.radius, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // 1. Draw all other detections
        this.segModel.drawPolygons(ctx, false);
        // 2. draw the backgound image
        this.segModel.drawImage(ctx);
    }

    /**
     * Handles pointer (mouse or toch) down events
     * Activates increase/decrease brush
     * 
     * @param event event
     */
    onPointerDown(event: any): boolean {
        this.brushActivated = true;
        this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosMouse(this.canvasElement, event), this.ctx);
        this.oldPoints = Utils.tree.clone(this.currentPolygon.points);


        if (this.currentPolygon.numPoints === 0) {
            this.increase = true;
        } else {
            const circle = new ApproxCircle(this.pointerPos.x, this.pointerPos.y, this.radius);
            let inter: Point[][];
            if (this.currentPolygon.numPoints === 0) {
                inter = [];
            } else {
                inter = polygon.intersection(this.currentPolygon.points, circle.points);
            }
            
            if (inter.length === 0) {
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

    /**
     * Handles pointer (mouse/touch) move events
     * Especially cares for live increasing and decreasing of the polygon shape
     * 
     * @param event event
     */
    onPointerMove(event: any): boolean {
        this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosMouse(this.canvasElement, event), this.ctx);
        if (this.brushActivated) {
            this.dirty = true;
            const circle = new ApproxCircle(this.pointerPos.x, this.pointerPos.y, this.radius);
            // Increase/Decrease depending on selected mode
            //this.currentExtension.join(circle);

            if (this.increase) {
                this.currentPolygon.join(circle);
            } else {
                this.currentPolygon.subtract(circle);
            }

            // simplify polygon points
            const points = this.currentPolygon.points.map(p => ({x: p[0], y: p[1]}) );
            const simplePoints = simplify(points, this.simplificationTolerance);
            this.currentPolygon.points = simplePoints.map(sp => [sp.x, sp.y]);

        }
        // Notify change
        this.changedEvent.emit();
        return true;
    }

    /**
     * 
     * @param event 
     */
    onPointerUp(event: any): boolean {
        this.brushActivated = false;
        this.pointerPos = null;

        this.commitChanges();

        this.changedEvent.emit();
        return true;
    }

    onTap(event: any): boolean {
        // find the polygon that is hit by the mouse
        this.pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        for (const [id, poly] of this.segModel.segmentationData.getPolygonEntries()) {
            if (poly.isInside([this.pointerPos.x, this.pointerPos.y])) {
                // commit the changes to the actual poly
                this.commitChanges();

                // select the polygon
                const action = new SelectPolygon(this.segModel.segmentationData, id, this.segModel.activePolygonId);
                this.segModel.addAction(action);

                // notify changes
                this.changedEvent.emit();
                return true;
            }
        }
        return true;
    }

    onPress(event: any): boolean {
        return false;
    }
    onPanStart(event: any): boolean {
        return true;
    }
    onPan(event: any): boolean {
        return true;
    }
    onPanEnd(event: any): boolean {
        return true;
    }
    onMove(event: any): boolean {
        return true;
    }

    commitChanges() {
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

    stop() {
        this.commitChanges();
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
