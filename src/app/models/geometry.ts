import { Position, pairwiseDistanceMin, dotLineLength, UIUtils, Utils } from './utils';
const inside = require('point-in-polygon');
import { mean } from 'mathjs';
import { jsonArrayMember, jsonMember, jsonObject } from 'typedjson';
import { polygon } from 'polygon-tools';

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

    setPoints(points: Point[]) {
        this.points = points;
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

    /**
     * Joins the current polygon with the other one if possible
     * 
     * @param other polygon
     */
    join(other: Polygon) {
        if (this.points.length === 0) {
            this.points = other.points;
        } else { //if (polygon.intersection(this.points, other.points).length !== 0) {
            try {
                const points = this.takeLargest(polygon.union(this.points, other.points));
                if (!points) {
                    throw new Error('points are not valid!');
                }
                if (polygon.area(points) > polygon.area(this.points)) {
                    this.points = points;
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    /**
     * Subtracts the other polygon from the current
     * @param other polygon
     */
    subtract(other: Polygon) {
        const pointsCopy = Utils.tree.clone(this.points);
        try {
            const points = this.takeLargest(polygon.subtract(this.points, other.points));
            this.points = points;
        } catch (e) {
            console.error('ERROR in subtract function');
            console.error(e);
        }

        if (this.points === null) {
            console.warn('Had to reset poly points!');
            this.points = [];
        }
    }

    /**
     * Takes the largest polygon from a list of polygon point lists
     * @param polygonPointLists list polygon points
     */
    private takeLargest(polygonPointLists: Point[][]): Point[] {
        let maxArea = 0;
        let maxIdx = -1;
        for (const [idx, polList] of polygonPointLists.entries()) {
            const area = polygon.area(polList);

            if (area > maxArea || maxIdx === -1) {
                maxArea = area;
                maxIdx = idx;
            }
        }

        if (maxIdx === -1) {
            return [];
        }
        return polygonPointLists[maxIdx];
    }
}

export class Rectangle extends Polygon {
    constructor(x: number, y: number, width: number, height: number) {
        super([x, y], [x + width, y], [x + width, y + height], [x, y + height]);
    }
}

/**
 * An approximated circle polygon class
 * 
 * Approximates a circle with a given number of contour points
 */
export class ApproxCircle extends Polygon {
    constructor(centerX: number, centerY: number, radius: number, numPoints = 10) {
        const stepAngle = 2 * Math.PI / numPoints;
        const points: Point[] = [];
        for (let pointIdx = 0; pointIdx < numPoints; pointIdx++) {
            const angle = stepAngle * pointIdx;

            const deltaX = Math.cos(angle) * radius;
            const deltaY = Math.sin(angle) * radius;

            points.push([centerX + deltaX, centerY + deltaY]);
        }
        super(...points);
    }
}
