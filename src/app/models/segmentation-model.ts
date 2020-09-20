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

    onModelChange: (SegmentationModel) => void;

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

        this.actionManager.onDataChanged = (actionManager: ActionManager) => {
            this.actionManagerChanged(actionManager);
        };
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
        this.actionManager.reapplyActions(this.segmentationData);

        this.actionManager.onDataChanged = (actionManager: ActionManager) => {
            this.actionManagerChanged(actionManager);
        };
    }

    actionManagerChanged(actionManager: ActionManager) {
        if (this.onModelChange) {
            this.onModelChange(this);
        }
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
          if (this.onModelChange) {
            this.onModelChange(this);
          }
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
    draw(ctx) {
        for (const [index, polygon] of this.polygons.entries()) {
          UIUtils.drawSingle(polygon.points, index === this.activePolygonIndex, ctx, polygon.getColor());
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
    addNewPolygon() {
        if (this.polygons.length === 0) {
            this.addAction(new AddEmptyPolygon(this, UIUtils.randomColor()));

            this.activePointIndex = 0;
        }
        // insert new empty polygon at the end if needed
        else if (this.polygons[this.polygons.length - 1].numPoints > 0) {
            this.addAction(new AddEmptyPolygon(this, UIUtils.randomColor()));

            this.activePointIndex = 0;
        }

        this.addAction(new SelectPolygon(this.segmentationData, this.polygons.length - 1, this.segmentationData.activePolygonIndex));
    }

    /**
     * get the list of polygons
     */
    get polygons(): Polygon[] {
        return this.segmentationData.polygons;
    }

    /**
     * returns the index of the currently active polygon
     * 
     */
    get activePolygonIndex(): number {
        return this.segmentationData.activePolygonIndex;
    }

    /**
     * sets the currently active polygon index
     */
    set activePolygonIndex(activePolygonIndex: number) {
        this.addAction(new SelectPolygon(this.segmentationData, activePolygonIndex, this.segmentationData.activePolygonIndex));
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
        if (this.polygons.length === 0) {
            this.addNewPolygon();
        }

        return this.polygons[this.activePolygonIndex];
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
