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
 * Segmentation model contains all the information of the segmentation bringing together the ActionManager and the underlying SegmentationData
 * 
 * 
 */
@Serializable()
export class SegmentationModel {

    /** action Manager that contains the actions forming the segmentation */
    @JsonProperty()
    private actionManager: ActionManager<SegmentationData>;

    /** event when segmentation data changes */
    onModelChange = new EventEmitter<ModelChanged<SegmentationModel>>();

    /** this is the raw data for segmentation  */
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
        // TODO: Default label id?
        this.addNewPolygon(0);
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

    addNewPolygonActions(labelId: number): Action<SegmentationData>[] {
        let uuid = '';
        // do not allow undo for the first segment (it should be always present)
        let allowUndo = true;

        const actions: Action<SegmentationData>[] = [];

        if (this.segmentationData.numPolygons === 0) {
            // when there are no polygons we simply have to add one
            const newAction = new AddEmptyPolygon(labelId, UIUtils.randomBrightColor());
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
                const newAction = new AddEmptyPolygon(labelId, UIUtils.randomBrightColor());
                uuid = newAction.uuid;
                //this.addAction(newAction);
                actions.push(newAction);

                this.activePointIndex = 0;
            }
        }

        // select the correct polygon
        if (allowUndo) {
            actions.push(new SelectPolygon(uuid));
        } else {
            actions.push(new PreventUndoActionWrapper(new SelectPolygon(uuid)));
        }

