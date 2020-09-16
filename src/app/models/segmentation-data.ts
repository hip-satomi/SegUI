import { Polygon } from 'src/app/models/geometry';

export class SegmentationData {
    polygons: Polygon[];
    activePolygonIndex: number;
    activePointIndex: number;

    constructor() {
        this.clear();
    }

    clear() {
        this.polygons = [];
        this.activePolygonIndex = 0;
        this.activePointIndex = 0;
    }
}
