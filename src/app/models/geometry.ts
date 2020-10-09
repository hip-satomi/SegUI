import { Position, pairwiseDistanceMin, dotLineLength, UIUtils } from './utils';
const inside = require('point-in-polygon');
import { mean } from 'mathjs';
import { jsonArrayMember, jsonMember, jsonObject } from 'typedjson';

export type Point = [number, number];

@jsonObject
export class Polygon {
    @jsonArrayMember(Number, { dimensions: 2 })
    points: Point[] = [];

    @jsonMember
    color: string;

    constructor(...points: Point[]) {
        this.points = points;
    }

    isInside(pos: Point): boolean {
        return inside(pos, this.points);
    }

    setColor(color: string) {
        this.color = color;
    }

    getColor(): string {
        return this.color;
    }

    setPoint(index: number, point: Point) {
        this.points[index][0] = point[0];
        this.points[index][1] = point[1];
    }

    addPoint(index: number, point: Point) {
        this.points.splice(index, 0, point);
    }

    removePoint(index: number) {
        this.points.splice(index, 1);
    }

    getPoint(index: number): Point {
        return this.points[index];
    }

    closestPointDistanceInfo(point: Point) {
        return pairwiseDistanceMin(point, this.points);

    }

    /**
     * Converts an arbitray index (pos or negative) to the correct array element
     * @param index index
     */
    private runningIndex(index: number): number {
        // fix negative indices
        while (index < 0) {
            index += this.points.length;
        }

        // fix too large indices
        if (index >= this.points.length) {
            index = index % this.points.length;
        }

        return index;
    }

    distanceToOuterShape(point: Point) {
        const x = point[0];
        const y = point[1];

        let minDist = 0;
        let minIndex = -1;

        for (let i = 0; i < this.numPoints; i++) {
            const lineDist = dotLineLength(
              x, y,
              this.points[i][0], this.points[i][1],
              this.points[this.runningIndex(i - 1)][0], this.points[this.runningIndex(i - 1)][1],
              true
            );
            if (lineDist < minDist || minIndex === -1) {
                minDist = lineDist;
                minIndex = i;
            }
        }

        return {
            index: minIndex,
            distance: minDist
        };
    }

    draw(ctx, active = false) {
        UIUtils.drawSingle(this.points, active, ctx, this.color);
    }

    drawAdvanced(ctx, active = false, color) {
        UIUtils.drawSingle(this.points, active, ctx, color);
    }

    drawCenter(ctx, color, radius) {
        UIUtils.drawCircle(ctx, this.center, radius, color);
    }

    get numPoints(): number {
        return this.points.length;
    }

    get center(): Point {
        return mean(this.points, 0);
    }
}

export class Rectangle extends Polygon {
    constructor(x: number, y: number, width: number, height: number) {
        super([x, y], [x + width, y], [x + width, y + height], [x, y + height]);
    }
}
