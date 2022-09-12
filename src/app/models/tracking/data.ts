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
    links: Array<Link> = [];

    outgoingLinks = new Map<string, Array<Link>>();
    incomingLinks = new Map<string, Array<Link>>();

    // array of forced track ends containing id of final items
    forcedTrackEnds: Set<string> = new Set<string>();

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

            // add outgoing and incoming links
            this.outgoingLinks[link.sourceId] = [...(this.outgoingLinks.get(link.sourceId) || []), link];
            this.incomingLinks[link.targetId] = [...(this.incomingLinks.get(link.targetId) || []), link]

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

            // remove outgoing and incoming links
            this.outgoingLinks[link.sourceId] = this.outgoingLinks[link.sourceId].filter((link: Link) => link.targetId != link.targetId);
            this.incomingLinks[link.targetId] = this.incomingLinks[link.targetId].filter((link: Link) => link.sourceId != link.sourceId);

            const index = this.links.indexOf(link);
            this.links.splice(index, 1);
        }
    }

    /**
     * 
     * @param targetId id of the targeted segmentation object
     * @returns list of links targeting the segmentation object
     */
    listTo(targetId: string): Array<Link> {
        return (this.incomingLinks[targetId] || []);
    }

    /**
     * 
     * @param sourceId originating segmentation object
     * @returns list of links originating from the segmentation object
     */
    listFrom(sourceId: string): Array<Link> {
        return (this.outgoingLinks[sourceId] || []);
    }
}
