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

    setSegmentationData(segmentationData: SegmentationData) {
        this.segmentationData = segmentationData;
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
}

/**
 * Handles actions with do and undo operations
 * 
 * The known types field is used for polymorphical behavior of actions and must contain a list of all possible actions (https://github.com/JohnWeisz/TypedJSON/blob/master/spec/polymorphism-abstract-class.spec.ts)
 */
@jsonObject({knownTypes: [AddEmptyPolygon, MovedPointAction, AddPointAction, JointAction, SelectPolygon]})
export class ActionManager {

    @jsonArrayMember(Action)
    actions: Action[] = [];
    @jsonMember actionTimeSplitThreshold: number;
    @jsonMember
    currentActionPointer: number;

    onDataChanged: (actionManager: ActionManager) => void;

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


        /*if (this.actions.length > 0
            && (+(new Date()) - +this.actions[this.actions.length - 1].lastPerformedTime) / 1000 < this.actionTimeSplitThreshold) {
            // join with existing action due to time correspondence
            const jact = new JointAction(this.actions.pop(), action);
            jact.updatePerformedTime();
            action = jact;
            this.actions.splice(this.currentActionPointer - 1, this.actions.length, action);
        } else*/ {
            this.actions.splice(this.currentActionPointer, this.actions.length, action);
            this.currentActionPointer++;
        }

        this.notifyDataChanged();
    }

    notifyDataChanged() {
        if (this.onDataChanged) {
            this.onDataChanged(this);
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

    reapplyActions(segmentationData: SegmentationData) {
        for (let i = 0; i < this.currentActionPointer; i++) {
            const action = this.actions[i];

            if (action instanceof SegmentationAction) {
                action.setSegmentationData(segmentationData);
            }

            action.perform();
        }

        this.notifyDataChanged();
    }
}
