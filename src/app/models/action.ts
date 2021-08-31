import { Utils } from './utils';
import { Point } from './geometry';
import 'reflect-metadata';
import { EventEmitter } from '@angular/core';
import { SelectedSegment, TrackingData, TrackingLink } from './tracking-data';
import { SegmentationData } from './segmentation-data';
import { Polygon } from 'src/app/models/geometry';
import { v4 as uuidv4 } from 'uuid';

import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';

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
    PreventUndoActionWrapper
}

@Serializable()
export abstract class Action {

    @JsonProperty()
    type: ActionTypes;

    abstract perform(): void;
    abstract reverse(): void;
    abstract setData(info): void;

    constructor(type: ActionTypes) {
        this.type = type;
    }

    join(action: Action): boolean {
        return false;
    }

    allowUndo() {
        return true;
    }

    allowRedo() {
        return true;
    }
}

@Serializable()
export abstract class DataAction extends Action {
    abstract setData(info): void;
}

@Serializable()
export abstract class SegmentationAction extends DataAction {

    protected segmentationData: SegmentationData;

    constructor(type: ActionTypes, segmentationData: SegmentationData) {
        super(type);
        this.segmentationData = segmentationData;
    }

    setData(info) {
        const segData = info.segmentationData;

        if (!segData) {
            throw new Error('Illegal relinking of segmentation action! No segmentation data available!');
        }

        this.segmentationData = info.segmentationData;
    }

    /*protected get polygonList() {
        return this.segmentationData.polygons;
    }*/

    getPolygon(polygonId: string) {
        return this.segmentationData.getPolygon(polygonId);
    }
}

@Serializable()
export class AddEmptyPolygon extends SegmentationAction {

    @JsonProperty()
    color: string;

    @JsonProperty()
    uuid: string;

    constructor(segmentationData: SegmentationData, color: string) {
        super(ActionTypes.AddEmptyPolygon, segmentationData);

        this.color = color;
        this.uuid = uuidv4();
    }

    perform() {
        const poly = new Polygon();
        poly.setColor(this.color);
        this.segmentationData.addPolygon(this.uuid, poly);
    }

    reverse() {
        this.segmentationData.removePolygon(this.uuid);
    }

}

/**
 * Action to add a full polygon
 */
@Serializable()
export class AddPolygon extends SegmentationAction {

    @JsonProperty()
    uuid: string;

    @JsonProperty()
    poly: Polygon;

    constructor(segmentationData: SegmentationData, poly: Polygon) {
        super(ActionTypes.AddPolygon, segmentationData);

        this.uuid = uuidv4();
        this.poly = poly;
    }

    perform() {
        this.segmentationData.addPolygon(this.uuid, this.poly);
    }

    reverse() {
        this.segmentationData.removePolygon(this.uuid);
    }

}


@Serializable()
export class RemovePolygon extends SegmentationAction {

    @JsonProperty()
    polygonId: string;

    @JsonProperty()
    polygon: Polygon;

    constructor(segData: SegmentationData, polgonId: string) {
        super(ActionTypes.RemovePolygon, segData);

        this.polygonId = polgonId;
    }

    perform() {
        this.polygon = this.segmentationData.removePolygon(this.polygonId);
    }

    reverse() {
        if (!this.polygon) {
            throw Error('No polygon information available! Please make sure the action has been performed before it is reversed!');
        }
        this.segmentationData.addPolygon(this.polygonId, this.polygon);
    }

}

@Serializable()
export class SelectPolygon extends SegmentationAction {

    @JsonProperty() newPolyId: string;
    @JsonProperty() oldPolyId: string;

    constructor(segmentationData: SegmentationData, newPolyId: string, oldPolyId: string = null) {
        super(ActionTypes.SelectPolygon, segmentationData);

        this.newPolyId = newPolyId;
        if (oldPolyId) {
            this.oldPolyId = oldPolyId;
        } else if (this.segmentationData) {
            // use the currently active polygon for old id
            this.oldPolyId = this.segmentationData.activePolygonId;
        }
    }

    perform() {
        this.segmentationData.activePolygonId = this.newPolyId;
        this.segmentationData.activePointIndex = 0;
    }

    reverse() {
        this.segmentationData.activePolygonId = this.oldPolyId;
        this.segmentationData.activePointIndex = this.segmentationData.getPolygon(this.segmentationData.activePolygonId).numPoints - 1;
    }

