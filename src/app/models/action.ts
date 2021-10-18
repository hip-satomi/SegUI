import { Utils } from './utils';
import { Point } from './geometry';
import 'reflect-metadata';
import { EventEmitter } from '@angular/core';
import { SelectedSegment, TrackingData, TrackingLink } from './tracking-data';
import { AnnotationLabel, SegmentationData } from './segmentation-data';
import { Polygon } from 'src/app/models/geometry';
import { v4 as uuidv4 } from 'uuid';

import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';
import { SegCollData } from './segmentation-model';
import { LabelOptions } from '@angular/material/core';
import * as dayjs from 'dayjs';

enum ActionTypes {
    AddEmptyPolygon,
    AddPolygon,
    RemovePolygon,
    AddPointAction,
    RemovePointAction,
    SelectPolygon,
    MovePointAction,
    ChangePolygonPoints,

    // Actions for tracking
    SelectSegmentAction,
    AddLinkAction,
    UnselectSegmentAction,

    JointAction,
    PreventUndoActionWrapper,

    LocalAction,
    CreateSegmentationLayersAction,

    AddLabelAction,
    RenameLabelAction,
    MergeLabelAction,
    ChangeLabelActivityAction,
    ChangeLabelVisibilityAction,
    ChangeLabelColorAction
}

const stringToDate = (stamp: string): dayjs.Dayjs => {
    return dayjs(stamp);
}

const dateToString = (stamp: dayjs.Dayjs): string => {
   return stamp.format('YYYY-MM-DDTHH:mm:ssZ[Z]') 
}

@Serializable()
export abstract class Action<T> {

    @JsonProperty()
    type: ActionTypes;

    @JsonProperty({
        onDeserialize: stringToDate, onSerialize: dateToString, predicate: () => dayjs.Dayjs
    })
    timeStamp;
    abstract perform(data: T): void;

    constructor(type: ActionTypes) {
        this.type = type;
        this.timeStamp = dayjs();
    }

    join(action: Action<T>): boolean {
        return false;
    }

    allowUndo() {
        return true;
    }

    allowRedo() {
        return true;
    }
}

//@Serializable()
//export abstract class DataAction extends Action {
//    abstract setData(info): void;
//}

/*@Serializable()
export abstract class SegmentationAction extends Action<SegmentationData> {

    protected segmentationData: SegmentationData;

    constructor(type: ActionTypes, segmentationData: SegmentationData) {
        super(type);
        this.segmentationData = segmentationData;
    }

    /*setData(info) {
        const segData = info.segmentationData;

        if (!segData) {
            throw new Error('Illegal relinking of segmentation action! No segmentation data available!');
        }

        this.segmentationData = info.segmentationData;
    }

    /*protected get polygonList() {
        return this.segmentationData.polygons;
    }

    getPolygon(polygonId: string) {
        return this.segmentationData.getPolygon(polygonId);
    }
}*/

@Serializable()

export class CreateSegmentationLayersAction extends Action<SegCollData> {
    @JsonProperty() numSegLayers: number;

    constructor(numSegLayers: number) {
        super(ActionTypes.CreateSegmentationLayersAction);
        this.numSegLayers = numSegLayers;
    }

    perform(data: SegCollData): void {
        data.clear();
        for(let i = 0; i < this.numSegLayers; i++) {
            data.addSegmentationData(new SegmentationData());
        }
        //data.segData = new SegmentationData[this.numSegLayers];
    }
}

@Serializable()
export class AddEmptyPolygon extends Action<SegmentationData> {

    @JsonProperty()
    color: string;

    @JsonProperty()
    uuid: string;

    @JsonProperty()
    labelId: number;

    constructor(labelId: number, color: string) {
        super(ActionTypes.AddEmptyPolygon);

        this.color = color;
        this.labelId = labelId;
        this.uuid = uuidv4();
    }

    perform(segmentationData: SegmentationData) {
        const poly = new Polygon();
        poly.setColor(this.color);
        // create the polygon
        segmentationData.addPolygon(this.uuid, poly, this.labelId);
    }

}

/**
 * Action to add a full polygon
 */
@Serializable()
export class AddPolygon extends Action<SegmentationData> {

    @JsonProperty()
    uuid: string;

    @JsonProperty()
    poly: Polygon;

    @JsonProperty()
    labelId: number;

    constructor(poly: Polygon, labelId: number) {
        super(ActionTypes.AddPolygon);

        this.labelId = labelId;
        this.uuid = uuidv4();
        this.poly = poly;
    }

