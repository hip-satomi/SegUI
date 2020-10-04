import { ModelChanged, ChangeType } from './change';
import { concatMap, debounceTime, filter, map, tap } from 'rxjs/operators';
import { GUISegmentation, GUITracking } from './../services/seg-rest.service';
import { SegRestService } from 'src/app/services/seg-rest.service';
import { TypedJSON } from 'typedjson';
import { SegmentationModel, SegmentationHolder} from './segmentation-model';
import { TrackingModel } from './tracking';
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

export class TrackingRESTStorageConnector extends StorageConnector<TrackingModel> {

    srsc: SegmentationRESTStorageConnector;
    restRecord: GUITracking;
    restService: SegRestService;

    static createNew(restService: SegRestService, srsc: SegmentationRESTStorageConnector): TrackingRESTStorageConnector {
        return new TrackingRESTStorageConnector(restService, new TrackingModel(), srsc);
    }

    static createFromExisting(restService: SegRestService, srsc: SegmentationRESTStorageConnector, guiTracking: GUITracking) {
        const serializer = new TypedJSON(TrackingModel);

        try {
            const trackingModel = serializer.parse(guiTracking.json);

            return new TrackingRESTStorageConnector(restService, trackingModel, srsc, guiTracking);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    constructor(restService: SegRestService,
                trackingModel: TrackingModel,
                srsc: SegmentationRESTStorageConnector,
                restRecord?: GUITracking) {
        super(trackingModel);
        this.restService = restService;
        this.srsc = srsc;
        this.restRecord = restRecord;

        // register with the on change event
        this.model.onModelChanged.pipe(
            filter((changeEvent: ModelChanged<TrackingModel>) => {
                return changeEvent.changeType === ChangeType.HARD;
            }),
            debounceTime(5000),
            concatMap((changeEvent: ModelChanged<TrackingModel>) => {
                return this.update();
            })
        ).subscribe((val) => {
            console.log('Updated tracking REST model!');
        });
    }

    private put(): Observable<GUITracking> {
        const serializer = new TypedJSON(TrackingModel);
        const trackModelJSON = serializer.stringify(this.model);

        this.restRecord.json = trackModelJSON;

        return this.restService.putTracking(this.restRecord).pipe(
            tap(r => this.restRecord = r)
        );
    }

    private post(): Observable<GUITracking> {
        const serializer = new TypedJSON(TrackingModel);
        const trackModelJSON = serializer.stringify(this.model);

        return this.restService.postTracking(this.restService.getSegmentationUrl(this.srsc.restRecord.id), trackModelJSON).pipe(
            tap(r => this.restRecord = r)
        );
    }

    public update(): Observable<GUITracking> {
        if (this.srsc.restRecord) {
            if (this.restRecord) {
                return this.put();
            } else {
                return this.post();
            }
        } else {
            return of(null);
        }
    }
}