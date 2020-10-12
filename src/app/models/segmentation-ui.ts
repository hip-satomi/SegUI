import { ActionSheetController } from '@ionic/angular';
import { Polygon } from 'src/app/models/geometry';
import { UIInteraction, Drawer } from './drawing';
import { AddPointAction, MovePointAction, RemovePolygon, SelectPolygon } from './action';
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
    constructor(segmentationModel: SegmentationModel, canvasElement, private actionSheetController: ActionSheetController) {
        this.segmentationModel = segmentationModel;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
    }

    onPointerDown(event: any): boolean {
        return false;
    }
    onPointerMove(event: any): boolean {
        return false;
    }
    onPointerUp(event: any): boolean {
        return false;
    }

    onTap(event) {
        console.log("onTap");
        const e = event;

        e.preventDefault();

        const poly = this.segmentationModel.activePolygon;
        let insertAt = poly.numPoints;

        const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
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
        return true;
    }

    onPress(event): boolean {
        event.preventDefault();
        let match: [string, Polygon] = null;
        const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        for (const [id, polygon] of this.segmentationModel.segmentationData.getPolygonEntries()) {
            if (polygon.isInside([mousePos.x, mousePos.y])) {
                match = [id, polygon];
                break;
            }
        }

        if (match) {
            // match contains [uuid, Polygon] of the selected polygon

            // select the polygon
            this.segmentationModel.addAction(new SelectPolygon(this.segmentationModel.segmentationData,
                                                               match[0],
                                                               this.segmentationModel.activePolygonId));

            // show action opportunities
            const actionSheet = this.actionSheetController.create({
                header: 'Cell Actions',
                buttons: [{
                  text: 'Delete',
                  role: 'destructive',
                  icon: 'trash',
                  handler: () => {
                    // create an action to remove the polygon
                    const removeAction = new RemovePolygon(this.segmentationModel.segmentationData, match[0]);
                    // add another polygon for safety
                    this.segmentationModel.addNewPolygon();
                    // execute the remove action
                    this.segmentationModel.addAction(removeAction);
                  }
                }, {
                  text: 'Cancel',
                  icon: 'close',
                  role: 'cancel',
                  handler: () => {
                    console.log('Cancel clicked');
                  }
                }]
              });
            actionSheet.then(as => as.present());
        }

        return true;
    }

    onPanStart(event): boolean {
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
        return true;
    }

    onPan(event): boolean {
        if (this.draggingPointIndex !== -1) {
            console.log("drag");

            const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

            const polygon = this.segmentationModel.activePolygon;
            this.segmentationModel.actionManager.addAction(new MovePointAction([mousePos.x, mousePos.y],
                                                this.segmentationModel.activePointIndex,
                                                this.segmentationModel.activePolygonId,
                                                this.segmentationModel.segmentationData));

            return true;
        }

        return false;
    }

    onPanEnd(event): boolean {
        console.log('pan end');

        if (this.draggingPointIndex !== -1) {
            this.draggingPointIndex = -1;
            return true;
        }

        return false;
    }

    onMove(event): boolean {
        // TODO: should show drag cursor
        return false;
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
