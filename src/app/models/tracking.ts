import { SynchronizedObject } from './storage';
import { TrackingData, SelectedSegment } from './tracking-data';
import { jsonMember, jsonObject } from 'typedjson';
import { ActionManager, AddLinkAction, SelectSegmentAction, UnselectSegmentAction } from './action';
import { EventEmitter } from '@angular/core';
import { ModelChanged } from './segmentation-model';

export enum ChangeType {
    SOFT,
    HARD
}

export class TrackingChangedEvent {
    trackingModel: TrackingModel;
    changeType: ChangeType;

    constructor(trackingModel: TrackingModel, changeType = ChangeType.HARD) {
        this.trackingModel = trackingModel;
        this.changeType = changeType;
    }
}

@jsonObject({onDeserialized: 'onDeserialized'})
export class TrackingModel extends SynchronizedObject<TrackingModel> {

    trackingData = new TrackingData();

    @jsonMember
    actionManager: ActionManager = new ActionManager(0.25);

    onModelChanged = new EventEmitter<ModelChanged<TrackingModel>>();

    constructor() {
        super();

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.onModelChanged.emit(new ModelChanged<TrackingModel>(this, ChangeType.HARD));
        });
    }

    onDeserialized() {
        this.actionManager.reapplyActions({trackingData: this.trackingData});

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.onModelChanged.emit(new ModelChanged<TrackingModel>(this, ChangeType.HARD));
        });
    }

    selectSegment(segmentSelection: SelectedSegment) {

        const existing = this.trackingData.selectedSegments.find((selSegment: SelectedSegment) => {
            return selSegment.polygonId === segmentSelection.polygonId;
        });
        if (existing) {
            // we found element in selected segments --> deselect it
            this.actionManager.addAction(
                new UnselectSegmentAction(segmentSelection, this.trackingData)
            );
        } else {
            // there is no such selection --> select it
            this.actionManager.addAction(
                new SelectSegmentAction(segmentSelection,
                this.trackingData));
        }
    }

    /*addLink() {
        // TODO look for conflicts with other links!!!
        this.actionManager.addAction(new AddLinkAction(this.trackingData));
    }*/
}
