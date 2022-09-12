/**
 * Implementation for all undo/redo actions modifying the underlying data model
 */

import { Utils } from './utils';
import { Point } from './geometry';
import 'reflect-metadata';
import { EventEmitter } from '@angular/core';
import { AnnotationLabel, SegmentationData } from './segmentation-data';
import { Polygon } from 'src/app/models/geometry';
import { v4 as uuidv4 } from 'uuid';

import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';
import { SegCollData } from './segmentation-model';
import * as dayjs from 'dayjs';
import { Link, TrackingData } from './tracking/data';

/** List of different action types */
enum ActionTypes {
    AddEmptyPolygon = "AddEmptyPolygon",
    AddPolygon = "AddPolygon",
    RemovePolygon = "RemovePolygon",
    AddPointAction = "AddPointAction",
    RemovePointAction = "AddPointAction",
    SelectPolygon = "AddPointAction",
    MovePointAction = "MovePointAction",
    ChangePolygonPoints = "MovePointAction",

    JointAction = "JointAction",
    PreventUndoActionWrapper = "PreventUndoActionWrapper",

    LocalAction = "LocalAction",
    CreateSegmentationLayersAction = "CreateSegmentationLayersAction",

    AddLabelAction = "AddLabelAction",
    RenameLabelAction = "RenameLabelAction",
    MergeLabelAction = "MergeLabelAction",
    ChangeLabelActivityAction = "ChangeLabelActivityAction",
    ChangeLabelVisibilityAction = "ChangeLabelVisibilityAction",
    ChangeLabelColorAction = "ChangeLabelColorAction",
    DeleteLabelAction = "DeleteLabelAction",

    // tracking actions
    AddLinkAction = "AddLinkAction",
    RemoveLinkAction = "RemoveLinkAction",
    ForceTrackEndAction = "ForceTrackEndAction"
}

/**
 * 
 * @param stamp in string format YYYY-MM-DDTHH:mm:ss.SSS Z[Z]
 * @returns the dayjs object
 */
const stringToDate = (stamp: string): dayjs.Dayjs => {
    const parsed = dayjs(stamp, 'YYYY-MM-DDTHH:mm:ss.SSS Z[Z]');
    if (parsed.isValid()) {
        return parsed;
    } else {
        console.warn('Need to create new date');
        return dayjs();
    }
}

/**
 * 
 * @param stamp dayjs object
 * @returns string format "YYYY-MM-DDTHH:mm:ss.SSS Z[Z]"
 */
const dateToString = (stamp: dayjs.Dayjs): string => {
   return stamp.format('YYYY-MM-DDTHH:mm:ss.SSS Z[Z]');
}

/**
 * Abstrac Action class that operates on some data of type T
 */
@Serializable()
export abstract class Action<T> {

    /** The action class: This is necessary for serialization */
    @JsonProperty()
    type: ActionTypes;

    /** A timestamp for th first execution of this action */
    @JsonProperty({
        onDeserialize: stringToDate, onSerialize: dateToString, predicate: () => dayjs.Dayjs
    })
    timeStamp;

    /** Perform the underlying action logic on the data */
    abstract perform(data: T): void;

    /** create this abstract action */
    constructor(type: ActionTypes) {
        this.type = type;
        this.timeStamp = dayjs();
    }

    join(action: Action<T>): boolean {
        return false;
    }

    /** does this action allow undo */
    allowUndo(): boolean {
        return true;
    }

    /** does this action allow redo */
    allowRedo(): boolean {
        return true;
    }
}

/** Action to setup the segmentation data structure including a local segmentation data for every image. */
@Serializable()
export class CreateSegmentationLayersAction extends Action<SegCollData> {
    @JsonProperty() numSegLayers: number;

    /**
     * 
     * @param numSegLayers the number of segmentation layers (e.g. images)
     */
    constructor(numSegLayers: number) {
        super(ActionTypes.CreateSegmentationLayersAction);
        this.numSegLayers = numSegLayers;
    }

    perform(data: SegCollData): void {
        // clear all data
        data.clear();
        // add new segmentation for every layer
        for(let i = 0; i < this.numSegLayers; i++) {
            data.addSegmentationData(new SegmentationData());
        }
    }

    /** does this action allow undo */
    allowUndo(): boolean {
        return false;
    }
}

/**
 * Action for adding an empty polygon to the segmentation data
 */
@Serializable()
export class AddEmptyPolygon extends Action<SegmentationData> {

    /** Color of the polygon */
    @JsonProperty()
    color: string;

