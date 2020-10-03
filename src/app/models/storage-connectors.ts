import { concatMap, debounceTime, filter, map } from 'rxjs/operators';
import { GUISegmentation } from './../services/seg-rest.service';
import { SegRestService } from 'src/app/services/seg-rest.service';
import { TypedJSON } from 'typedjson';
import { SegmentationModel, SegmentationChangedEvent, SegmentationHolder, ModelChanged } from './segmentation-model';
import { ChangeType } from './tracking';
import { Observable, of } from 'rxjs';
import { StorageConnector } from './storage';


/**
 * 
 */
export class SegmentationRESTStorageConnector extends StorageConnector<SegmentationHolder> {

    imageSetId: number;
    restService: SegRestService;
    restRecord: GUISegmentation;

    public static createFromExisting(segService: SegRestService, segmentation: GUISegmentation): SegmentationRESTStorageConnector {
        const serializer = new TypedJSON(SegmentationHolder);
        const model = serializer.parse(segmentation.json);

        const srsc = new SegmentationRESTStorageConnector(segService, model, null, segmentation);

        return srsc;
    }

    public static createNew(segService: SegRestService, imageSetId: number, imageUrls: string[]) {
        const holder = new SegmentationHolder();

        for (const url of imageUrls) {
            holder.addSegmentation(new SegmentationModel(url));
        }

        const srsc = new SegmentationRESTStorageConnector(segService, holder, imageSetId, null);

        return srsc;
    }


    /**
     * Attaches the storage connector to a model instance
     * @param model segmentation model
     * @param imageId optional image id (the image id can only be missing if we are using an existing REST record)
     */
    constructor(restService: SegRestService,
                holder: SegmentationHolder, imageId?: number, restRecord?: GUISegmentation) {
        super(holder);

        this.restService = restService;
        this.imageSetId = imageId;
        this.restRecord = restRecord;


        if (this.imageSetId === undefined && this.restRecord === undefined) {
            throw new Error('[SegmentationRESTStorageConnector] Either image id or existing rest record have to be defined!');
        }

        // register with the on change event
        this.model.modelChanged.pipe(
            filter((changeEvent: ModelChanged<SegmentationModel>) => {
                return changeEvent.changeType === ChangeType.HARD;
            }),
            debounceTime(5000),
            concatMap((changeEvent: ModelChanged<SegmentationModel>) => {
                return this.update();
            })
        ).subscribe((val) => {
            console.log('Updated REST model!');
        });
    }

    /**
     * Posts a new object into the rest api
     */
    private post(): Observable<GUISegmentation> {
        const imageId = this.imageSetId;

        const serializer = new TypedJSON(SegmentationHolder);
        const segModelJSON = serializer.stringify(this.model);

        // post the segmentation model to the rest service
        return this.restService.postSegmentation(imageId, segModelJSON).pipe(
            map((guiSeg: GUISegmentation) => {
                this.restRecord = guiSeg;
                return this.restRecord;
            })
        );
    }

    /**
     * Updates an existing object via the rest api
     */
    private put(): Observable<GUISegmentation> {
        const serializer = new TypedJSON(SegmentationHolder);
        const segModelJSON = serializer.stringify(this.model);

        this.restRecord.json = segModelJSON;

        return this.restService.putSegmentation(this.restRecord).pipe(
            map((guiSeg: GUISegmentation) => {
                this.restRecord = guiSeg;
                return this.restRecord;
            })
        );
    }

    /**
     * Update the object representation in the rest api
     */
    public update(): Observable<GUISegmentation> {
        if (this.restRecord) {
            return this.put();
        } else {
            return this.post();
        }
    }
}
