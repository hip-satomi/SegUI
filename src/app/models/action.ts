import { EventEmitter } from '@angular/core';
import { SelectedSegment, TrackingData, TrackingLink } from './tracking-data';
import { SegmentationData } from './segmentation-data';
import { Polygon } from 'src/app/models/geometry';
import 'reflect-metadata';
import { jsonArrayMember, jsonMember, jsonObject, toJson, TypedJSON } from 'typedjson';

@jsonObject
export abstract class Action {

    @jsonMember
    lastPerformedTime: Date;

    abstract perform(): void;
    abstract reverse(): void;
    abstract setData(info): void;

    join(action: Action): boolean {
        return false;
    }

    updatePerformedTime() {
        this.lastPerformedTime = new Date();
    }
}

@jsonObject
export abstract class SegmentationAction extends Action {

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

    protected get polygonList() {
        return this.segmentationData.polygons;
    }
}

@jsonObject
export class AddEmptyPolygon extends SegmentationAction {

    @jsonMember
    color: string;

    constructor(segmentationData: SegmentationData, color: string) {
        super(segmentationData);
        this.color = color;
    }

    perform() {
        const poly = new Polygon();
        poly.setColor(this.color);
        this.segmentationData.polygons.push(poly);

        this.updatePerformedTime();
    }

    reverse() {
        this.segmentationData.polygons.pop();
    }

}

@jsonObject
export class SelectPolygon extends SegmentationAction {

    @jsonMember newPolyIndex: number;
    @jsonMember oldPolyIndex: number;

    constructor(segmentationData: SegmentationData, newPolyIndex: number, oldPolyIndex: number) {
        super(segmentationData);

        this.newPolyIndex = newPolyIndex;
        this.oldPolyIndex = oldPolyIndex;
    }

    perform() {
        this.segmentationData.activePolygonIndex = this.newPolyIndex;
        this.segmentationData.activePointIndex = 0;

        this.updatePerformedTime();
    }

    reverse() {
        this.segmentationData.activePolygonIndex = this.oldPolyIndex;
        this.segmentationData.activePointIndex = this.segmentationData.polygons[this.segmentationData.activePolygonIndex].numPoints - 1;
    }

    join(action: Action): boolean {
        if (action instanceof SelectPolygon) {
            const selectAction = action as SelectPolygon;

            this.newPolyIndex = selectAction.newPolyIndex;

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
    private polygonIndex: number;

    constructor(point: [number, number], index: number, polygonIndex: number, segmentationData: SegmentationData) {
        super(segmentationData);
        this.point = point;
        this.index = index;
        this.polygonIndex = polygonIndex;
    }

    perform() {
        this.polygonList[this.polygonIndex].addPoint(this.index, this.point);

        this.updatePerformedTime();
    }

    reverse() {
        this.polygonList[this.polygonIndex].removePoint(this.index);
    }
}

@jsonObject
export class MovedPointAction extends SegmentationAction {

    @jsonArrayMember(Number)
    private newPoint: [number, number];
    @jsonArrayMember(Number)
    private oldPoint: [number, number];
    @jsonMember
    private polygonIndex: number;
    @jsonMember
    private pointIndex: number;

    constructor(oldPoint: [number, number], pointIndex: number, polygonIndex: number, segmentationData: SegmentationData) {
        super(segmentationData);

        if (!segmentationData) {
            // this is a json recreation
            return;
        }

        this.polygonIndex = polygonIndex;
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
        return this.polygonList[this.polygonIndex].getPoint(this.pointIndex);
    }
}

@jsonObject
export class MovePointAction extends SegmentationAction {

    @jsonArrayMember(Number)
    private newPoint: [number, number];
    @jsonArrayMember(Number)
    private oldPoint: [number, number];
    @jsonMember
    private polygonIndex: number;
    @jsonMember
    private pointIndex: number;

    constructor(newPoint: [number, number], pointIndex: number, polygonIndex: number, segmentationData: SegmentationData) {
        super(segmentationData);

        if (!segmentationData) {
            // this is a json recreation
            return;
        }

        this.polygonIndex = polygonIndex;
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
        return this.polygonList[this.polygonIndex].getPoint(this.pointIndex);
    }

    join(action: Action) {
        if (action instanceof MovePointAction) {
            const mpAction = action as MovePointAction;

            if (this.polygonIndex === mpAction.polygonIndex && this.pointIndex === mpAction.pointIndex) {
                // polygon and point do correspond
                this.newPoint = mpAction.newPoint;
                return true;
            }
        }

        return false;
    }
}

@jsonObject({knownTypes: [AddEmptyPolygon, MovedPointAction, AddPointAction, JointAction, SelectPolygon]})
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

/**
 * Basic tracking action
 * 
 * works on tracking data
 */
export abstract class TrackingAction extends Action {

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

export class UnselectSegmentAction extends TrackingAction {
    @jsonMember
    selection: SelectedSegment;

    constructor(selectedSegment: SelectedSegment, trackingData: TrackingData) {
        super(trackingData);

        this.selection = selectedSegment;
    }

    perform() {
        for (const [index, item] of this.trackingData.selectedSegments.entries()) {
            if (item.frame === this.selection.frame && item.polygonIndex === this.selection.polygonIndex) {
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
export class AddLinkAction extends TrackingAction {

    @jsonMember
    link: TrackingLink;

    @jsonArrayMember(UnselectSegmentAction)
    unselections: UnselectSegmentAction[] = [];

    constructor(trackingData: TrackingData) {
        super(trackingData);

        // generate link from selection
        const frames = new Set<number>();
        for (const segment of trackingData.selectedSegments) {
            frames.add(segment.frame);
        }

        if (frames.size !== 2) {
            throw new Error('wrong frame selection');
        }

        const sourceFrame = Math.min(...frames);
        const targetFrame = Math.max(...frames);

        const sourceSelections = [];
        const targetSelections = [];

        for (const segment of trackingData.selectedSegments) {
            if (segment.frame === sourceFrame) {
                sourceSelections.push(segment);
            } else {
                targetSelections.push(segment);
            }
        }

        if (sourceSelections.length !== 1) {
            throw new Error('Do not support multi selections');
        }

        this.link = new TrackingLink(sourceSelections[0], targetSelections);

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
@jsonObject({knownTypes: [AddEmptyPolygon, MovedPointAction, AddPointAction, JointAction, SelectPolygon, MovePointAction, SelectSegmentAction, AddLinkAction, UnselectSegmentAction]})
export class ActionManager {

    @jsonArrayMember(Action)
    actions: Action[] = [];
    @jsonMember actionTimeSplitThreshold: number;
    @jsonMember
    currentActionPointer: number;

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

        if (this.currentActionPointer > 0 && this.actions[this.currentActionPointer - 1].join(action)) {
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
        if (this.onDataChanged) {
            this.onDataChanged.emit(this);
        }
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
    }

    /**
     * returns true iff there is action that can be undone
     */
    get canUndo() {
        return this.currentActionPointer > 0;
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
}