    join(action: Action): boolean {
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
export class AddPointAction extends SegmentationAction {

    @JsonProperty()
    private point: [number, number];
    @JsonProperty()
    private index: number;
    @JsonProperty()
    private polygonId: string;

    constructor(point: [number, number], index: number, polygonId: string, segmentationData: SegmentationData) {
        super(ActionTypes.AddPointAction, segmentationData);
        this.point = point;
        this.index = index;
        this.polygonId = polygonId;
    }

    perform() {
        this.getPolygon(this.polygonId).addPoint(this.index, this.point);
    }

    reverse() {
        this.getPolygon(this.polygonId).removePoint(this.index);
    }
}

@Serializable()
export class RemovePointAction extends SegmentationAction {

    @JsonProperty()
    polygonId: string;
    @JsonProperty()
    pointIndex: number;

    @JsonProperty()
    point: [number, number];

    constructor(segData: SegmentationData, polygonId: string, pointIndex: number) {
        super(ActionTypes.RemovePointAction, segData);

        if (!segData) {
            // this is just loaded from json
            return;
        }

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;

        this.point = this.getPolygon(this.polygonId).getPoint(this.pointIndex);
    }

    perform() {
        // remove point
        this.getPolygon(this.polygonId).removePoint(this.pointIndex);
    }

    reverse() {
        // add point
        this.getPolygon(this.polygonId).addPoint(this.pointIndex, this.point);
    }
}

@Serializable()
export class MovePointAction extends SegmentationAction {

    @JsonProperty()
    private newPoint: [number, number];
    @JsonProperty()
    private oldPoint: [number, number];
    @JsonProperty()
    private polygonId: string;
    @JsonProperty()
    private pointIndex: number;

    constructor(newPoint: [number, number], pointIndex: number, polygonId: string, segmentationData: SegmentationData) {
        super(ActionTypes.MovePointAction, segmentationData);

        if (!segmentationData) {
            // this is a json recreation
            return;
        }

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;

        this.newPoint = [...newPoint];
        this.oldPoint = [...this.point];
    }

    perform() {
        this.point[0] = this.newPoint[0];
        this.point[1] = this.newPoint[1];
    }

    reverse() {
        this.point[0] = this.oldPoint[0];
        this.point[1] = this.oldPoint[1];
    }

    private get point() {
        return this.getPolygon(this.polygonId).getPoint(this.pointIndex);
    }

    join(action: Action) {
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
export class ChangePolygonPoints extends SegmentationAction {

    @JsonProperty()
    private newPoints: Point[];
    @JsonProperty()
    private oldPoints: Point[];
    @JsonProperty()
    private polygonId: string;

    constructor(segmentationData: SegmentationData, newPoints: Point[], polygonId: string, oldPoints) {
        super(ActionTypes.ChangePolygonPoints, segmentationData);

        if (!segmentationData) {
            // this is a json recreation
            return;
        }

        this.polygonId = polygonId;
        this.newPoints = [...newPoints];
        /*if (oldPoints !== null) {
            this.oldPoints = oldPoints;
        } else {
        }*/
        this.oldPoints = Utils.tree.clone(oldPoints);

        if (this.oldPoints === null) {
            throw new Error('Invalid points!');
        }
    }

    perform() {
        this.getPolygon(this.polygonId).setPoints(this.newPoints);
    }

    reverse() {
        this.getPolygon(this.polygonId).setPoints(this.oldPoints);
    }

    private get points() {
        return this.getPolygon(this.polygonId).points;
    }
}

/**
 * Basic tracking action
 * 
 * works on tracking data
 */
@Serializable()
export abstract class TrackingAction extends DataAction {

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
}

/**
 * Select a segmentation during the tracking process
 */
@Serializable()
export class SelectSegmentAction extends TrackingAction {
    @JsonProperty()
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment, trackingData: TrackingData) {
        super(ActionTypes.SelectSegmentAction, trackingData);
        this.selection = selectedSegment;
    }

    perform() {
        this.trackingData.selectedSegments.push(this.selection);
    }

    reverse() {
        this.trackingData.selectedSegments.pop();
    }
}

@Serializable()
export class UnselectSegmentAction extends TrackingAction {
    @JsonProperty()
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment, trackingData: TrackingData) {
        super(ActionTypes.UnselectSegmentAction, trackingData);

        this.selection = selectedSegment;
    }

    perform() {
        for (const [index, item] of this.trackingData.selectedSegments.entries()) {
            if (item.polygonId === this.selection.polygonId) {
                this.trackingData.selectedSegments.splice(index, 1);
            }
        }
    }

    reverse() {
        this.trackingData.selectedSegments.push(this.selection);
    }
}

/**
 * Add a link during the tracking process
 */
@Serializable()
export class AddLinkAction extends TrackingAction {

    @JsonProperty()
    link: TrackingLink;

    @JsonProperty({type: UnselectSegmentAction})
    unselections: UnselectSegmentAction[] = [];

    constructor(trackingData: TrackingData, source: SelectedSegment, targets: SelectedSegment[]) {
        super(ActionTypes.AddLinkAction, trackingData);

        if (!trackingData) {
            // restoring from json
            return;
        }

        this.link = new TrackingLink(source, targets);

        for (const segment of trackingData.selectedSegments) {
            this.unselections.push(new UnselectSegmentAction(segment, this.trackingData));
        }
    }

    setData(info) {
        super.setData(info);

        for (const unsel of this.unselections) {
            unsel.setData(info);
        }
    }

    perform() {
        this.trackingData.trackingLinks.push(this.link);

        for (const unsel of this.unselections) {
            unsel.perform();
        }
    }

    reverse() {
        this.trackingData.trackingLinks.pop();

        for (const unsel of this.unselections) {
            unsel.reverse();
        }
    }
}

/**
 * Handles actions with do and undo operations
 * 
 * The known types field is used for polymorphical behavior of actions and must contain a list of all possible actions (https://github.com/JohnWeisz/TypedJSON/blob/master/spec/polymorphism-abstract-class.spec.ts)
 */
const knownTypes = [Action,
                    SegmentationAction,
                    AddEmptyPolygon,
                    AddPolygon,
                    RemovePolygon,
                    AddPointAction,
                    RemovePointAction,
                    SelectPolygon,
                    MovePointAction,
                    ChangePolygonPoints,

                    // Actions for tracking
                    TrackingAction,
                    SelectSegmentAction,
                    AddLinkAction,
                    UnselectSegmentAction];


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
        [ActionTypes.PreventUndoActionWrapper, PreventUndoActionWrapper]
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
export class JointAction extends Action{

    @JsonProperty({predicate: actionRestorer})
    actions: Action[];

    constructor(...actions: Action[]) {
        super(ActionTypes.JointAction);
        this.actions = actions;
    }

    perform() {
        for (const act of this.actions) {
            act.perform();
        }
    }

    reverse() {
        for (const act of this.actions.slice().reverse()) {
            act.reverse();
        }
    }

    setData(info) {
        for (const act of this.actions) {
            act.setData(info);
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
export class PreventUndoActionWrapper extends DataAction {

    @JsonProperty({predicate: actionRestorer})
    action: DataAction;

    constructor(action: DataAction) {
        super(ActionTypes.PreventUndoActionWrapper);
        this.action = action;
    }

    perform() {
        this.action.perform();
    }

    reverse() {
        throw new Error('Calling reverse on PreventUndoAction is not allowed');
    }

    setData(info) {
        this.action.setData(info);
    }

    allowUndo() {
        return false;
    }
}

@Serializable()
export class ActionManager {

    @JsonProperty({predicate: actionRestorer})
    actions: Action[] = [];
    @JsonProperty() actionTimeSplitThreshold: number;
    @JsonProperty()
    currentActionPointer: number;

    @JsonProperty()
    recordedActionPointer: number;

    onDataChanged = new EventEmitter<ActionManager>();

    constructor(actionTimeSplitThreshold: number) {
        this.actionTimeSplitThreshold = actionTimeSplitThreshold;
        this.currentActionPointer = 0;
    }

    /**
     * Adds an action to the action list
     * @param action the current action
     * @param toPerform if true action is performed before adding to list
     */
    addAction(action: Action, toPerform: boolean = true) {
        console.log('Add action: ' + action.constructor.name);

        if (toPerform) {
            action.perform();
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

        this.notifyDataChanged();
    }

    notifyDataChanged() {
        this.onDataChanged.emit(this);
    }

    /**
     * Undos last action
     * 
     * if there is no last action, does nothing
     */
    undo(info) {
        if (!this.canUndo) {
            return;
        }
        const lastAction = this.lastAction;

        console.log('Undo:');
        console.log(lastAction.constructor.name);
        console.log(lastAction);

        lastAction.reverse();
        this.currentActionPointer--;

        // TODO: Maybe it is smarter to reapply action instead of reversing them one by one (reverse is difficult to implement)
        //this.reapplyActions(info);

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

        console.log('Undo:');
        console.log(nextAction.constructor.name);
        console.log(nextAction);

        nextAction.perform();
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

    reapplyActions(info) {
        // attach actions with information
        for (const action of this.actions) {
            action.setData(info);
        }

        info.segmentationData.clear();

        for (let i = 0; i < this.currentActionPointer; i++) {
            const action = this.actions[i];

            action.perform();
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
