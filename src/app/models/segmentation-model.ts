import { Serializable, JsonProperty } from 'typescript-json-serializer';
import { ModelChanged, ChangeType, ChangableModel } from './change';
import { EventEmitter } from '@angular/core';
import { SegmentationData } from './segmentation-data';
import { UIUtils } from './utils';
import { Polygon, Point } from './geometry';
import { ActionManager, AddEmptyPolygon, SelectPolygon, PreventUndoActionWrapper, Action, JointAction } from './action';
import { SynchronizedObject } from './storage';
import { Subscription, Observable, combineLatest } from 'rxjs';

/**
 * Segmentation model contains all the information of the segmentation
 * 
 * 
 */
@Serializable()
export class SegmentationModel {

    // action Manager that contains the actions forming the segmentation
    @JsonProperty()
    actionManager: ActionManager;

    onModelChange = new EventEmitter<ModelChanged<SegmentationModel>>();

    // this is the raw data for segmentation
    segmentationData: SegmentationData = new SegmentationData();


    constructor() {

        this.actionManager = new ActionManager(0.5);

        // clear segmentation data
        this.clear();
        // load the image
        //this.loadImage();

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.notfiyModelChanged();
        });
    }

    /**
     * Function is called automatically after deserialization
     * 
     * Has to reconstruct the polygons from actions
     */
    onDeserialized() {
        console.log(this);
        // after deserialization load the image
        //this.loadImage();

        // clear the model
        this.clear();

        // reapply actions from action manager
        this.actionManager.reapplyActions({segmentationData: this.segmentationData});

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.notfiyModelChanged();
        });
    }

    notfiyModelChanged() {
        this.onModelChange.emit(new ModelChanged<SegmentationModel>(this, ChangeType.HARD));
    }

    /**
     * Clear the polygon representation
     */
    clear() {
        this.segmentationData.clear();
    }

    /**
     * Draws the segmentations onto the canvas
     * 
     * @param ctx canvas context to draw onto
     */
    draw(ctx, markActive = true) {
        this.drawPolygons(ctx, markActive);
        //this.drawImage(ctx);
    }

    /**
     * Draws the polygons of the segmentation data
     * @param ctx the target canvas context
     * @param markActive iff true marks the currently active polygon
     * @param polyFilter a filter function to draw only specific polygons
     */
    drawPolygons(ctx, markActive = true, polyFilter: (p: [string, Polygon]) => boolean = p => true) {
        for (const [index, polygon] of Array.from(this.segmentationData.getPolygonEntries()).filter(polyFilter)) {
            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.activePolygonId, ctx, polygon.getColor());
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, polygon.getColor());
            }
        }
    }

    drawAdvanced(ctx, colorGenerator: (polygon: Polygon) => string = (poly: Polygon) => poly.getColor()) {
        const markActive = false;

        for (const [index, polygon] of this.segmentationData.getPolygonEntries()) {
            if (polygon.numPoints === 0) {
                continue;
            }

            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.activePolygonId, ctx, colorGenerator(polygon));
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, colorGenerator(polygon));
            }
            //UIUtils.drawCircle(ctx, polygon.center, 4, '#00FF00');
        }
        //ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
    }

    /**
     * add an action that modifies the segmentation model
     * @param action the action to perform
     * @param toPerform if true performs the action
     */
    addAction(action, toPerform = true) {
        this.actionManager.addAction(action, toPerform);
    }

    /**
     * Adds a new polygon to the segmentation model if necessary
     * 
     * if there is  an empty polygon at the end, this one is used
     */
    addNewPolygon(): string {
        let uuid = '';
        // do not allow undo for the first segment (it should be always present)
        let allowUndo = true;

        const actions: Action[] = [];

        if (this.segmentationData.numPolygons === 0) {
            // when there are no polygons we simply have to add one
            const newAction = new AddEmptyPolygon(this.segmentationData, UIUtils.randomColor());
            uuid = newAction.uuid;
            //this.addAction(newAction);
            actions.push(newAction);

            allowUndo = false;

            this.activePointIndex = 0;
        } else {
            // if there are polygons we check whether there are empty ones before creating a new one
            const emptyId = this.segmentationData.getEmptyPolygonId();
            if (emptyId) {
                uuid = emptyId;
            } else {
                const newAction = new AddEmptyPolygon(this.segmentationData, UIUtils.randomColor());
                uuid = newAction.uuid;
                //this.addAction(newAction);
                actions.push(newAction);

                this.activePointIndex = 0;
            }
        }

        // select the correct polygon
        if (allowUndo) {
            actions.push(new SelectPolygon(this.segmentationData, uuid, this.segmentationData.activePolygonId));
        } else {
            actions.push(new PreventUndoActionWrapper(new SelectPolygon(this.segmentationData, uuid, this.segmentationData.activePolygonId)));
        }

        // add all these actions as a joint action
        this.addAction(new JointAction(...actions));

        return uuid;
    }

    /**
     * get the list of polygons
     */
    /*get polygons(): Polygon[] {
        return this.segmentationData.polygons;
    }*/

    /**
     * returns the index of the currently active polygon
     * 
     */
    get activePolygonId(): string {
        return this.segmentationData.activePolygonId;
    }

    /**
     * sets the currently active polygon index
     */
    set activePolygonId(activePolygonId: string) {
        this.addAction(new SelectPolygon(this.segmentationData, activePolygonId, this.segmentationData.activePolygonId));
    }

    /**
     * returns the active point index
     */
    get activePointIndex(): number {
        return this.segmentationData.activePointIndex;
    }

    set activePointIndex(activePointIndex: number) {
        this.segmentationData.activePointIndex = activePointIndex;
    }

    /**
     * returns the currently active polygon
     */
    get activePolygon() {
        if (this.segmentationData.numPolygons === 0) {
            this.addNewPolygon();
        }

        return this.segmentationData.getPolygon(this.activePolygonId);
    }

    get activePoint() {
        return this.activePolygon.getPoint(this.activePointIndex);
    }

    undo() {
        if (this.actionManager.canUndo) {
            this.actionManager.undo();
        }
    }

    redo() {
        if (this.actionManager.canRedo) {
            this.actionManager.redo();
        }
    }
}

