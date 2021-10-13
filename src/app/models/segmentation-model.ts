import { Serializable, JsonProperty } from 'typescript-json-serializer';
import { ModelChanged, ChangeType, ChangableModel } from './change';
import { EventEmitter } from '@angular/core';
import { AnnotationLabel, SegmentationData } from './segmentation-data';
import { UIUtils } from './utils';
import { Polygon, Point } from './geometry';
import { ActionManager, AddEmptyPolygon, SelectPolygon, PreventUndoActionWrapper, Action, JointAction, ClearableStorage, LocalAction, CreateSegmentationLayersAction, AddLabelAction } from './action';
import { SynchronizedObject } from './storage';
import { Subscription, Observable, combineLatest, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

/**
 * Segmentation model contains all the information of the segmentation
 * 
 * 
 */
@Serializable()
export class SegmentationModel {

    // action Manager that contains the actions forming the segmentation
    @JsonProperty()
    private actionManager: ActionManager<SegmentationData>;

    onModelChange = new EventEmitter<ModelChanged<SegmentationModel>>();

    // this is the raw data for segmentation
    segmentationData: SegmentationData = new SegmentationData();


    constructor() {

        this.actionManager = new ActionManager(this.segmentationData);

        // clear segmentation data
        this.clear();
        // load the image
        //this.loadImage();

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager<SegmentationData>) => {
            this.notfiyModelChanged();
        });

        // TODO this is somehow strange not to able to have an empty model. If the model is empty on interaction a new polygon is added and this can destroy the redo stack.
        this.addNewPolygon();
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

        // reconnect action manager to data
        this.actionManager.data = this.segmentationData;

        // reapply actions from action manager
        this.actionManager.reapplyActions();

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager<SegmentationData>) => {
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

    addNewPolygonActions(): Action<SegmentationData>[] {
        let uuid = '';
        // do not allow undo for the first segment (it should be always present)
        let allowUndo = true;

        const actions: Action<SegmentationData>[] = [];

        if (this.segmentationData.numPolygons === 0) {
            // when there are no polygons we simply have to add one
            const newAction = new AddEmptyPolygon(UIUtils.randomColor());
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
                const newAction = new AddEmptyPolygon(UIUtils.randomColor());
                uuid = newAction.uuid;
                //this.addAction(newAction);
                actions.push(newAction);

                this.activePointIndex = 0;
            }
        }

        // select the correct polygon
        if (allowUndo) {
            actions.push(new SelectPolygon(uuid, this.segmentationData.activePolygonId));
        } else {
            actions.push(new PreventUndoActionWrapper(new SelectPolygon(uuid, this.segmentationData.activePolygonId)));
        }

        return actions;
    }

    /**
     * Adds a new polygon to the segmentation model if necessary
     * 
     * if there is  an empty polygon at the end, this one is used
     */
    addNewPolygon() {

        const actions = this.addNewPolygonActions();

        // add all these actions as a joint action
        this.addAction(new JointAction(...actions));
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
        this.addAction(new SelectPolygon(activePolygonId, this.segmentationData.activePolygonId));
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

    get canUndo() {
        return this.actionManager.canUndo;
    }

    get canRedo() {
        return this.actionManager.canRedo;
    }

    clone() {
        // TODO: rather use this.actionManager.clone()
        // create blank model
        const newSegMod = new SegmentationModel();
        newSegMod.actionManager.clear();
        newSegMod.actionManager.reapplyActions();
        // add all the actions from the other model
        for (const action of this.actionManager.actions) {
            newSegMod.addAction(action, false);
        }
        // apply the actions
        newSegMod.actionManager.currentActionPointer = this.actionManager.currentActionPointer;
        newSegMod.actionManager.reapplyActions();

        return newSegMod;
    }

}


export class SegCollData implements ClearableStorage {
    segData: SegmentationData[] = [];

    /** Views on individual frames */
    localModels: LocalSegmentationModel[] = [];
    parent: GlobalSegmentationModel;

    labels: AnnotationLabel[] = [];

    constructor(parent: GlobalSegmentationModel) {
        this.parent = parent;
    }

    clear() {
        this.segData = [];
        this.localModels = [];
        this.labels = [];
    }

