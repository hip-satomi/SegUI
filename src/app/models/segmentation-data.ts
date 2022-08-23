import { Polygon } from 'src/app/models/geometry';
import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { ClearableStorage } from './action';

/**
 * Segmentation data for a single image.
 */
export class SegmentationData implements ClearableStorage {
    /** Mapping polygon ids to objects */
    private polygons: Map<string, Polygon>;
    /** currently active polygon */
    activePolygonId: string;
    /** currently active point index (of active polygon) */
    activePointIndex: number;
    /** map polygon labels to annotation label ids */
    labels: Map<string, number>;

    constructor() {
        this.clear();
    }

    /**
     * Reset the segementation data
     */
    clear() {
        this.polygons = new Map<string, Polygon>();
        this.activePolygonId = null;
        this.activePointIndex = 0;
        this.labels = new Map<string, number>();
    }

    /** get a polygon object by id */

    /**
     * Get a polygon object by id or null (if object does not exist)
     * @param polygonId the query id
     * @returns polygon object or null (if object does not exist)
     */
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
        this.labels.delete(uuid);

        // return the old one
        return poly;
    }

    /**
     * 
     * @returns id of the first empty (no points) polygon or null
     */
    getEmptyPolygonId() {
        for (const [id, poly] of this.polygons.entries()) {
            if (poly.numPoints === 0) {
                return id;
            }
        }

        return null;
    }

    /**
     * 
     * @returns List of all empty [polygon ids, polygon object]
     */
    getEmptyPolygons(): Array<[string, Polygon]> {
        return [...this.polygons.entries()].filter(([id, poly]) => {
            return poly.numPoints == 0;
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


/**
 * Annotation label class for storing all information related to a single label.
 */
@Serializable()
export class AnnotationLabel {
    @JsonProperty() id: number;
    @JsonProperty() name: string;
    @JsonProperty() visible: boolean;
    @JsonProperty() color: string;
    @JsonProperty() active: boolean;

    /**
     * 
     * @param id unique id of the label
     * @param name of the label
     * @param visibile status (corresponds to beeing rendered or not)
     * @param color of the label ('random' indicates to use underlying polygon color)
     * @param active labels can be modified
     */
    constructor(id: number, name: string, visibile = true, color = 'random', active = true) {
        this.id = id;
        this.name = name;
        this.visible = visibile;
        this.color = color;
        this.active = true;
    }
}
