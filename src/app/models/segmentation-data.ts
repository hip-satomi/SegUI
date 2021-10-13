import { Polygon } from 'src/app/models/geometry';
import { ClearableStorage } from './action';


export class SegmentationData implements ClearableStorage {
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

    getPolygon(polygonId: string): Polygon {
        if (this.polygons.has(polygonId)) {
            return this.polygons.get(polygonId);
        } else {
            return null;
        }
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

    getPolygons() {
        return this.polygons;
    }

    contains(uuid: string) {
        return this.polygons.has(uuid);
    }

    get numPolygons(): number {
        return this.polygons.size;
    }
}


export class AnnotationLabel {
    id: number;
    name: string;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }
}