    get(index: number) {
        return this.segData[index];
    }

    addSegmentationData(segData: SegmentationData) {
        this.segData.push(segData);
        this.localModels.push(new LocalSegmentationModel(this.parent, this.segData.length - 1));
    }

    addLabel(labelName: string) {
        const maxLabel = Math.max(Math.max(...this.labels.map(l => l.id)), 0);
        this.labels.push(new AnnotationLabel(maxLabel+1, labelName));
    }

    getLabelById(labelId: number) {
        const filteredLabels = this.labels.filter(l => l.id == labelId)
        if (filteredLabels.length == 1) {
            return filteredLabels[0];
        } else {
            console.warn("Could not find label by id");
            return null;
        }
    }

}

@Serializable()
export class GlobalSegmentationModel extends SynchronizedObject<GlobalSegmentationModel> implements ChangableModel<GlobalSegmentationModel> {
    @JsonProperty()
    private actionManager: ActionManager<SegCollData>;

    segmentationData: SegCollData;
    private subscriptions: Subscription[] = [];

    _modelChanged = new EventEmitter<ModelChanged<GlobalSegmentationModel>>();

    protected destroySignal: Subject<void>;

    get modelChanged() {
        return this.actionManager.onDataChanged.pipe(
            takeUntil(this.destroySignal),
            map(() => new ModelChanged<GlobalSegmentationModel>(this, ChangeType.HARD))
        );
    }

    get segmentations(): SegmentationData[] {
        return this.segmentationData.segData;
    }

    get segmentationModels(): LocalSegmentationModel[] {
        return this.segmentationData.localModels;
    }

    constructor(destroySignal, numSegmentationLayers: number) {
        super();
        this.destroySignal = destroySignal;

        this.segmentationData = new SegCollData(this);

        this.actionManager = new ActionManager(this.segmentationData);

        /*this.actionManager.onDataChanged.subscribe((actionManager: ActionManager<SegmentationData>) => {
            this.notfiyModelChanged();
        });*/

        if (numSegmentationLayers === undefined) {
            return;
        }

        this.actionManager.addAction(new CreateSegmentationLayersAction(numSegmentationLayers));

        this.actionManager.addAction(new AddLabelAction('Cell'));
    }

    onDeserialized(destroySignal: Subject<void>) {
        this.destroySignal = destroySignal;

        this.actionManager.data = this.segmentationData;
        // reapply the actions of the action manager
        this.actionManager.reapplyActions(this.segmentationData);
    }

    /*notfiyModelChanged() {
        this._modelChanged.emit(new ModelChanged<GlobalSegmentationModel>(this, ChangeType.HARD));
    }*/

    clearSegmentations() {
        //this.subscriptions.forEach(sub => sub.unsubscribe());
        this.segmentationData.clear();
    }

    addAction(a: Action<SegCollData>, toPerform = true) {
        this.actionManager.addAction(a, toPerform);
    }

    getLocalModel(position: number) {
        return new LocalSegmentationModel(this, position);
    }

    get canUndo() {
        return this.actionManager.canUndo;
    }

    get canRedo() {
        return this.actionManager.canRedo;
    }

    redo() {
        this.actionManager.redo();
    }

    undo() {
        this.actionManager.undo();
    }  
}

export class LocalSegmentationModel {
    parent: GlobalSegmentationModel;
    position: number;

    constructor(parent: GlobalSegmentationModel, position: number) {
        this.parent = parent;
        this.position = position;
    }

    addAction(action: Action<SegmentationData>, toPerform = true) {
        this.parent.addAction(new LocalAction(action, this.position), toPerform);
    }

    get segmentationData(): SegmentationData {
        return this.parent.segmentationData.get(this.position);
    }

    get activePolygonId(): string {
        return this.segmentationData.activePolygonId;
    }

    set activePolygonId(polyId: string) {
        //assert(this.segmentationData.contains(polyId));
        this.segmentationData.activePolygonId = polyId;
    }

    get activePolygon(): Polygon {
        return this.segmentationData.getPolygon(this.segmentationData.activePolygonId);
    }

    get activePointIndex(): number {
        return this.segmentationData.activePointIndex;
    }

    set activePointIndex(activePointIndex: number) {
        this.segmentationData.activePointIndex = activePointIndex;
    }

