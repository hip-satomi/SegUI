import { EventEmitter } from "@angular/core";
import { Subject } from "rxjs";
import { map, takeUntil } from "rxjs/operators";
import { JsonProperty, Serializable } from "typescript-json-serializer";
import { Action, ActionManager } from "../action";
import { ChangableModel, ChangeType, ModelChanged } from "../change";
import { GlobalSegmentationModel, SimpleDetection, SimpleSegmentation } from "../segmentation-model";
import { SynchronizedObject } from "../storage";
import { Link, TrackingData } from "./data";

/**
 * Segmentation model for the full image stack containing ActionManager and segmentation data.
 */
 @Serializable()
 export class GlobalTrackingModel extends SynchronizedObject<GlobalTrackingModel> implements ChangableModel<GlobalTrackingModel> {
     /** The action manager containing all the actions to construct the segmentation models for the image stack */
     @JsonProperty()
     private actionManager: ActionManager<TrackingData>;
 
     /** format version */
     @JsonProperty()
     private _formatVersion: string;
 
     // TODO: change this if version changes (especially for breaks)
     static defaultFormatVersion = '0.1';
 
     /** the segmentation data for all images */
     trackingData: TrackingData;
 
     /** singal to stop processing pipelines */
     protected destroySignal: Subject<void>;
 
     get formatVersion(): string {
         return this._formatVersion;
     }
 
     get modelChanged() {
         return this.actionManager.onDataChanged.pipe(
             takeUntil(this.destroySignal),
             map(() => new ModelChanged<GlobalTrackingModel>(this, ChangeType.HARD))
         );
     }
 
     /**
      * Creates a global tracking model for an image stack
      * @param destroySignal distroy signal to stop processing pipelines when necessary (e.g. when another model is used)
      * @returns 
      */
     constructor(destroySignal) {
         super();
         this.destroySignal = destroySignal;
 
         // create new segmentation data
         this.trackingData = new TrackingData();
 
         // create new action manager and link to data
         this.actionManager = new ActionManager(this.trackingData);
 
         if (destroySignal === undefined) {
             // we are only deserializing
             return;
         }
 
         // set creation format version
         this._formatVersion = GlobalTrackingModel.defaultFormatVersion;
      }
 
     /**
      * Take action after deserialization
      * @param destroySignal the signal to destroy processing pipelines
      */
     onDeserialized(destroySignal: Subject<void>) {
         this.destroySignal = destroySignal;
 
         // link (empty) segmentation data to action manager
         this.actionManager.data = this.trackingData;
         // reapply the actions of the action manager to recreate the segmentation data
         this.actionManager.reapplyActions(this.trackingData);
     }
 
     /**
      * Add an action to the global segmentation model
      * @param action to perform
      * @param toPerform if true the action is performed and stored in action manager, if false the action is only stored in action manager
      */
     addAction(action: Action<TrackingData>, toPerform = true) {
         this.actionManager.addAction(action, toPerform);
     }
 
     get canUndo() {
         return this.actionManager.canUndo;
     }
 
     get canRedo() {
         return this.actionManager.canRedo;
     }
 
     /**
      * Redo the last action
      */
     redo() {
         this.actionManager.redo();
     }
 
     /**
      * Undo the last action
      */
     undo() {
         this.actionManager.undo();
     }  
 }

 /** Containing all information for a tracking (including segmentation information) */
 @Serializable()
 export class SimpleTracking {
    /** Segmentation data */
    @JsonProperty()
    segmentation: Array<any>;

    /** Tracking data */
    @JsonProperty({type: Link})
    tracking: Array<Link>;
 }

 /**
 * Attaches to a normal {@link GlobalTrackingModel} instance and converts its state to the simple segmentation format.
 */
export class SimpleTrackingView
implements ChangableModel<SimpleTrackingView> {

    /** event when changes occur */
    modelChanged = new EventEmitter<ModelChanged<SimpleTrackingView>>();
    /** the base model */
    baseTracking: GlobalTrackingModel;
    baseSegmentation: GlobalSegmentationModel;

    /** the simplified tracking content */
    private _content: SimpleTracking;

    private dirty = true;

    /**
     * Create a simple tracking 
     * @param baseTracking the global segmentation model
     */
    constructor(baseTracking: GlobalTrackingModel, baseSegmentaiton: GlobalSegmentationModel) {
        this.baseTracking = baseTracking;
        this.baseSegmentation = baseSegmentaiton;
        this.baseTracking.modelChanged.subscribe((changedEvent: ModelChanged<GlobalTrackingModel>) => {
            if (changedEvent.changeType === ChangeType.HARD) {
                // update the models simple representation
                //this.update();
                this.dirty = true;
                this.modelChanged.emit(new ModelChanged<SimpleTrackingView>(this, ChangeType.HARD));
            }
        });

        // initially: no cache available
        this.dirty = true;
    }

    get content(): SimpleTracking {
        if (this.dirty) {
            this.update();
        }

        return this._content;
    }

    /**
     * Updates the simple segmentation representation
     */
    private update() {
        this._content = new SimpleTracking();

        // copy tracking links
        this._content.tracking = this.baseTracking.trackingData.links;
        // create empty segmentation
        this._content.segmentation = [];

        // iterate over models and collect simple segmentation
        for (const [frameId, segData] of this.baseSegmentation.segmentations.entries()) {
            // iterate over polygon segmentations
            for (const [uuid, poly] of segData.getPolygonEntries()) {
                if (poly.points.length === 0) {
                    // we don't need empty segmentations
                    continue;
                }
                // add polygon with additional information to the results
                this._content.segmentation.push({label: this.baseSegmentation.segmentationModels[frameId].getPolygonLabel(uuid).name, contour: poly.points, id: uuid, frame: frameId});
            }
        }

        // simple view is fresh
        this.dirty = false;
    }

}