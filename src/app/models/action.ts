import { EventEmitter } from '@angular/core';
import { SelectedSegment, TrackingData, TrackingLink } from './tracking-data';
import { SegmentationData } from './segmentation-data';
import { Polygon } from 'src/app/models/geometry';
import 'reflect-metadata';
import { jsonArrayMember, jsonMember, jsonObject, toJson, TypedJSON } from 'typedjson';
import { v4 as uuidv4 } from 'uuid';
import { stringify as uuidStringify } from 'uuid';
@jsonObject
export abstract class Action {

    @jsonMember
    lastPerformedTime: Date;

    abstract perform(): void;
    abstract reverse(): void;
    abstract setData(info): void;

    constructor() {
    }

    join(action: Action): boolean {
        return false;
    }

    updatePerformedTime() {
        this.lastPerformedTime = new Date();
    }

    allowUndo() {
        return true;
    }

    allowRedo() {
        return true;
    }
}

@jsonObject
export abstract class DataAction extends Action {
    abstract setData(info): void;
}

@jsonObject
export abstract class SegmentationAction extends DataAction {

    protected segmentationData: SegmentationData;

    constructor(segmentationData: SegmentationData) {
        super();
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

@jsonObject
export class AddEmptyPolygon extends SegmentationAction {

    @jsonMember
    color: string;

    @jsonMember
    uuid: string;

    constructor(segmentationData: SegmentationData, color: string) {
        super(segmentationData);

        this.color = color;
        this.uuid = uuidv4();
    }

    perform() {
        const poly = new Polygon();
        poly.setColor(this.color);
        this.segmentationData.addPolygon(this.uuid, poly);

        this.updatePerformedTime();
    }

    reverse() {
        this.segmentationData.removePolygon(this.uuid);
    }

}

@jsonObject
export class RemovePolygon extends SegmentationAction {

    @jsonMember
    polygonId: string;

    @jsonMember
    polygon: Polygon;

    constructor(segData: SegmentationData, polgonId: string) {
        super(segData);

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

@jsonObject
export class SelectPolygon extends SegmentationAction {

    @jsonMember newPolyId: string;
    @jsonMember oldPolyId: string;

    constructor(segmentationData: SegmentationData, newPolyId: string, oldPolyId: string) {
        super(segmentationData);

        this.newPolyId = newPolyId;
        this.oldPolyId = oldPolyId;
    }

    perform() {
        this.segmentationData.activePolygonId = this.newPolyId;
        this.segmentationData.activePointIndex = 0;

        this.updatePerformedTime();
    }

    reverse() {
        this.segmentationData.activePolygonId = this.oldPolyId;
        this.segmentationData.activePointIndex = this.segmentationData.getPolygon(this.segmentationData.activePolygonId).numPoints - 1;
    }

    join(action: Action): boolean {
        if (action instanceof SelectPolygon) {
            const selectAction = action as SelectPolygon;

            this.newPolyId = selectAction.newPolyId;

            return true;
        }

        return false;
    }
}

@jsonObject
export class AddPointAction extends SegmentationAction {

    @jsonArrayMember(Number)
    private point: [number, number];
    @jsonMember
    private index: number;
    @jsonMember
    private polygonId: string;

    constructor(point: [number, number], index: number, polygonId: string, segmentationData: SegmentationData) {
        super(segmentationData);
        this.point = point;
        this.index = index;
        this.polygonId = polygonId;
    }

    perform() {
        this.getPolygon(this.polygonId).addPoint(this.index, this.point);

        this.updatePerformedTime();
    }

    reverse() {
        this.getPolygon(this.polygonId).removePoint(this.index);
    }
}

@jsonObject
export class RemovePointAction extends SegmentationAction {

    @jsonMember
    polygonId: string;
    @jsonMember
    pointIndex: number;

    @jsonArrayMember(Number)
    point: [number, number];

    constructor(segData: SegmentationData, polygonId: string, pointIndex: number) {
        super(segData);

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

@jsonObject
export class MovedPointAction extends SegmentationAction {

    @jsonArrayMember(Number)
    private newPoint: [number, number];
    @jsonArrayMember(Number)
    private oldPoint: [number, number];
    @jsonMember
    private polygonId: string;
    @jsonMember
    private pointIndex: number;

    constructor(oldPoint: [number, number], pointIndex: number, polygonId: string, segmentationData: SegmentationData) {
        super(segmentationData);

        if (!segmentationData) {
            // this is a json recreation
            return;
        }

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;
        //const point = this.polygonList[this.polygonIndex].getPoint(this.pointIndex);
        this.newPoint = [...this.point];
        this.oldPoint = [...oldPoint];
    }

    perform() {
        this.point[0] = this.newPoint[0];
        this.point[1] = this.newPoint[1];

        this.updatePerformedTime();
    }

    reverse() {
        this.point[0] = this.oldPoint[0];
        this.point[1] = this.oldPoint[1];
    }

    private get point() {
        return this.getPolygon(this.polygonId).getPoint(this.pointIndex);
    }
}

@jsonObject
export class MovePointAction extends SegmentationAction {

    @jsonArrayMember(Number)
    private newPoint: [number, number];
    @jsonArrayMember(Number)
    private oldPoint: [number, number];
    @jsonMember
    private polygonId: string;
    @jsonMember
    private pointIndex: number;

    constructor(newPoint: [number, number], pointIndex: number, polygonId: string, segmentationData: SegmentationData) {
        super(segmentationData);

        if (!segmentationData) {
            // this is a json recreation
            return;
        }

        this.polygonId = polygonId;
        this.pointIndex = pointIndex;
        //const point = this.polygonList[this.polygonIndex].getPoint(this.pointIndex);
        this.newPoint = [...newPoint];
        this.oldPoint = [...this.point];
    }

    perform() {
        this.point[0] = this.newPoint[0];
        this.point[1] = this.newPoint[1];

        this.updatePerformedTime();
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

/**
 * Basic tracking action
 * 
 * works on tracking data
 */
@jsonObject
export abstract class TrackingAction extends DataAction {

    protected trackingData: TrackingData;

    constructor(trackingData: TrackingData) {
        super();
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
@jsonObject
export class SelectSegmentAction extends TrackingAction {
    @jsonMember
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment, trackingData: TrackingData) {
        super(trackingData);
        this.selection = selectedSegment;
    }

    perform() {
        this.trackingData.selectedSegments.push(this.selection);
    }

    reverse() {
        this.trackingData.selectedSegments.pop();
    }
}

@jsonObject
export class UnselectSegmentAction extends TrackingAction {
    @jsonMember
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment, trackingData: TrackingData) {
        super(trackingData);

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
@jsonObject
export class AddLinkAction extends TrackingAction {

    @jsonMember
    link: TrackingLink;

    @jsonArrayMember(UnselectSegmentAction)
    unselections: UnselectSegmentAction[] = [];

    constructor(trackingData: TrackingData, source: SelectedSegment, targets: SelectedSegment[]) {
        super(trackingData);

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
                    RemovePolygon,
                    AddPointAction,
                    RemovePointAction,
                    SelectPolygon,
                    MovePointAction,

                    // Actions for tracking
                    TrackingAction,
                    SelectSegmentAction,
                    AddLinkAction,
                    UnselectSegmentAction];


@jsonObject({knownTypes: [...knownTypes, JointAction]})
export class JointAction extends Action{

    @jsonArrayMember(Action)
    actions: Action[];

    constructor(...actions: Action[]) {
        super();
        this.actions = actions;
    }

    perform() {
        for (const act of this.actions) {
            act.perform();
        }

        this.updatePerformedTime();
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
}

@jsonObject({knownTypes: [...knownTypes, JointAction]})
export class PreventUndoActionWrapper extends DataAction {

    @jsonMember
    action: DataAction;

    constructor(action: DataAction) {
        super();
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

@jsonObject({knownTypes: [...knownTypes, JointAction, PreventUndoActionWrapper]})
export class ActionManager {

    @jsonArrayMember(Action)
    actions: Action[] = [];
    @jsonMember actionTimeSplitThreshold: number;
    @jsonMember
    currentActionPointer: number;

    @jsonMember
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
    undo() {
        if (!this.canUndo) {
            return;
        }
        const lastAction = this.actions[this.currentActionPointer - 1];
        lastAction.reverse();
        this.currentActionPointer--;

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
        for (let i = 0; i < this.currentActionPointer; i++) {
            const action = this.actions[i];

            action.setData(info);

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
}