    addNewPolygonActions(): Action<SegmentationData>[] {
        let uuid = '';
        // do not allow undo for the first segment (it should be always present)
        let allowUndo = true;

        const actions: Action<SegmentationData>[] = [];

        if (this.segmentationData.numPolygons === 0) {
            // when there are no polygons we simply have to add one
            const newAction = new AddEmptyPolygon(UIUtils.randomColor());
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
                const newAction = new AddEmptyPolygon(UIUtils.randomColor());
                uuid = newAction.uuid;
                //this.addAction(newAction);
                actions.push(newAction);

                this.activePointIndex = 0;
            }
        }

        // select the correct polygon
        if (allowUndo) {
            actions.push(new SelectPolygon(uuid, this.segmentationData.activePolygonId));
        } else {
            actions.push(new PreventUndoActionWrapper(new SelectPolygon(uuid, this.segmentationData.activePolygonId)));
        }

        return actions;
    }

    /**
     * Adds a new polygon to the segmentation model if necessary
     * 
     * if there is  an empty polygon at the end, this one is used
     */
    addNewPolygon() {

        const actions = this.addNewPolygonActions();

        // add all these actions as a joint action
        this.addAction(new JointAction(...actions));
    }
}

/**
 * Holds a set of segmentation models and adds json serialization functionality
 */
@Serializable()
export class SegmentationHolder extends SynchronizedObject<SegmentationHolder> implements ChangableModel<SegmentationModel> {

    @JsonProperty({type: SegmentationModel})
    segmentations: SegmentationModel[] = [];

    private subscriptions: Subscription[] = [];

    _modelChanged = new EventEmitter<ModelChanged<SegmentationModel>>();

    protected destroySignal: Subject<void>;

    get modelChanged() {
        return this._modelChanged.pipe(
            takeUntil(this.destroySignal)
        );
    }

    constructor(destroySignal) {
        super();
        this.destroySignal = destroySignal;
    }

    onDeserialized(destroySignal: Subject<void>) {
        const tmpSegs = this.segmentations;
        this.clearSegmentations();

        this.destroySignal = destroySignal;

        // notify all submodels
        for (const segModel of tmpSegs) {
            segModel.onDeserialized();
        }

        // register all the submodels
        for (const segModel of tmpSegs) {
            this.addSegmentation(segModel);
        }
    }

    addSegmentation(model: SegmentationModel) {
        this.segmentations.push(model);
        this.subscriptions.push(model.onModelChange.pipe(takeUntil(this.destroySignal)).subscribe((event: ModelChanged<SegmentationModel>) => {
        this._modelChanged.emit(new ModelChanged(event.model, event.changeType));
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

/**
 * Attaches to a normal {@link SegmentationHolder} instance and converts its state to the simple segmentation format.
 */
export class SimpleSegmentationHolder
    implements ChangableModel<SimpleSegmentationHolder> {

    modelChanged = new EventEmitter<ModelChanged<SimpleSegmentationHolder>>();
    baseHolder: GlobalSegmentationModel;

    content: Array<SimpleSegmentation>;
    
    constructor(baseHolder: GlobalSegmentationModel) {
        this.baseHolder = baseHolder;
        this.baseHolder.modelChanged.subscribe((changedEvent: ModelChanged<GlobalSegmentationModel>) => {
            if (changedEvent.changeType === ChangeType.HARD) {
                // update the models simple representation
                this.update();
            }
        });

        // initially updated the json representation
        this.update();
    }

    /**
     * Updates the simple segmentation representation
     */
    update() {
        this.content = [];
        // iterate over models and collect simple segmentation
        for (const [frameId, segData] of this.baseHolder.segmentations.entries()) {
            const detections: SimpleDetection[] = [];

            for (const [uuid, poly] of segData.getPolygonEntries()) {
                if (poly.points.length === 0) {
                    // we don't need empty segmentations
                    continue;
                }
                // TODO: hard coded label here!
                detections.push({label: 'cell', contour: poly.points, id: uuid});
            }

            const ss = {frame: frameId, detections};

            this.content.push(ss);
        }
        this.modelChanged.emit(new ModelChanged(this, ChangeType.HARD));
    }

}
