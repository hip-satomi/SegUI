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

    protected polygonList: Polygon[];

    constructor(polygonList: Polygon[]) {
        super();
        this.polygonList = polygonList;
    }

    setPolygonList(polygonList: Polygon[]) {
        this.polygonList = polygonList;
    }
}

@jsonObject
export class AddEmptyPolygon extends SegmentationAction {

    @jsonMember
    color: string;

    constructor(polygonList: Polygon[], color: string) {
        super(polygonList);
        this.color = color;
    }

    perform() {
        const poly = new Polygon();
        poly.setColor(this.color);
        this.polygonList.push(poly);

        this.updatePerformedTime();
    }

    reverse() {
        this.polygonList.pop();
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

    constructor(point: [number, number], index: number, polygonIndex: number, polygonList: Polygon[]) {
        super(polygonList);
        this.point = point;
        this.index = index;
        this.polygonIndex = polygonIndex;
        this.polygonList = polygonList;
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

    constructor(oldPoint: [number, number], pointIndex: number, polygonIndex: number, polygonList: Polygon[]) {
        super(polygonList);
        this.polygonIndex = polygonIndex;
        this.pointIndex = pointIndex;
        const point = this.polygonList[this.polygonIndex].getPoint(this.pointIndex);
        this.newPoint = [...point];
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
        for (const act of this.actions.reverse()) {
            act.reverse();
        }
    }
}

/**
 * Handles actions with do and undo operations
 * 
 * The known types field is used for polymorphical behavior of actions and must contain a list of all possible actions
 */
@jsonObject({knownTypes: [AddEmptyPolygon, MovedPointAction, AddPointAction, JointAction]})
export class ActionManager {

    @jsonArrayMember(Action)
    actions: Action[] = [];
    @jsonMember actionTimeSplitThreshold: number;
    @jsonMember
    currentActionPointer: number;

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


        if (this.actions.length > 0
            && (+(new Date()) - +this.actions[this.actions.length - 1].lastPerformedTime) / 1000 < this.actionTimeSplitThreshold) {
            // join with existing action due to time correspondence
            const jact = new JointAction(this.actions.pop(), action);
            jact.updatePerformedTime();
            action = jact;
        } else {
            this.actions.splice(this.currentActionPointer, this.actions.length, action);
            this.currentActionPointer++;
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
  }

  /**
   * returns true iff there is action that can be undone
   */
  get canUndo() {
      return this.actions.length > 0;
  }

  /**
   * returns true iff there is an action that can be redone
   */
  get canRedo() {
      return this.actions.length > this.currentActionPointer;
  }

  reapplyActions(polygonList: Polygon[]) {
      for (let i = 0; i < this.currentActionPointer; i++) {
          const action = this.actions[i];

          if (action instanceof SegmentationAction) {
              action.setPolygonList(polygonList);
          }

          action.perform();
      }
  }
}
