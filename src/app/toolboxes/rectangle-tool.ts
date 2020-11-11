import { SegmentationUI } from './../models/segmentation-ui';
import { Point, Rectangle } from './../models/geometry';
import { AddPolygon, RemovePolygon, JointAction, ChangePolygonPoints, SelectPolygon, SegmentationAction} from './../models/action';
import { ApproxCircle, Polygon } from 'src/app/models/geometry';
import { Utils, Position, UIUtils } from './../models/utils';
import { ModelChanged } from './../models/change';
import { EventEmitter } from '@angular/core';
import { SegmentationModel } from './../models/segmentation-model';
import { Drawer } from 'src/app/models/drawing';
import { UIInteraction, Deletable } from './../models/drawing';
import { polygon } from 'polygon-tools';


const tree = require( 'tree-kit' ) ;

export class RectangleTool implements UIInteraction, Drawer, Deletable {

    segModel: SegmentationModel;
    segUI: SegmentationUI;
    ctx;
    canvasElement;

    pointerPos: Position;
    rectangleStartPos: Position;
    rectangleEndPos: Position;

    rectangle: Polygon;

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
    constructor(segModel: SegmentationModel, segUI: SegmentationUI, canvasElement) {
        this.segModel = segModel;
        this.segUI = segUI;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
    }

    delete(): boolean {
        if (!this.rectangle) {
            return false;
        }

        const actions: SegmentationAction[] = [];
        for (const [uuid, poly] of this.segModel.segmentationData.getPolygonEntries()) {
            if (this.rectangle.isInside(poly.center)) {
                actions.push(new RemovePolygon(this.segModel.segmentationData, uuid));
            }
        }

        this.segModel.addAction(new JointAction(...actions));

        return true;
    }

    get currentPolygon(): Polygon {
        return this.segModel.activePolygon;
    }

    /**
     * Updates segmentation model and resets the brush tool
     * @param segModel the new segmentation model
     */
    setModel(segModel: SegmentationModel, segUI: SegmentationUI) {
        this.segModel = segModel;
        this.segUI = segUI;
    }

    /**
     * Draw the segmentation using the brushed view
     * @param ctx the canvas context to draw
     */
    draw(ctx: any): void {
        ctx.font = '30px Arial';

        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.fillText('Rectangle Tool', 10, 50);

        if (this.rectangle) {
            ctx.strokeStyle = 'rgb(255, 0, 0)';
            ctx.fillStyle = 'rgb(255, 0, 0, 0.2)';
            this.rectangle.draw(ctx);
            /*ctx.fillRect(this.rectangleStartPos.x,
                this.rectangleStartPos.y,
                this.rectangleEndPos.x - this.rectangleStartPos.x,
                this.rectangleEndPos.y - this.rectangleStartPos.y);*/
        }

        // 1. Draw all other detections
        this.segModel.drawPolygons(ctx, false, ([uuid, poly]) => {
            return !this.rectangle?.isInside(poly.center);
        });
        for (const [uuid, poly] of this.segModel.segmentationData.getPolygonEntries()) {
            if (this.rectangle?.isInside(poly.center)) {
                poly.draw(ctx, true);
            }
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
        this.rectangleStartPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

        // Notify change event
        this.changedEvent.emit();
        return true;
    }
    onPan(event: any): boolean {
        const pointerPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        
        this.rectangleEndPos = pointerPos;

        this.rectangle = new Rectangle(this.rectangleStartPos.x,
                                        this.rectangleStartPos.y,
                                        this.rectangleEndPos.x - this.rectangleStartPos.x,
                                        this.rectangleEndPos.y - this.rectangleStartPos.y);

        this.rectangle.setColor('rgba(255, 0, 0, 0.3)');

        // Notify change
        this.changedEvent.emit();
        return true;
    }

    onPanEnd(event: any): boolean {
        this.brushActivated = false;
        
        this.rectangleEndPos = null;
        this.rectangleStartPos = null;

        this.changedEvent.emit();
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
