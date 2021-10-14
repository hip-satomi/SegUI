import { Polygon } from 'src/app/models/geometry';
import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { ClearableStorage } from './action';


export class SegmentationData implements ClearableStorage {
    private polygons: Map<string, Polygon>;
    activePolygonId: string;
    activePointIndex: number;
    labels: Map<string, number>;

    constructor() {
        this.clear();
    }

    clear() {
        this.polygons = new Map<string, Polygon>();
        this.activePolygonId = '';
        this.activePointIndex = 0;
        this.labels = new Map<string, number>();
    }

    getPolygon(polygonId: string): Polygon {
        if (this.polygons.has(polygonId)) {
            return this.polygons.get(polygonId);
        } else {
            return null;
        }
    }

    /**
     * Query the label of a polygon
     * 
     * @param polygonId uuid of the polygon
     * @returns the corresponding label
     */
    getPolygonLabel(polygonId: string): number {
        return this.labels.get(polygonId);
    }

    /**
     * Add a new polygon
     * 
     * @param uuid id of the polygon
     * @param polygon the polygon itself
     * @param labelId the label id of the polygon
     */
    addPolygon(uuid: string, polygon: Polygon, labelId: number) {
        this.polygons.set(uuid, polygon);
        this.labels.set(uuid, labelId);
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

    getEmptyPolygons() {
        return [...this.polygons.entries()].filter(([id, poly]) => {
            return poly.numPoints == 0
        });
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


@Serializable()
export class AnnotationLabel {
    @JsonProperty() id: number;
    @JsonProperty() name: string;
    @JsonProperty() visible: boolean;
    @JsonProperty() color: string;
    @JsonProperty() active: boolean;

    constructor(id: number, name: string, visibile = true, color = 'random', active = true) {
        this.id = id;
        this.name = name;
        this.visible = visibile;
        this.color = color;
        this.active = true;
    }
}
