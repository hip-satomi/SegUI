import { jsonArrayMember, jsonMember, jsonObject } from 'typedjson';

@jsonObject
export class SelectedSegment {
    @jsonMember
    polygonId: string;

    constructor(polyonId: string) {
        this.polygonId = polyonId;
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