@Serializable()
export class SegmentationHolder extends SynchronizedObject<SegmentationHolder> implements ChangableModel<SegmentationModel> {

    @JsonProperty({type: SegmentationModel})
    segmentations: SegmentationModel[] = [];

    private subscriptions: Subscription[] = [];

    modelChanged = new EventEmitter<ModelChanged<SegmentationModel>>();

    constructor() {
        super();
    }

    onDeserialized() {
        const tmpSegs = this.segmentations;
        this.clearSegmentations();

        for (const segModel of tmpSegs) {
            this.addSegmentation(segModel);
        }
    }

    addSegmentation(model: SegmentationModel) {
        this.segmentations.push(model);
        this.subscriptions.push(model.onModelChange.subscribe((event: ModelChanged<SegmentationModel>) => {
        this.modelChanged.emit(new ModelChanged(event.model, event.changeType));
        }));
    }

    clearSegmentations() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.segmentations = [];
    }
}

export interface SimpleDetection {
    label: string;
    contour: Array<Point>;
    id: string;
}

export interface SimpleSegmentation {
    frame: number;
    detections: Array<SimpleDetection>;
}

export class DerivedSegmentationHolder
    implements ChangableModel<DerivedSegmentationHolder> {

    modelChanged = new EventEmitter<ModelChanged<DerivedSegmentationHolder>>();
    baseHolder: SegmentationHolder;

    content: Array<SimpleSegmentation>;
    
    constructor(baseHolder: SegmentationHolder) {
        this.baseHolder = baseHolder;
        this.baseHolder.modelChanged.subscribe((changedEvent: ModelChanged<SegmentationModel>) => {
            if (changedEvent.changeType === ChangeType.HARD) {
                // update the models simple representation
                this.update();
            }
        });
    }

    update() {
        this.content = [];
        // iterate over models and collect simple segmentation
        for (const [frameId, segModel] of this.baseHolder.segmentations.entries()) {
            const detections: SimpleDetection[] = [];

            for (const [uuid, poly] of segModel.segmentationData.getPolygonEntries()) {
                if (poly.points.length === 0) {
                    // we don't need empty segmentations
                    continue;
                }
                detections.push({label: 'cell', contour: poly.points, id: uuid});
            }

            const ss = {frame: frameId, detections};

            this.content.push(ss);
        }
        this.modelChanged.emit(new ModelChanged(this, ChangeType.HARD));
    }

}