    perform(segmentationData: SegmentationData) {
        segmentationData.addPolygon(this.uuid, Utils.tree.clone(this.poly), this.labelId);
    }

}


@Serializable()
export class RemovePolygon extends Action<SegmentationData> {

    @JsonProperty()
    polygonId: string;

    @JsonProperty()
    polygon: Polygon;

    constructor(polgonId: string) {
        super(ActionTypes.RemovePolygon);

        this.polygonId = polgonId;
    }

    perform(segmentationData: SegmentationData) {
        this.polygon = segmentationData.removePolygon(this.polygonId);
    }
}

@Serializable()
export class SelectPolygon extends Action<SegmentationData> {

    @JsonProperty() newPolyId: string;
    @JsonProperty() oldPolyId: string;

    constructor(newPolyId: string, oldPolyId: string = null) {
        super(ActionTypes.SelectPolygon);

        this.newPolyId = newPolyId;
        if (oldPolyId) {
            this.oldPolyId = oldPolyId;
        } 
    }

    perform(segmentationData: SegmentationData) {
        if (!this.oldPolyId) {
            // use the currently active polygon for old id
            this.oldPolyId = segmentationData.activePolygonId;
        }

        // update selected polygon
        segmentationData.activePolygonId = this.newPolyId;
        segmentationData.activePointIndex = 0;
    }

    join(action: Action<SegmentationData>): boolean {
        if (action instanceof SelectPolygon) {
            console.log('Joining Select polygon');
            const selectAction = action as SelectPolygon;

            this.newPolyId = selectAction.newPolyId;

            return true;
        }

        return false;
    }
}

@Serializable()
export class AddPointAction extends Action<SegmentationData> {

    @JsonProperty()
    private point: [number, number];
    @JsonProperty()
    private index: number;
    @JsonProperty()
    private polygonId: string;

    constructor(point: [number, number], index: number, polygonId: string) {
        super(ActionTypes.AddPointAction);

        if(!point) {
            return;
        }

        this.point = Utils.tree.clone(point);
        this.index = index;
        this.polygonId = polygonId;
    }

    perform(segmentationData: SegmentationData) {
        segmentationData.getPolygon(this.polygonId).addPoint(this.index, Utils.tree.clone(this.point));

        segmentationData.activePointIndex = this.index;
    }
}

@Serializable()
export class RemovePointAction extends Action<SegmentationData> {

    @JsonProperty()
    polygonId: string;
    @JsonProperty()
    pointIndex: number;

    @JsonProperty()
    point: [number, number];

    constructor(polygonId: string, pointIndex: number) {
        super(ActionTypes.RemovePointAction);

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;
    }

    perform(segmentationData: SegmentationData) {
        // store point data
        this.point = segmentationData.getPolygon(this.polygonId).getPoint(this.pointIndex);
        // remove point
        segmentationData.getPolygon(this.polygonId).removePoint(this.pointIndex);
    }

}

@Serializable()
export class MovePointAction extends Action<SegmentationData> {

    @JsonProperty()
    private newPoint: [number, number];
    @JsonProperty()
    private oldPoint: [number, number];
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
            this.newPoint = Utils.tree.clone([...newPoint]);
        }
    }

    perform(segmentationData: SegmentationData) {
        const point = segmentationData.getPolygon(this.polygonId).getPoint(this.pointIndex)
        this.oldPoint = Utils.tree.clone(point);

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

@Serializable()
export class ChangePolygonPoints extends Action<SegmentationData> {

    @JsonProperty()
    private newPoints: Point[];
    @JsonProperty()
    private polygonId: string;

    constructor(newPoints: Point[], polygonId: string) {
        super(ActionTypes.ChangePolygonPoints);

        if (!newPoints) {
            // this is a json recreation
            return;
        }

        this.polygonId = polygonId;
        this.newPoints = Utils.tree.clone(newPoints);
    }

    perform(segmentationData: SegmentationData) {
        segmentationData.getPolygon(this.polygonId).setPoints(Utils.tree.clone(this.newPoints));
    }
}

/**
 * Basic tracking action
 * 
 * works on tracking data
 */
/*@Serializable()
export abstract class TrackingAction extends Action<TrackingData> {

    protected trackingData: TrackingData;

    constructor(type: ActionTypes, trackingData: TrackingData) {
        super(type);
        this.trackingData = trackingData;
    }

    setData(info) {
        if (!info.trackingData) {
            throw new Error('Illegal relinking of tracking action! No tracking data available');
        }

        this.trackingData = info.trackingData;
    }
}*/

/**
 * Select a segmentation during the tracking process
 */
@Serializable()
export class SelectSegmentAction extends Action<TrackingData> {
    @JsonProperty()
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment) {
        super(ActionTypes.SelectSegmentAction);
        this.selection = selectedSegment;
    }

    perform(trackingData: TrackingData) {
        trackingData.selectedSegments.push(this.selection);
    }

}

