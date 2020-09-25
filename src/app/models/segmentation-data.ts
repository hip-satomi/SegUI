import { Polygon } from 'src/app/models/geometry';


export class SegmentationData {
    private polygons: Map<string, Polygon>;
    activePolygonId: string;
    activePointIndex: number;

    constructor() {
        this.clear();
    }

    clear() {
        this.polygons = new Map<string, Polygon>();
        this.activePolygonId = '';
        this.activePointIndex = 0;
    }

    getPolygon(polygonId: string) {
        return this.polygons.get(polygonId);
    }

    addPolygon(uuid: string, polygon: Polygon) {
        this.polygons.set(uuid, polygon);
    }

    /**
     * Remove the polygon from segmentation data
     * @param uuid id of the polygon
     */
    removePolygon(uuid: string): Polygon {
        // get the polygon
        const poly = this.polygons.get(uuid);

        // delete polygon
        this.polygons.delete(uuid);

        // return the old one
        return poly;
    }

    getEmptyPolygonId() {
        for (const [id, poly] of this.polygons.entries()) {
            if (poly.numPoints === 0) {
                return id;
            }
        }

        return null;
    }

    getPolygonEntries() {
        return this.polygons.entries();
    }

    contains(uuid: string) {
        return this.polygons.has(uuid);
    }

    get numPolygons(): number {
        return this.polygons.size;
    }
}
