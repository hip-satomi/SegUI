import { Serializable, JsonProperty } from 'typescript-json-serializer';
import { ClearableStorage } from './action';
@Serializable()
export class SelectedSegment {
    @JsonProperty()
    polygonId: string;

    constructor(polyonId: string) {
        this.polygonId = polyonId;
    }
}

@Serializable()
export class TrackingLink {
    @JsonProperty()
    source: SelectedSegment;

    @JsonProperty({type: SelectedSegment})
    targets: SelectedSegment[];

    constructor(source: SelectedSegment, targets: SelectedSegment[]) {
        this.source = source;
        this.targets = targets;
    }
}


export class TrackingData implements ClearableStorage {
    selectedSegments: SelectedSegment[] = [];

    trackingLinks: TrackingLink[] = [];

    clear() {
        this.selectedSegments = [];
        this.trackingLinks = [];
    }
}