    /** unique identifier for the polygon */
    @JsonProperty()
    uuid: string;

    /** id of the label */
    @JsonProperty()
    labelId: number;

    /**
     * 
     * @param labelId id of the parent label
     * @param color color of the polygon
     */
    constructor(labelId: number, color: string) {
        super(ActionTypes.AddEmptyPolygon);

        this.color = color;
        this.labelId = labelId;
        // generate unique id
        this.uuid = uuidv4();
    }

    /**
     * Adds the new polygon to an image segmentation data
     * @param segmentationData the segmentation data of the image
     */
    perform(segmentationData: SegmentationData) {
        const poly = new Polygon();
        poly.setColor(this.color);
        // create the polygon
        segmentationData.addPolygon(this.uuid, poly, this.labelId);
    }

}

/**
 * Action to add a full Polygon (already filled with ponits)
 */
@Serializable()
export class AddPolygon extends Action<SegmentationData> {

    /** unique id for the polygon */
    @JsonProperty()
    uuid: string;

    @JsonProperty()
    poly: Polygon;

    @JsonProperty()
    labelId: number;

    constructor(poly: Polygon, labelId: number, uuid: string=null) {
        super(ActionTypes.AddPolygon);

        this.labelId = labelId;
        if (uuid == null) {
            // generate a new uuid when no is defined (e.g. upon creation of the polygon)
            uuid = uuidv4();
        }
        this.uuid = uuid;
        this.poly = poly;
    }

    /**
     * Add the polygon to the segmentation data
     * @param segmentationData 
     */
    perform(segmentationData: SegmentationData) {
        segmentationData.addPolygon(this.uuid, Utils.clone(this.poly), this.labelId);
    }

}

/**
 * Action to remove polygon from the segmentation
 */
@Serializable()
export class RemovePolygon extends Action<SegmentationData> {

    /** the polygon id for removal */
    @JsonProperty()
    polygonId: string;

    constructor(polgonId: string) {
        super(ActionTypes.RemovePolygon);

        this.polygonId = polgonId;
    }

    /**
     * Removes the polygon based on its id from the segmentation data
     * @param segmentationData 
     */
    perform(segmentationData: SegmentationData) {
        segmentationData.removePolygon(this.polygonId);
    }
}

/**
 * Action to select a certain polygon
 */
@Serializable()
export class SelectPolygon extends Action<SegmentationData> {

    @JsonProperty() newPolyId: string;

    /**
     * 
     * @param newPolyId unique id of the newly selected polygon
     */
    constructor(newPolyId: string) {
        super(ActionTypes.SelectPolygon);

        this.newPolyId = newPolyId;
    }

    perform(segmentationData: SegmentationData) {
        // update selected polygon
        segmentationData.activePolygonId = this.newPolyId;
        segmentationData.activePointIndex = 0;
    }

    join(action: Action<SegmentationData>): boolean {
        if (action instanceof SelectPolygon) {
            //console.log('Joining Select polygon');
            const selectAction = action as SelectPolygon;

            this.newPolyId = selectAction.newPolyId;

            return true;
        }

        return false;
    }
}

/** Action for adding a single point to a polygon */
@Serializable()
export class AddPointAction extends Action<SegmentationData> {

    @JsonProperty()
    private point: [number, number];
    @JsonProperty()
    private index: number;
    @JsonProperty()
    private polygonId: string;

    /**
     * 
     * @param point 2D point to add to the polygon
     * @param index index in the polygon point list
     * @param polygonId unique polygon id
     * @returns 
     */
    constructor(point: [number, number], index: number, polygonId: string) {
        super(ActionTypes.AddPointAction);

        if(!point) {
            return;
        }

        this.point = Utils.clone(point);  // clone is important so that later modifications do not change this action
        this.index = index;
        this.polygonId = polygonId;
    }

    /**
     * Add a point to the polygon in the segmentation data
     * @param segmentationData 
     */
    perform(segmentationData: SegmentationData) {
        segmentationData.getPolygon(this.polygonId).addPoint(this.index, Utils.clone(this.point));

        segmentationData.activePointIndex = this.index;
    }
}

/**
 * Action to remove a single point from segmentation data
 */
@Serializable()
export class RemovePointAction extends Action<SegmentationData> {

    @JsonProperty()
    polygonId: string;
    @JsonProperty()
    pointIndex: number;

    @JsonProperty()
    point: [number, number];