@Serializable()
export class UnselectSegmentAction extends Action<TrackingData> {
    @JsonProperty()
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment) {
        super(ActionTypes.UnselectSegmentAction);

        this.selection = selectedSegment;
    }

    perform(trackingData: TrackingData) {
        for (const [index, item] of trackingData.selectedSegments.entries()) {
            if (item.polygonId === this.selection.polygonId) {
                trackingData.selectedSegments.splice(index, 1);
            }
        }
    }
}

/**
 * Add a link during the tracking process
 */
@Serializable()
export class AddLinkAction extends Action<TrackingData> {

    @JsonProperty()
    link: TrackingLink;

    @JsonProperty({type: UnselectSegmentAction})
    unselections: UnselectSegmentAction[] = [];

    constructor(source: SelectedSegment, targets: SelectedSegment[]) {
        super(ActionTypes.AddLinkAction);

        if (!source) {
            // restoring from json
            return;
        }

        this.link = new TrackingLink(source, targets);

    }

    perform(trackingData: TrackingData) {
        this.unselections = [];

        for (const segment of trackingData.selectedSegments) {
            this.unselections.push(new UnselectSegmentAction(segment));
        }

        trackingData.trackingLinks.push(this.link);

        for (const unsel of this.unselections) {
            unsel.perform(trackingData);
        }
    }
}

@Serializable()
export class AddLabelAction extends Action<SegCollData> {

    @JsonProperty()
    label: AnnotationLabel;

    constructor(label: AnnotationLabel) {
        super(ActionTypes.AddLabelAction);
        this.label = label;
    }

    perform(data: SegCollData): void {
        data.addLabel(this.label);
    }
}

@Serializable()
export class RenameLabelAction extends Action<SegCollData> {
    @JsonProperty()
    id: number;
    @JsonProperty()
    labelName: string;

    constructor(id: number, name: string) {
        super(ActionTypes.RenameLabelAction);
        this.id = id;
        this.labelName = name;
    }

    perform(data: SegCollData): void {
        data.getLabelById(this.id).name = this.labelName;
    }
    
}

@Serializable()
export class MergeLabelAction extends Action<SegCollData> {
    @JsonProperty()
    srcId: number;
    @JsonProperty()
    dstId: number;

    constructor(srcId: number, dstId: number) {
        super(ActionTypes.MergeLabelAction);
        this.srcId = srcId;
        this.dstId = dstId;
    }

    perform(data: SegCollData): void {
        // delete source label
        data.labels.splice(data.labels.indexOf(data.getLabelById(this.srcId)), 1);

        // assign objects from source to destiation label
        for(const segData of data.segData) {
            // determine the polygons that need to switch labels
            const polyIds = [...segData.labels.entries()].filter(([polyId, labelId]) => {
                return labelId == this.srcId;
            }).map(([polyId, labelId]) => polyId);

            // switch labels
            for (const pId of polyIds) {
                segData.labels.set(pId, this.dstId);
                //segData.labels[pId] = this.dstId;
            }
        }
    }
}

@Serializable()
export class ChangeLabelActivityAction extends Action<SegCollData> {

    @JsonProperty() labelId: number;
    @JsonProperty() active: boolean;

    constructor(labelId: number, active: boolean) {
        super(ActionTypes.ChangeLabelActivityAction)
        this.labelId = labelId;
        this.active = active;
    }

    perform(data: SegCollData): void {
        if (this.active) {
            // disable all others
            for(const label of data.labels) {
                label.active = false;
            }
        }
        data.getLabelById(this.labelId).active = this.active;
    }

}

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
        data.getLabelById(this.labelId).visible = this.visible;
    }
}

@Serializable()
export class ChangeLabelColorAction extends Action<SegCollData> {
    @JsonProperty() labelId: number;
    @JsonProperty() color: string;

    constructor(labelId: number, color: string) {
        super(ActionTypes.ChangeLabelColorAction);
        this.labelId = labelId;
        this.color = color;
    }

