import { EventEmitter } from '@angular/core';
import { SegmentationData } from './segmentation-data';
import { UIUtils } from './utils';
import { Polygon } from './geometry';
import { ActionManager, AddEmptyPolygon, SelectPolygon } from './action';
import { jsonMember, jsonObject } from 'typedjson';

/**
 * Segmentation model contains all the information of the segmentation
 * 
 * 
 */
@jsonObject({onDeserialized: 'onDeserialized'})
export class SegmentationModel {

    // underlying image for the segmentation
    image;
    // true iff image is loaded
    imageLoaded = false;
    // imageUrl
    @jsonMember
    private imageUrl: string;
    // action Manager that contains the actions forming the segmentation
    @jsonMember
    actionManager: ActionManager;

    onModelChange = new EventEmitter<SegmentationModel>();

    // this is the raw data for segmentation
    segmentationData: SegmentationData = new SegmentationData();


    constructor(imageUrl: string) {

        if (!imageUrl) {
            // this is a call during json deserialize
            return;
        }

        this.actionManager = new ActionManager(0.5);
        this.imageUrl = imageUrl;

        // clear segmentation data
        this.clear();
        // load the image
        this.loadImage();

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.actionManagerChanged(actionManager);
        });
    }

    /**
     * Function is called automatically after deserialization
     * 
     * Has to reconstruct the polygons from actions
     */
    onDeserialized() {
        // after deserialization load the image
        this.loadImage();

        // clear the model
        this.clear();

        // reapply actions from action manager
        this.actionManager.reapplyActions({segmentationData: this.segmentationData});

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.actionManagerChanged(actionManager);
        });
    }

    actionManagerChanged(actionManager: ActionManager) {
        this.onModelChange.emit(this);
    }

    /**
     * loading the image
     */
    loadImage() {
        this.image = new Image();

        this.imageLoaded = false;
        this.image.onload = () => {
          this.imageLoaded = true;

          // notify that the model changed
          this.onModelChange.emit(this);
        };

        this.image.src = this.imageUrl;
    }

    /**
     * Clear the polygon representation
     */
    clear() {
        this.segmentationData.clear();
    }

    /**
     * Draws the segmentations onto the canvas
     * 
     * @param ctx canvas context to draw onto
     */
    draw(ctx, markActive = true) {
        for (const [index, polygon] of this.segmentationData.getPolygonEntries()) {
            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.activePolygonId, ctx, polygon.getColor());
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, polygon.getColor());
            }
        }
        ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
    }

    drawAdvanced(ctx, colorGenerator: (polygon: Polygon) => string = (poly: Polygon) => poly.getColor()) {
        const markActive = false;

        for (const [index, polygon] of this.segmentationData.getPolygonEntries()) {
            if (polygon.numPoints === 0) {
                continue;
            }

            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.activePolygonId, ctx, colorGenerator(polygon));
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, colorGenerator(polygon));
            }
            //UIUtils.drawCircle(ctx, polygon.center, 4, '#00FF00');
        }
        ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
    }

    /**
     * add an action that modifies the segmentation model
     * @param action the action to perform
     * @param toPerform if true performs the action
     */
    addAction(action, toPerform = true) {
        this.actionManager.addAction(action, toPerform);
    }

    /**
     * Adds a new polygon to the segmentation model if necessary
     * 
     * if there is  an empty polygon at the end, this one is used
     */
    addNewPolygon(): string {
        let uuid = '';

        if (this.segmentationData.numPolygons === 0) {
            // when there are no polygons we simply have to add one
            const newAction = new AddEmptyPolygon(this.segmentationData, UIUtils.randomColor());
            uuid = newAction.uuid;
            this.addAction(newAction);

            this.activePointIndex = 0;
        } else {
            // if there are polygons we check whether there are empty ones before creating a new one
            const emptyId = this.segmentationData.getEmptyPolygonId();
            if (emptyId) {
                uuid = emptyId;
            } else {
                const newAction = new AddEmptyPolygon(this.segmentationData, UIUtils.randomColor());
                uuid = newAction.uuid;
                this.addAction(newAction);

                this.activePointIndex = 0;
            }
        }

        // select the correct polygon
        this.addAction(new SelectPolygon(this.segmentationData, uuid, this.segmentationData.activePolygonId));

        return uuid;
    }

    /**
     * get the list of polygons
     */
    /*get polygons(): Polygon[] {
        return this.segmentationData.polygons;
    }*/

    /**
     * returns the index of the currently active polygon
     * 
     */
    get activePolygonId(): string {
        return this.segmentationData.activePolygonId;
    }

    /**
     * sets the currently active polygon index
     */
    set activePolygonId(activePolygonId: string) {
        this.addAction(new SelectPolygon(this.segmentationData, activePolygonId, this.segmentationData.activePolygonId));
    }

    /**
     * returns the active point index
     */
    get activePointIndex(): number {
        return this.segmentationData.activePointIndex;
    }

    set activePointIndex(activePointIndex: number) {
        this.segmentationData.activePointIndex = activePointIndex;
    }

    /**
     * returns the currently active polygon
     */
    get activePolygon() {
        if (this.segmentationData.numPolygons === 0) {
            this.addNewPolygon();
        }

        return this.segmentationData.getPolygon(this.activePolygonId);
    }

    get activePoint() {
        return this.activePolygon.getPoint(this.activePointIndex);
    }

    undo() {
        if (this.actionManager.canUndo) {
            this.actionManager.undo();
        }
    }

    redo() {
        if (this.actionManager.canRedo) {
            this.actionManager.redo();
        }
    }
}