    /**
     * 
     * @param polygonId polygon id
     * @param pointIndex point index in polygon point list to be removed
     */
    constructor(polygonId: string, pointIndex: number) {
        super(ActionTypes.RemovePointAction);

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;
    }

    /**
     * Remove the point from the polygon in the segmentation data
     * @param segmentationData 
     */
    perform(segmentationData: SegmentationData) {
        // store point data
        this.point = segmentationData.getPolygon(this.polygonId).getPoint(this.pointIndex);
        // remove point
        segmentationData.getPolygon(this.polygonId).removePoint(this.pointIndex);
    }

}

/**
 * Action to move a single point (changing coordinates) of a polygon
 */
@Serializable()
export class MovePointAction extends Action<SegmentationData> {

    @JsonProperty()
    private newPoint: [number, number];
    @JsonProperty()
    private polygonId: string;
    @JsonProperty()
    private pointIndex: number;

    constructor(newPoint: [number, number], pointIndex: number, polygonId: string) {
        super(ActionTypes.MovePointAction);

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;

        // newPoint can be null -> on deserialization
        if (newPoint) {
            this.newPoint = Utils.clone([...newPoint]); // clone is important so that later changes do not change this action
        }
    }

    /**
     * Move the point in the polygon of the segmentation data
     * @param segmentationData 
     */
    perform(segmentationData: SegmentationData) {
        const point = segmentationData.getPolygon(this.polygonId).getPoint(this.pointIndex)

        point[0] = this.newPoint[0];
        point[1] = this.newPoint[1];
    }

    join(action: Action<SegmentationData>) {
        if (action instanceof MovePointAction) {
            const mpAction = action as MovePointAction;

            if (this.polygonId === mpAction.polygonId && this.pointIndex === mpAction.pointIndex) {
                // polygon and point do correspond
                this.newPoint = mpAction.newPoint;
                return true;
            }
        }

        return false;
    }
}

/**
 * Action to change to points of a polygon
 */
@Serializable()
export class ChangePolygonPoints extends Action<SegmentationData> {

    @JsonProperty()
    private newPoints: Point[];
    @JsonProperty()
    private polygonId: string;

    /**
     * 
     * @param newPoints new point list for the polygon
     * @param polygonId the unique polygon id
     */
    constructor(newPoints: Point[], polygonId: string) {
        super(ActionTypes.ChangePolygonPoints);

        if (!newPoints) {
            // this is a json recreation
            return;
        }

        this.polygonId = polygonId;
        this.newPoints = Utils.clone(newPoints); // clone is important to make action independet of later changes in the point array
    }

    /**
     * Apply new polygon points in the segmentation data
     * @param segmentationData 
     */
    perform(segmentationData: SegmentationData) {
        segmentationData.getPolygon(this.polygonId).setPoints(Utils.clone(this.newPoints));
    }
}

/**
 * Action to add a new label to the global segmentation model
 */
@Serializable()
export class AddLabelAction extends Action<SegCollData> {

    @JsonProperty()
    label: AnnotationLabel;

    /**
     * 
     * @param label new annotation label
     */
    constructor(label: AnnotationLabel) {
        super(ActionTypes.AddLabelAction);
        this.label = label;
    }

    /**
     * Add the annotation label
     * @param data 
     */
    perform(data: SegCollData): void {
        data.addLabel(this.label);
    }
}

/**
 * Action to rename an annotation label
 */
@Serializable()
export class RenameLabelAction extends Action<SegCollData> {
    @JsonProperty()
    id: number;
    @JsonProperty()
    labelName: string;

    /**
     * 
     * @param id of the annotation label
     * @param name new name for the annotation label
     */
    constructor(id: number, name: string) {
        super(ActionTypes.RenameLabelAction);
        this.id = id;
        this.labelName = name;
    }

    /**
     * Rename annotation label
     * @param data 
     */
    perform(data: SegCollData): void {
        data.getLabelById(this.id).name = this.labelName;
    }
}

/**
 * merge two annotation labels
 */
@Serializable()
export class MergeLabelAction extends Action<SegCollData> {
    @JsonProperty()
    srcId: number;

    @JsonProperty()
    dstId: number;

    /**
     * 
     * @param srcId source annotation label (gets merged)
     * @param dstId destination annotation label (gets all the polygons from source)
     */
    constructor(srcId: number, dstId: number) {
        super(ActionTypes.MergeLabelAction);
        this.srcId = srcId;
        this.dstId = dstId;
    }

