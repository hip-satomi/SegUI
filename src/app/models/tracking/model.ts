import { Subject } from "rxjs";
import { map, takeUntil } from "rxjs/operators";
import { JsonProperty, Serializable } from "typescript-json-serializer";
import { Action, ActionManager } from "../action";
import { ChangableModel, ChangeType, ModelChanged } from "../change";
import { SynchronizedObject } from "../storage";
import { TrackingData } from "./data";

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