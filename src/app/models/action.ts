import { Polygon } from 'src/app/models/geometry';
export abstract class Action {

    lastPerformedTime: Date;

    abstract perform(): void;
    abstract reverse(): void;

    updatePerformedTime() {
        this.lastPerformedTime = new Date();
    }
}

export class AddPointAction extends Action {

    private point: [number, number];
    private index: number;
    private polygon: Polygon;

    constructor(point: [number, number], index: number, polygon: Polygon) {
        super();
        this.point = point;
        this.index = index;
        this.polygon = polygon;
    }

    perform() {
        this.polygon.addPoint(this.index, this.point);

        this.updatePerformedTime();
    }

    reverse() {
        this.polygon.removePoint(this.index);
    }
}

export class MovedPointAction extends Action {

    private point: [number, number];
    private newPoint: [number, number];
    private oldPoint: [number, number];

    constructor(point: [number, number], oldPoint: [number, number]) {
        super();
        this.point = point;
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
}

export class JointAction extends Action{

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
 */
export class ActionManager {

    actions: Action[] = [];
    actionTimeSplitThreshold: number;
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

}