    perform(data: SegCollData): void {
        // assign objects from source to destiation label
        for(const segData of data.segData) {
            // determine the polygons that need to switch labels
            const polyIds = [...segData.labels.entries()].filter(([polyId, labelId]) => {
                return labelId == this.srcId;
            }).map(([polyId, labelId]) => polyId);

            // switch labels
            for (const pId of polyIds) {
                segData.labels.set(pId, this.dstId);
            }
        }

        // delete source label
        new DeleteLabelAction(this.srcId).perform(data);

        // activate target label
        new ChangeLabelActivityAction(this.dstId, true).perform(data);
    }
}

/**
 * Action to delete a label (and all its associated segmentation polygons)
 */
@Serializable()
export class DeleteLabelAction extends Action<SegCollData> {
    @JsonProperty()
    labelId: number;

    /**
     * 
     * @param labelId label id of the label to delete
     */
    constructor(labelId: number) {
        super(ActionTypes.DeleteLabelAction);
        this.labelId = labelId;
    }

    /**
     * Delete label and all its associated polygons
     * @param data 
     */
    perform(data: SegCollData): void {
        // delete label
        data.labels.splice(data.labels.indexOf(data.getLabelById(this.labelId)), 1);

        // delete all associated polygons

        // loop over image slices
        for(const [index, segData] of data.segData.entries()) {
            // determine the polygons with that labels
            const polyIds = [...segData.labels.entries()].filter(([polyId, labelId]) => {
                return labelId == this.labelId;
            }).map(([polyId, labelId]) => polyId);

            // delete them
            for (const pId of polyIds) {
                new LocalAction(new RemovePolygon(pId), index).perform(data);
            }
        }

        // if no label is active, activate first
        if (data.labels.filter(l => l.active).length == 0) {
            data.labels[0].active = true;
        }
    }
}

/**
 * Action to change the label activity. Only the segmentation of an active label can be changed.
 */
@Serializable()
export class ChangeLabelActivityAction extends Action<SegCollData> {

    @JsonProperty() labelId: number;
    @JsonProperty() active: boolean;

    /**
     * 
     * @param labelId id of the label
     * @param active new activity state
     */
    constructor(labelId: number, active: boolean) {
        super(ActionTypes.ChangeLabelActivityAction)
        this.labelId = labelId;
        this.active = active;
    }

    /**
     * apply the new label activity state
     * @param data 
     */
    perform(data: SegCollData): void {
        if (this.active) {
            // disable all others
            for(const label of data.labels) {
                label.active = false;
            }
        }
        // set new activity state
        data.getLabelById(this.labelId).active = this.active;
        if (this.active) {
            // also make the label visible (otherwise activation makes no sense)
            data.getLabelById(this.labelId).visible = true;
        }
    }

}

/**
 * Action to change visibility of a label
 */
@Serializable()
export class ChangeLabelVisibilityAction extends Action<SegCollData> {
    @JsonProperty() labelId: number;
    @JsonProperty() visible: boolean;

    constructor(labelId: number, visible: boolean) {
        super(ActionTypes.ChangeLabelVisibilityAction);
        this.labelId = labelId;
        this.visible = visible;
    }

    perform(data: SegCollData): void {
        const label = data.getLabelById(this.labelId)
        label.visible = this.visible;

        if (label.visible == false) {
            new ChangeLabelActivityAction(this.labelId, false).perform(data);
        }
    }
}

/**
 * Action to change to color of a label
 */
@Serializable()
export class ChangeLabelColorAction extends Action<SegCollData> {
    @JsonProperty() labelId: number;
    @JsonProperty() color: string;

    /**
     * 
     * @param labelId label id
     * @param color new color code
     */
    constructor(labelId: number, color: string) {
        super(ActionTypes.ChangeLabelColorAction);
        this.labelId = labelId;
        this.color = color;
    }

    /**
     * Apply the new color to the label
     * @param data 
     */
    perform(data: SegCollData): void {
        data.getLabelById(this.labelId).color = this.color;
    }
}

/*************************
 **** Tracking Actions ***
 *************************
*/

/** Action to link two segmentations */
@Serializable()
export class AddLinkAction extends Action<TrackingData> {
    @JsonProperty() link: Link;

    /**
     * 
     * @param numSegLayers the number of segmentation layers (e.g. images)
     */
    constructor(link: Link) {
        super(ActionTypes.AddLinkAction);
        this.link = link;
    }

    perform(data: TrackingData): void {
        data.addLink(this.link)
    }
}

