/**
 * The place for all geometry models and functionality
 */

import { Position, pairwiseDistanceMin, dotLineLength, UIUtils, Utils } from './utils';
const inside = require('point-in-polygon');
import { mean } from 'mathjs';
import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';
import { polygon } from 'polygon-tools';

export type Point = [number, number];

/**
 * Bounding box class
 */
export class BoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;

    /**
     * Create a bounding box class with upper left (x, y) and width (to right) and height (downwards)
     * @param x 
     * @param y 
     * @param w 
     * @param h 
     */
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

    get center(): Point {
        return [this.x+this.w/2, this.y+this.h/2];
    }
}

/**
 * Polygon class. Usually used for RoI handling.
 */
@Serializable()
export class Polygon {
    /** point list that defines the polygon (no holes allowed) */
    @JsonProperty({name: 'points', postDeserialize: Utils.checkPoints})
    _points: Point[] = [];

    /** color */
    @JsonProperty()
    color: string;

    // cached bounding box
    _cached_bounding_box: BoundingBox = null;

    /**
     * Create a polygon based on a point list
     * @param points 
     */
    constructor(...points: Point[]) {
        this.points = points;
        this.color = UIUtils.randomBrightColor();
    }

    /**
     * Fast method the check whether point is inside this polygon
     * @param pos position of the point
     * @returns true if the point is inside, false otherwise
     */
    isInside(pos: Point): boolean {
        // first check if it is inside bouding box
        if (!this.boundingBox.isInside(pos)) {
            // point is not in bouding box -> can also not be in the polygon
            return false;
        }

        // point is in bbox --> go to more detailed check (point-in-polygon library)
        return inside(pos, this.points);
    }

    /**
     * Update the polygon color
     * @param color new color
     */
    setColor(color: string) {
        this.color = color;
    }

    /**
     * 
     * @returns the current polygon color
     */
    getColor(): string {
        return this.color;
    }

    /**
     * Modifies just a single point
     * @param index index of the point
     * @param point new point coordinates
     */
    setPoint(index: number, point: Point) {
        this.points[index][0] = point[0];
        this.points[index][1] = point[1];

        // invalidate cached bounding box
        this._cached_bounding_box = null;
    }

    set points(points: Point[]) {
        this._points = Utils.clone(points);

        // invalidate bouding box
        this._cached_bounding_box = null;
    }

    get points() {
        return this._points;
    }

    getPoint(index: number): Point {
        return this.points[index];
    }

    setPoints(points: Point[]) {
        this.points = Utils.clone(points);
    }

    /**
     * Insert a new point into the polygon
     * @param index index to insert
     * @param point new point coordinates
     */
    addPoint(index: number, point: Point) {
        this.points.splice(index, 0, point);

        // invalidate bbox
        this._cached_bounding_box = null;
    }

    /**
     * Remove a single point
     * @param index of the point
     */
    removePoint(index: number) {
        this.points.splice(index, 1);

        // invalidate bbox
        this._cached_bounding_box = null;
    }

    /**
     * Closest distance between point and polygon
     * @param point coordinates
     * @returns index and distance of the closest point
     */
    closestPointDistanceInfo(point: Point) {
        return pairwiseDistanceMin(point, this.points);
    }

    /**
     * get the bouding box of the polygon
     */
    get boundingBox(): BoundingBox {
        if(!this._cached_bounding_box) {
            // if it is not cached --> create it
            this.updateBoundingBox();
        }

        return this._cached_bounding_box
    }

    /**
     * Create the bouding box
     */
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

    // drawing methods
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

    /**
     * Returns the center coordinates of the polygon
     */
    get center(): Point {
        if (this.numPoints === 0) {
            return [0, 0];
        }
        return this.boundingBox.center;
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
     * Checks intersection with another polygon
     * @param other polygon
     * @returns true if there are intersections, otherwise false
     */
    isIntersecting(other: Polygon) {
        return polygon.intersection(this.points, other.points).length > 0;
    }

    /**
     * Subtracts the other polygon from the current and take the largest result
     * @param other polygon
     */
    subtract(other: Polygon) {
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

/**
 * Rectangle base class    getPoint(index: number): Point {
        return this.points[index];
    }

 */
export class Rectangle extends Polygon {
    constructor(x: number, y: number, width: number, height: number) {
        super([x, y], [x + width, y], [x + width, y + height], [x, y + height]);
    }
}

export class Line extends Polygon {
    constructor(startX: number, startY: number, endX: number, endY: number) {
        super([startX, startY], [endX, endY]);
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

/**
 * Polygon to approximate a circle with a maximal relative error
 */
export class MaxErrorApproxCircle extends ApproxCircle {
    /**
     * 
     * @param centerX Horizontal center coordinate of the circle 
     * @param centerY Vertical center coordinate of the circle
     * @param radius Radius of the circle
     * @param error Relative error in terms of radii so that the area approximation error is smaller than `error * radius`
     */
    constructor(centerX: number, centerY: number, radius: number, error: number) {
        // according to: https://math.stackexchange.com/questions/4132060/compute-number-of-regular-polgy-sides-to-approximate-circle-to-defined-precision
        super(centerX, centerY, radius, Math.ceil(Math.PI / Math.sqrt(2 * error)))
    }
}
