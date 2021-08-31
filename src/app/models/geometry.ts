import { Position, pairwiseDistanceMin, dotLineLength, UIUtils, Utils } from './utils';
const inside = require('point-in-polygon');
import { mean } from 'mathjs';
import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';
import { polygon } from 'polygon-tools';

export type Point = [number, number];

class BoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;

    constructor(x: number, y: number, w: number, h: number) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    /**
     * Returns true iff the point is inside the bounding box
     * @param point 
     */
    isInside(point: Point) {
        const x = point[0];
        const y = point[1];

        return x >= this.x && x <= this.x + this.w && y > this.y && y < this.y + this.h;
    }
}

@Serializable()
export class Polygon {
    @JsonProperty({name: 'points'})
    _points: Point[] = [];

    @JsonProperty()
    color: string;

    _cached_bounding_box: BoundingBox;

    constructor(...points: Point[]) {
        this.points = points;
        this.color = UIUtils.randomColor();
    }

    isInside(pos: Point): boolean {
        // first check if it is inside bouding box
        if (!this.boundingBox.isInside(pos)) {
            return false;
        }
        return inside(pos, this.points);
    }

    isInsideBBox(pos: Point): boolean {
        return pos[0] >= this.boundingBox.x && pos[0] <= (this.boundingBox.x + this.boundingBox.w) && pos[1] >= this.boundingBox.y && pos[1] <= (this.boundingBox.y + this.boundingBox.h);
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

        this._cached_bounding_box = null;
    }

    set points(points: Point[]) {
        this._points = points;

        this._cached_bounding_box = null;
    }

    get points() {
        return this._points;
    }

    setPoints(points: Point[]) {
        this.points = points;
    }

    addPoint(index: number, point: Point) {
        this.points.splice(index, 0, point);

        this._cached_bounding_box = null;
    }

    removePoint(index: number) {
        this.points.splice(index, 1);

        this._cached_bounding_box = null;
    }

    getPoint(index: number): Point {
        return this.points[index];
    }

    closestPointDistanceInfo(point: Point) {
        return pairwiseDistanceMin(point, this.points);

    }

    get boundingBox() {
        if(!this._cached_bounding_box) {
            this.updateBoundingBox();
        }

        return this._cached_bounding_box
    }

    private updateBoundingBox() {
        let minx = Number.MAX_VALUE;
        let maxx = Number.MIN_VALUE;
        let miny = Number.MAX_VALUE;
        let maxy = Number.MIN_VALUE;

        if (this.points.length == 0) {
            minx = 0;
            maxx = 0;
            miny = 0;
            maxy = 0;
        } else {
            for(let point of this.points) {
                const x = point[0];
                const y = point[1];

                minx = Math.min(minx, x);
                maxx = Math.max(maxx, x);
                
                miny = Math.min(miny, y);
                maxy = Math.max(maxy, y);
            }
        }
        
        this._cached_bounding_box = new BoundingBox(minx, miny, (maxx - minx), (maxy - miny));
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
        if (this.numPoints === 0) {
            return [0, 0];
        }
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

    isIntersecting(other: Polygon) {
        return polygon.intersection(this.points, other.points).length > 0;
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
    constructor(centerX: number, centerY: number, radius: number, numPoints = 2 * Math.PI * radius) {
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