/** Action to delete link between segmentations */
@Serializable()
export class RemoveLinkAction extends Action<TrackingData> {
    @JsonProperty() source: string;
    @JsonProperty() target: string;

    /**
     * 
     * @param numSegLayers the number of segmentation layers (e.g. images)
     */
    constructor(source: string, target: string) {
        super(ActionTypes.RemoveLinkAction);
        this.source = source;
        this.target = target
    }

    perform(data: TrackingData): void {
        const deleteCandidates = data.links.filter(link => link.sourceId == this.source && link.targetId == this.target);
        for (const cand of deleteCandidates) {
            data.removeLink(cand);
        }
    }
}

/**
 * Action to toggle forced track end status
 */
@Serializable()
export class ForceTrackEndAction extends Action<TrackingData> {
    @JsonProperty() trackEndItemId: string;

    /**
     * 
     * @param trackEndItemId id of the last item in the track
     */
    constructor(trackEndItemId: string) {
        super(ActionTypes.ForceTrackEndAction);
        this.trackEndItemId = trackEndItemId;
    }

    perform(data: TrackingData): void {
        if (data.forcedTrackEnds.has(this.trackEndItemId)) {
            // remove it
            data.forcedTrackEnds.delete(this.trackEndItemId);
        } else {
            data.forcedTrackEnds.add(this.trackEndItemId);
        }
    }
}

 

/**
 * Restores action with their corresponding types
 * 
 * Useful for json deserialization
 * 
 * The known types field is used for polymorphical behavior of actions and must contain a list of all possible actions (https://github.com/JohnWeisz/TypedJSON/blob/master/spec/polymorphism-abstract-class.spec.ts)
 */
 const actionRestorer = action => {

    const lookupList: Array<[ActionTypes, any]> = [
        [ActionTypes.AddEmptyPolygon, AddEmptyPolygon],
        [ActionTypes.AddPolygon, AddPolygon],
        [ActionTypes.RemovePolygon, RemovePolygon],
        [ActionTypes.AddPointAction, AddPointAction],
        [ActionTypes.SelectPolygon, SelectPolygon],
        [ActionTypes.MovePointAction, MovePointAction],
        [ActionTypes.ChangePolygonPoints, ChangePolygonPoints],

        [ActionTypes.JointAction, JointAction],
        [ActionTypes.PreventUndoActionWrapper, PreventUndoActionWrapper],

        [ActionTypes.LocalAction, LocalAction],
        [ActionTypes.CreateSegmentationLayersAction, CreateSegmentationLayersAction],

        [ActionTypes.AddLabelAction, AddLabelAction],
        [ActionTypes.RenameLabelAction, RenameLabelAction],
        [ActionTypes.MergeLabelAction, MergeLabelAction],
        [ActionTypes.ChangeLabelActivityAction, ChangeLabelActivityAction],
        [ActionTypes.ChangeLabelVisibilityAction, ChangeLabelVisibilityAction],
        [ActionTypes.ChangeLabelColorAction, ChangeLabelColorAction],
        [ActionTypes.DeleteLabelAction, DeleteLabelAction],

        // Tracking Actions
        [ActionTypes.AddLinkAction, AddLinkAction],
        [ActionTypes.RemoveLinkAction, RemoveLinkAction],
        [ActionTypes.ForceTrackEndAction, ForceTrackEndAction]
    ];

    const lookup = new Map<ActionTypes, any>();

    // create the lookup
    for (const [actionType, classConstr] of lookupList) {
        lookup.set(actionType, classConstr);
    }


    // get the action type
    const type = action['type'];
    if (lookup.has(type)) {
        return lookup.get(type);
    } else {
        throw new Error(`Unknown action type: ${type}`);
    }
};

/**
 * Action wrapper for single image actions.
 */
@Serializable()
export class LocalAction extends Action<SegCollData> {

    /**
     * the action
     */
    @JsonProperty({predicate: actionRestorer})
    action: Action<SegmentationData>;

    /**
     * the plane (frame) to apply the action
     */
    @JsonProperty()
    t: number;

    constructor(action: Action<SegmentationData>, t: number) {
        super(ActionTypes.LocalAction);

        this.action = action;
        this.t = t;
    }

    /**
     * Apply the action to the corresponding image segmentation
     * @param data 
     */
    perform(data: SegCollData): void {
        this.action.perform(data.get(this.t));
    }
    
}

/**
 * 
 */
@Serializable()
export class JointAction<T> extends Action<T>{

    /** List of actions */
    @JsonProperty({predicate: actionRestorer})
    actions: Action<T>[];

