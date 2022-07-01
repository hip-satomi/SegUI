import { JsonProperty, Serializable } from "typescript-json-serializer";
import { ClearableStorage } from "../action";

@Serializable()
export class Link {
    @JsonProperty() sourceId: string;
    @JsonProperty() targetId: string;

    constructor(sourceId: string, targetId: string) {
        this.sourceId = sourceId;
        this.targetId = targetId;
    }
}


/**
 * Tracking data for a specific segmentation
 */
export class TrackingData implements ClearableStorage {

    // array of linkings (all information for the tracking)
    links: Array<Link>;

    constructor() {
        this.clear();
    }

    /**
     * Reset the tracking data
     */
    clear() {
        this.links = [];
    }

    /**
     * 
     * @param link 
     * @returns true when the link is already in the data
     */
    hasLink(link: Link): boolean {
        return this.links.filter(l => l.sourceId == link.sourceId && l.targetId == link.targetId).length >= 1
    }

    /**
     * Add the link to the model if it is not yet
     * @param link link to add
     */
    addLink(link: Link): void {
        // do we already have the same link?
        if(!this.hasLink(link)) {
            this.links.push(link);
        }
    }

    /**
     * Remove links with these sources and targets
     * @param link 
     */
    removeLink(link: Link): void {
        // find all links with the same source and target
        const links = this.links.filter(l => l.sourceId == link.sourceId && l.targetId == link.targetId);
        // delete all the candidates
        for (const link of links) {
            const index = this.links.indexOf(link);
            delete this.links[index];
        }
    }

    /**
     * 
     * @param targetId id of the targeted segmentation object
     * @returns list of links targeting the segmentation object
     */
    listTo(targetId: string): Array<Link> {
        return this.links.filter(l => l.targetId == targetId);
    }

    /**
     * 
     * @param sourceId originating segmentation object
     * @returns list of links originating from the segmentation object
     */
    listFrom(sourceId: string): Array<Link> {
        return this.links.filter(l => l.sourceId == sourceId);
    }

}
