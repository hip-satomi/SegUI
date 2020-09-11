import { Position } from './utils';
const inside = require('point-in-polygon');

export class Polygon {
    points: [number, number][] = [];

    constructor(...points: [number, number][]) {
        this.points = points;
    }

    isInside(pos: [number, number]): boolean {
        return inside(pos, this.points);
    }
}

export class Rectangle extends Polygon {
    constructor(x: number, y: number, width: number, height: number) {
        super([x, y], [x + width, y], [x + width, y + height], [x, y + height]);
    }
}