    /**
     * Creats a grouped action based on a list of actions
     * @param actions list of actions
     */
    constructor(actions: Action<T>[]) {
        super(ActionTypes.JointAction);
        this.actions = actions;
    }

    /**
     * Perform all the actions
     * @param data 
     */
    perform(data: T) {
        for (const act of this.actions) {
            act.perform(data);
        }
    }

    /**
     * 
     * @returns true if all actions allow undo, otherwise false
     */
    allowUndo(): boolean {
        if (this.actions.length == 0) {
            return true;
        }
        return this.actions.map(a => a.allowUndo()).reduce((a, b) => a && b);
    }

    /**
     * 
     * @returns true if all actions allow redo, otherwise false
     */
    allowRedo(): boolean {
        if (this.actions.length == 0) {
            return true;
        }
        return this.actions.map(a => a.allowRedo()).reduce((a, b) => a && b);
    }
}

/**
 * Action wrapper to make an action undoable
 */
@Serializable()
export class PreventUndoActionWrapper<T> extends Action<T> {

    @JsonProperty({predicate: actionRestorer})
    action: Action<T>;

    constructor(action: Action<T>) {
        super(ActionTypes.PreventUndoActionWrapper);
        this.action = action;
    }

    perform(data: T) {
        this.action.perform(data);
    }

    allowUndo() {
        return false;
    }
}

/** Interface for clearing */
export interface ClearableStorage {
    clear(): void;
}

/**
 * Class for managing (do/undo) actions modifying some (clearable) data
 */
@Serializable()
export class ActionManager<T extends ClearableStorage> {

    /** the full list of actions */
    @JsonProperty({predicate: actionRestorer})
    actions: Action<T>[] = [];
    /** pointer to the most recent action */
    @JsonProperty()
    currentActionPointer: number;

    @JsonProperty()
    recordedActionPointer: number;

    onDataChanged = new EventEmitter<ActionManager<T>>();

    /** the underlying data structure */
    data: T;

    constructor(data: T) {
        this.currentActionPointer = 0;
        this.data = data;
    }

    /**
     * Adds an action to the action list
     * @param action the current action
     * @param toPerform if true action is performed before adding to list
     */
    addAction(action: Action<T>, toPerform: boolean = true) {
        //console.log('Add action: ' + action.constructor.name);

        if (toPerform) {
            action.perform(this.data);
        }

        // add the action (and remove others that are still on the stack)
        this.actions.splice(this.currentActionPointer, this.actions.length, action);
        this.currentActionPointer++;

        // notify the data has changed
        this.notifyDataChanged(action);
    }

    notifyDataChanged(action: Action<T> = null) {
        this.onDataChanged.emit(this);
    }

    /**
     * Undos last action
     * 
     * if there is no last action, does nothing
     */
    undo() {
        if (!this.canUndo) {
            return;
        }

        //console.log('Undo:');
        //console.log(this.lastAction.constructor.name);

        // undo last action by remove one action from pointer
        this.currentActionPointer -= 1;

        // redo all the actions again
        this.reapplyActions();
    }

    /**
     * Redos next possible action
     * 
     * If there are no actions, nothing happens
     */
    redo() {
        if (!this.canRedo) {
            return;
        }
        const nextAction = this.actions[this.currentActionPointer];

        //console.log('Redo:');
        //console.log(nextAction.constructor.name);

        // perform action
        nextAction.perform(this.data);
        this.currentActionPointer++;

        // notify the data change
        this.notifyDataChanged();
    }

    /**
     * returns true iff there is action that can be undone
     */
    get canUndo() {
        return this.currentActionPointer > 0 && this.lastAction.allowUndo();
    }

    get lastAction() {
        if (this.currentActionPointer === 0) {
            return null;
        }
        return  this.actions[this.currentActionPointer - 1];
    }

    /**
     * returns true iff there is an action that can be redone
     */
    get canRedo() {
        return this.actions.length > this.currentActionPointer;
    }

    /**
     * Reapply all actions in the manager (according to action pointer) to the data and notify the changes
     * @param data modified by actions
     */
    reapplyActions(data = this.data) {
        // clear the data
        data.clear();

        // apply actions one by one
        for (let i = 0; i < this.currentActionPointer; i++) {
            const action = this.actions[i];

            action.perform(data);
        }

        // notify that the data has changed
        this.notifyDataChanged();
    }

    clear() {
        this.actions = []
        this.currentActionPointer = 0;

        this.notifyDataChanged();
    }
}