    perform(data: SegCollData): void {
        data.getLabelById(this.labelId).color = this.color;
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

        [ActionTypes.SelectSegmentAction, SelectSegmentAction],
        [ActionTypes.AddLinkAction, AddLinkAction],
        [ActionTypes.UnselectSegmentAction, UnselectSegmentAction],

        [ActionTypes.JointAction, JointAction],
        [ActionTypes.PreventUndoActionWrapper, PreventUndoActionWrapper],

        [ActionTypes.LocalAction, LocalAction],
        [ActionTypes.CreateSegmentationLayersAction, CreateSegmentationLayersAction],

        [ActionTypes.AddLabelAction, AddLabelAction],
        [ActionTypes.RenameLabelAction, RenameLabelAction],
        [ActionTypes.ChangeLabelActivityAction, ChangeLabelActivityAction],
        [ActionTypes.ChangeLabelVisibilityAction, ChangeLabelVisibilityAction],
        [ActionTypes.ChangeLabelColorAction, ChangeLabelColorAction]
    ];

    const lookup = new Map<ActionTypes, any>();

    for (const [actionType, classConstr] of lookupList) {
        lookup.set(actionType, classConstr);
    }


    const type = action['type'];
    if (lookup.has(type)) {
        return lookup.get(type);
    } else {
        throw new Error(`Unknown action type: ${type}`);
    }
};

@Serializable()
export class LocalAction extends Action<SegCollData> {

    @JsonProperty({predicate: actionRestorer})
    action: Action<SegmentationData>;

    @JsonProperty()
    t: number;

    constructor(action: Action<SegmentationData>, t: number) {
        super(ActionTypes.LocalAction);

        this.action = action;
        this.t = t;
    }

    perform(data: SegCollData): void {
        this.action.perform(data.get(this.t));
    }
    
}

@Serializable()
export class JointAction<T> extends Action<T>{

    @JsonProperty({predicate: actionRestorer})
    actions: Action<T>[];

    constructor(...actions: Action<T>[]) {
        super(ActionTypes.JointAction);
        this.actions = actions;
    }

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

export interface ClearableStorage {
    clear();
}

@Serializable()
export class ActionManager<T extends ClearableStorage> {

    @JsonProperty({predicate: actionRestorer})
    actions: Action<T>[] = [];
    @JsonProperty()
    currentActionPointer: number;

    @JsonProperty()
    recordedActionPointer: number;

    onDataChanged = new EventEmitter<ActionManager<T>>();

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
        console.log('Add action: ' + action.constructor.name);

        if (toPerform) {
            action.perform(this.data);
        }

        if (!this.recordedActionPointer && this.currentActionPointer > 0 && this.actions[this.currentActionPointer - 1].join(action)) {
            // sucessfully joined the action
        } else {
            this.actions.splice(this.currentActionPointer, this.actions.length, action);
            this.currentActionPointer++;
        }


        /*if (this.actions.length > 0
            && (+(new Date()) - +this.actions[this.actions.length - 1].lastPerformedTime) / 1000 < this.actionTimeSplitThreshold) {
            // join with existing action due to time correspondence
            const jact = new JointAction(this.actions.pop(), action);
            jact.updatePerformedTime();
            action = jact;
            this.actions.splice(this.currentActionPointer - 1, this.actions.length, action);
        } else*/

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
        const lastAction = this.lastAction;

        console.log('Undo:');
        console.log(lastAction.constructor.name);
        console.log(lastAction);

        //lastAction.reverse();
        this.currentActionPointer -= 1;

        this.reapplyActions();

        this.notifyDataChanged();

        this.recordedActionPointer = null;
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

        console.log('Redo:');
        console.log(nextAction.constructor.name);
        console.log(nextAction);

        nextAction.perform(this.data);
        this.currentActionPointer++;

        this.notifyDataChanged();

        this.recordedActionPointer = null;
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

    reapplyActions(data = this.data) {
        data.clear();

        for (let i = 0; i < this.currentActionPointer; i++) {
            const action = this.actions[i];

            action.perform(data);
        }

        this.notifyDataChanged();
    }

    recordActions() {
        this.recordedActionPointer = this.currentActionPointer;
    }

    mergeRecordedActions() {
        if (this.recordedActionPointer) {
            const actions = this.actions.splice(this.recordedActionPointer, this.currentActionPointer - this.recordedActionPointer);

            const action = new JointAction(...actions);

            this.currentActionPointer = this.recordedActionPointer;

            this.addAction(action, false);

            this.recordedActionPointer = null;
        }
    }

    clear() {
        this.actions = []
        this.currentActionPointer = 0;

        this.notifyDataChanged();
    }
}