        return actions;
    }

    /**
     * Adds a new polygon to the segmentation model if necessary
     * 
     * if there is  an empty polygon at the end, this one is used
     */
    addNewPolygon(labelId: number) {

        const actions = this.addNewPolygonActions(labelId);

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
        this.addAction(new SelectPolygon(activePolygonId));
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
            // TODO: Default label id?
            this.addNewPolygon(0);
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


/**
 * Segmentation Collection Data: Segmentation data for a full image stack.
 */
export class SegCollData implements ClearableStorage {
    segData: SegmentationData[] = [];

    /** Views on individual frames */
    localModels: LocalSegmentationModel[] = [];
    parent: GlobalSegmentationModel;

    /** Annotation labels */
    labels: AnnotationLabel[] = [];

    /**
     * Create a new segmentation data collection with a specific parent model.
     * @param parent the owning parent model
     */
    constructor(parent: GlobalSegmentationModel) {
        this.parent = parent;
    }

    /**
     * Clear all data including segmentation, views and labels
     */
    clear() {
        this.segData = [];
        this.localModels = [];
        this.labels = [];
    }

    /**
     * Get the segmentation data for a specific frame
     * @param index frame index
     * @returns segmentation data for the current frame
     */
    get(index: number): SegmentationData {
        return this.segData[index];
    }

    /**
     * Add a segmentation data frame (e.g. adding new image into stack)
     * @param segData new segmentation data
     */
    addSegmentationData(segData: SegmentationData) {
        this.segData.push(segData);
        this.localModels.push(new LocalSegmentationModel(this.parent, this.segData.length - 1));
    }

    /**
     * add a new label for segmentation
     * @param label new label
     */
    addLabel(label: AnnotationLabel) {
        this.labels.push(label);

        // make sure only a single label is active
        if (label.active) {
            for (const l of this.labels) {
                l.active = false;
            }
            label.active = true;
        }
    }

    /**
     * Retrieve label by its id
     * @param labelId 
     * @returns label with that id or null
     */
    getLabelById(labelId: number): AnnotationLabel {
        const filteredLabels = this.labels.filter(l => l.id == labelId)
        if (filteredLabels.length == 1) {
            return filteredLabels[0];
        } else {
            console.warn("Could not find label by id");
            return null;
        }
    }

    /** View on active labels only */
    get activeLabels(): Array<AnnotationLabel> {
        return this.labels.filter(l => l.active);
    }

}

/**
 * Segmentation model for the full image stack containing ActionManager and segmentation data.
 */
@Serializable()
export class GlobalSegmentationModel extends SynchronizedObject<GlobalSegmentationModel> implements ChangableModel<GlobalSegmentationModel> {
    /** The action manager containing all the actions to construct the segmentation models for the image stack */
    @JsonProperty()
    private actionManager: ActionManager<SegCollData>;

    /** format version */
    @JsonProperty()
    private _formatVersion: string;

    // TODO: change this if version changes (especially for breaks)
    static defaultFormatVersion = '0.1';

    /** the segmentation data for all images */
    segmentationData: SegCollData;

    /** singal to stop processing pipelines */
    protected destroySignal: Subject<void>;

    get formatVersion(): string {
        return this._formatVersion;
    }

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

    get labels(): Array<AnnotationLabel> {
        return this.segmentationData.labels;
    }

    /**
     * Creates a global segmentation model for an image stack
     * @param destroySignal distroy signal to stop processing pipelines when necessary (e.g. when another model is used)
     * @param numSegmentationLayers number of frames in the image stack
     * @returns 
     */
    constructor(destroySignal, numSegmentationLayers: number) {
        super();
        this.destroySignal = destroySignal;

        // create new segmentation data
        this.segmentationData = new SegCollData(this);

        // create new action manager and link to data
        this.actionManager = new ActionManager(this.segmentationData);

        if (numSegmentationLayers === undefined) {
            // we are only deserializing
            return;
        }

        // set creation format version
        this._formatVersion = GlobalSegmentationModel.defaultFormatVersion;

        // create the segmentation frames in the data
        this.actionManager.addAction(new CreateSegmentationLayersAction(numSegmentationLayers));

        // create default label
        this.actionManager.addAction(new AddLabelAction(new AnnotationLabel(0, 'Cell', true, 'random', true)));
    }

    /**
     * Take action after deserialization
     * @param destroySignal the signal to destroy processing pipelines
     */
    onDeserialized(destroySignal: Subject<void>) {
        this.destroySignal = destroySignal;

        // link (empty) segmentation data to action manager
        this.actionManager.data = this.segmentationData;
        // reapply the actions of the action manager to recreate the segmentation data
        this.actionManager.reapplyActions(this.segmentationData);
    }

    /**
     * Add an action to the global segmentation model
     * @param action to perform
     * @param toPerform if true the action is performed and stored in action manager, if false the action is only stored in action manager
     */
    addAction(action: Action<SegCollData>, toPerform = true) {
        this.actionManager.addAction(action, toPerform);
    }

    getLocalModel(position: number) {
        return new LocalSegmentationModel(this, position);
    }

    /**
     * 
     * @returns next highest free label id
     */
    nextLabelId(): number {
        return Math.max(...this.segmentationData.labels.map(l => l.id), 0) + 1;
    }

    get canUndo() {
        return this.actionManager.canUndo;
    }

    get canRedo() {
        return this.actionManager.canRedo;
    }

    /**
     * Redo the last action
     */
    redo() {
        this.actionManager.redo();
    }

    /**
     * Undo the last action
     */
    undo() {
        this.actionManager.undo();
    }  
}

/**
 * Segmentation model for a single image (of an image stack).
 * 
 * This is basically a wrapper class for the global segmentation model that provides a view on the segmentation data for a single frame.
 */
export class LocalSegmentationModel {
    /** the parent segmentation model for the full stack */
    parent: GlobalSegmentationModel;
    /** frame index */
    position: number;

    /**
     * 
     * @param parent the global segmentation model
     * @param position the frame index
     */
    constructor(parent: GlobalSegmentationModel, position: number) {
        this.parent = parent;
        this.position = position;
    }

    /**
     * Add an action operating on the single image data to the action manager
     * @param action to perform on the segmentation data of the image frame.
     * @param toPerform if true, the action is performed and added, if false the action is only added
     */
    addAction(action: Action<SegmentationData>, toPerform = true) {
        this.parent.addAction(this.wrapAction(action), toPerform);
    }

    /**
     * Wrap an action on single image data to make it work with the global action manager
     * @param action to wrap
     * @returns wrapped action
     */
    wrapAction(action: Action<SegmentationData>): LocalAction {
        return new LocalAction(action, this.position);
    }

    get segmentationData(): SegmentationData {
        return this.parent.segmentationData.get(this.position);
    }

    /**
     * Only get the polygons of active labels
     * @returns a list of [id, poly] tuples
     */
    getActivePolygons(): Array<[string, Polygon]> {
        const activeLabelIds: Array<number> = this.parent.segmentationData.labels.filter(l => l.active).map(l => l.id);
        return this.getVisiblePolygons().filter(([id, poly]) => {
            return activeLabelIds.includes(this.getPolygonLabelId(id));
        });
    }

    /**
     * Returns polygons of visible labels
     * @returns a list of [id, poly] tuples
     */
    getVisiblePolygons(): Array<[string, Polygon]> {
        const visibleLabelIds: Array<number> = this.parent.segmentationData.labels.filter(l => l.visible).map(l => l.id);
        return [...this.segmentationData.getPolygons().entries()].filter(([id, poly]) => {
            return visibleLabelIds.includes(this.getPolygonLabelId(id));
        });
    }

    get activePolygonId(): string {
        return this.segmentationData.activePolygonId;
    }

    set activePolygonId(polyId: string) {
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

    /**
     * Create actions to add a new or select an empty polygon with this labelId
     * @param labelId 
     * @returns A list of actions to provide an active empty polygon with that label id
     */
    addNewPolygonActions(labelId: number): Action<SegmentationData>[] {
        let uuid = '';
        // do not allow undo for the first segment (it should be always present)
        let allowUndo = true;

        const actions: Action<SegmentationData>[] = [];

        if (this.segmentationData.numPolygons === 0) {
            // when there are no polygons we simply have to add one
            const newAction = new AddEmptyPolygon(labelId, UIUtils.randomBrightColor());
            uuid = newAction.uuid;
            //this.addAction(newAction);
            actions.push(newAction);

            allowUndo = false;

            this.activePointIndex = 0;
        } else {
            // if there are polygons we check whether there are empty ones before creating a new one
            const candidates = this.segmentationData.getEmptyPolygons().filter(([id, poly]) => {
                this.getPolygonLabelId(id) == labelId
            });
            let emptyId: string = null;
            if (candidates.length >= 1) {
                emptyId = candidates[0][0];
            }
            if (emptyId) {
                uuid = emptyId;
            } else {
                const newAction = new AddEmptyPolygon(labelId, UIUtils.randomBrightColor());
                uuid = newAction.uuid;
                //this.addAction(newAction);
                actions.push(newAction);

                this.activePointIndex = 0;
            }
        }

        // select the correct polygon
        if (allowUndo) {
            actions.push(new SelectPolygon(uuid));
        } else {
            actions.push(new PreventUndoActionWrapper(new SelectPolygon(uuid)));
        }

        return actions;
    }

    /**
     * Adds a new polygon to the segmentation model if necessary
     * 
     * if there is  an empty polygon at the end, this one is used
     */
    addNewPolygon(labelId: number) {

        const actions = this.addNewPolygonActions(labelId);

        // add all these actions as a joint action
        this.addAction(new JointAction(...actions));
    }

    get activeLabels(): Array<AnnotationLabel> {
        return this.parent.segmentationData.activeLabels;
    }

    get labels(): Array<AnnotationLabel> {
        return this.parent.labels;
    }

    nextLabelId(): number {
        return this.parent.nextLabelId();
    }

    getPolygonLabelId(id: string): number {
        return this.segmentationData.labels.get(id);
    }

    getPolygonLabel(id: string)  {
        return this.parent.labels[this.segmentationData.labels.get(id)];
    }
}


/**
 * Interface for a single segmentation contour
 */
export interface SimpleDetection {
    /** label name */
    label: string;
    /** contour defined as list of points */
    contour: Array<Point>;
    /** unique id */
    id: string;
}

/** segmentation of a full frame */
export interface SimpleSegmentation {
    /** frame index */
    frame: number;
    /** list of countours that are belonging to that frame */
    detections: Array<SimpleDetection>;
}

/**
 * Attaches to a normal {@link GlobalSegmentationModel} instance and converts its state to the simple segmentation format.
 */
export class SimpleSegmentationView
    implements ChangableModel<SimpleSegmentationView> {

    /** event when changes occur */
    modelChanged = new EventEmitter<ModelChanged<SimpleSegmentationView>>();
    /** the base model */
    baseHolder: GlobalSegmentationModel;

    /** the simplified segmentation content */
    private _content: Array<SimpleSegmentation>;

    private dirty = false;
    
    /**
     * Create a simple segmentation 
     * @param baseHolder the global segmentation model
     */
    constructor(baseHolder: GlobalSegmentationModel) {
        this.baseHolder = baseHolder;
        this.baseHolder.modelChanged.subscribe((changedEvent: ModelChanged<GlobalSegmentationModel>) => {
            if (changedEvent.changeType === ChangeType.HARD) {
                // update the models simple representation
                //this.update();
                this.dirty = true;
                this.modelChanged.emit(new ModelChanged(this, ChangeType.HARD));
            }
        });

        // initially updated the json representation
        //this.update();
        this.dirty = true;
    }

    get content(): Array<SimpleSegmentation> {
        if (this.dirty) {
            this.update();
            this.dirty = false;
        }

        return this._content;
    }

    /**
     * Updates the simple segmentation representation
     */
    private update() {
        this._content = [];
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

            const ss: SimpleSegmentation = {frame: frameId, detections};

            this._content.push(ss);
        }
    }

}
