import { Position, pairwiseDistanceMin, dotLineLength } from './utils';
const inside = require('point-in-polygon');

type Point = [number, number];
export class Polygon {
    points: Point[] = [];
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

    distanceToOuterShape(point: Point) {
        const x = point[0];
        const y = point[1];

        let minDist = 0;
        let minIndex = -1;

        for (let i = 1; i < this.numPoints; i++) {
            const lineDist = dotLineLength(
              x, y,
              this.points[i][0], this.points[i][1],
              this.points[i - 1][0], this.points[i - 1][1],
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

    get numPoints(): number {
        return this.points.length;
    }
}

export class Rectangle extends Polygon {
    constructor(x: number, y: number, width: number, height: number) {
        super([x, y], [x + width, y], [x + width, y + height], [x, y + height]);
    }
}
