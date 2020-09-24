import { jsonArrayMember, jsonMember, jsonObject } from 'typedjson';

@jsonObject
export class SelectedSegment {
    @jsonMember
    frame: number;
    @jsonMember
    polygonIndex: number;

    constructor(frame: number, polyonIndex: number) {
        this.frame = frame;
        this.polygonIndex = polyonIndex;
    }
}

@jsonObject
export class TrackingLink {
    @jsonMember
    source: SelectedSegment;

    @jsonArrayMember(SelectedSegment)
    targets: SelectedSegment[];

    constructor(source: SelectedSegment, targets: SelectedSegment[]) {
        this.source = source;
        this.targets = targets;
    }
}


export class TrackingData {
    selectedSegments: SelectedSegment[] = [];

    trackingLinks: TrackingLink[] = [];
}
