import { Polygon } from 'src/app/models/geometry';
import { UIInteraction, Drawer } from './drawing';
import { AddPointAction, MovePointAction, RemovePolygon } from './action';
import { UIUtils, Utils } from './utils';
import { SegmentationModel } from './segmentation-model';
export class SegmentationUI implements UIInteraction, Drawer {

    segmentationModel: SegmentationModel;
    canvasElement;
    ctx;
    distanceThreshold: number = 25;
    draggingPointIndex = -1;

    /**
     * 
     * @param segmentationModel 
     * @param canvasElement native canvas element
     */
    constructor(segmentationModel: SegmentationModel, canvasElement) {
        this.segmentationModel = segmentationModel;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
    }

    onTap(event) {
        console.log("onTap");
        const e = event;

        e.preventDefault();

        const poly = this.segmentationModel.activePolygon;
        let insertAt = poly.numPoints;

        const mousePos = Utils.getMousePos(this.canvasElement, e);
        const x = mousePos.x;
        const y = mousePos.y;

        // compute closest distance to line (in case of inserting a point in between)
        let lineInsert = false;
        const di = poly.distanceToOuterShape([x, y]);
        if (di.index !== -1 && di.distance < this.distanceThreshold) {
            insertAt = di.index;
            lineInsert = true;
        }

        if (!lineInsert) {
            // check whether you did click onto another polygon
            for (const [index, polygon] of this.segmentationModel.segmentationData.getPolygonEntries()) {
                if (index === this.segmentationModel.activePolygonId) {
                    continue;
                }
                if (polygon.isInside([x, y])) {
                    // clicke inside a non active polygon
                    this.segmentationModel.activePolygonId = index;
                    return false;
                }
            }

        }

        // place at correct place (maybe close to line --> directly on the line)
        const act = new AddPointAction([x, y], insertAt, this.segmentationModel.activePolygonId, this.segmentationModel.segmentationData);
        this.segmentationModel.actionManager.addAction(act);

        this.segmentationModel.activePointIndex = insertAt;
        return false;
    }

    onPress(event) {
        console.log("Press");
    }

    onPanStart(event) {
        console.log('pan start');

        const poly = this.segmentationModel.activePolygon;
        // check whether we will drag something
        const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        const x = mousePos.x;
        const y = mousePos.y;


        // compute closest distance to the polygon (in case of dragging a point)
        const distanceInfo = poly.closestPointDistanceInfo([x, y]);
        const minDis = distanceInfo.distance;
        const minDisIndex = distanceInfo.index;
        if (minDis < 50 && minDisIndex >= 0) {
            // activate dragging by setting the point index
            this.draggingPointIndex = minDisIndex;

            this.segmentationModel.activePointIndex = minDisIndex;
        }
    }

    onPan(event) {
        if (this.draggingPointIndex !== -1) {
            console.log("drag");

            const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

            const polygon = this.segmentationModel.activePolygon;
            this.segmentationModel.actionManager.addAction(new MovePointAction([mousePos.x, mousePos.y],
                                                this.segmentationModel.activePointIndex,
                                                this.segmentationModel.activePolygonId,
                                                this.segmentationModel.segmentationData));
        }
    }

    onPanEnd(event) {
        console.log('pan end');

        this.draggingPointIndex = -1;
    }

    onMove(event) {
        // TODO: should show drag cursor
    }

    delete() {
        if (this.segmentationModel.activePolygon) {
            const removalId = this.segmentationModel.activePolygonId;

            // TODO: this action recording can be dangerous
            this.segmentationModel.actionManager.recordActions();

            this.segmentationModel.addNewPolygon();
            this.segmentationModel.actionManager.addAction(
                    new RemovePolygon(this.segmentationModel.segmentationData,
                                      removalId));

            this.segmentationModel.actionManager.mergeRecordedActions();
        }
    }

    get canSave(): boolean {
        return this.segmentationModel.activePolygon.numPoints > 0;
    }

    save() {
        if (this.canSave) {
            this.segmentationModel.addNewPolygon();
        }
    }

    draw(ctx) {
        this.segmentationModel.draw(ctx);
    }
}
