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
    private polygon: number[][];

    constructor(point: [number, number], index: number, polygon: number[][]) {
        super();
        this.point = point;
        this.index = index;
        this.polygon = polygon;
    }

    perform() {
        this.polygon.splice(this.index, 0, this.point);

        this.updatePerformedTime();
    }

    reverse() {
        this.polygon.splice(this.index, 1);
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
