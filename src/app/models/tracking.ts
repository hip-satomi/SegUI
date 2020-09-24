import { TrackingData, SelectedSegment } from './tracking-data';
import { jsonMember, jsonObject } from 'typedjson';
import { ActionManager, AddLinkAction, SelectSegmentAction, UnselectSegmentAction } from './action';
import { EventEmitter } from '@angular/core';
import { Action } from 'rxjs/internal/scheduler/Action';

@jsonObject({onDeserialized: 'onDeserialized'})
export class TrackingModel {

    trackingData = new TrackingData();

    @jsonMember
    actionManager: ActionManager = new ActionManager(0.25);

    onModelChanged = new EventEmitter<TrackingModel>();

    constructor() {
        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.onModelChanged.emit();
        });
    }

    onDeserialized() {
        this.actionManager.reapplyActions({'trackingData': this.trackingData});

        this.actionManager.onDataChanged.subscribe((actionManager: ActionManager) => {
            this.onModelChanged.emit();
        });
    }

    selectSegment(segmentSelection: SelectedSegment) {

        const existing = this.trackingData.selectedSegments.find((selSegment: SelectedSegment) => {
            return selSegment.frame === segmentSelection.frame && selSegment.polygonIndex === segmentSelection.polygonIndex;
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

    addLink() {
        // TODO look for conflicts with other links!!!
        this.actionManager.addAction(new AddLinkAction(this.trackingData));
    }
}
