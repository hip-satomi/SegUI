import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';
import { EventEmitter } from '@angular/core';
import { ModelChanged, ChangeType } from './change';
import { concatMap, debounceTime, filter, map, tap, switchMap } from 'rxjs/operators';
import { GUISegmentation, GUITracking, SimpleSegmentation } from './../services/seg-rest.service';
import { SegRestService } from 'src/app/services/seg-rest.service';
import { SegmentationModel, SegmentationHolder, DerivedSegmentationHolder } from './segmentation-model';
import { TrackingModel } from './tracking';
import { Observable, of, combineLatest, zip } from 'rxjs';
import { StorageConnector } from './storage';


/**
 * 
 */
export class SegmentationRESTStorageConnector extends StorageConnector<SegmentationHolder> {

    imageSetId: number;
    restService: SegRestService;
    restRecord: GUISegmentation;
    updateEvent: EventEmitter<SegmentationRESTStorageConnector> = new EventEmitter();

    /**
     * Creates the segmentation holder from an existing json entry in db
     * @param segService segmentation service
     * @param segmentation the segmentation REST entry
     */
    public static createFromExisting(segService: SegRestService, segmentation: GUISegmentation): SegmentationRESTStorageConnector {
        const model = deserialize<SegmentationHolder>(JSON.parse(segmentation.json), SegmentationHolder);

        for (const segModel of model.segmentations) {
            segModel.onDeserialized();
        }

        // TODO: this should be implemented into the serializer
        model.onDeserialized();

        const srsc = new SegmentationRESTStorageConnector(segService, model, null, segmentation);

        return srsc;
    }

    /**
     * Creates a new segmentation holder
     * @param segService segmentation REST SErvice
     * @param imageSetId the image set id
     * @param imageUrls the image urls
     */
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

        const serializedData = serialize(this.model);

        const segModelJSON: string = JSON.stringify(serializedData);

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
        const segModelJSON: string = JSON.stringify(serialize(this.model));

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
        let result: Observable<GUISegmentation>;
        if (this.restRecord) {
            result = this.put();
        } else {
            result = this.post();
        }

        // also integrate update events into the pipeline
        result = result.pipe(
            tap((x: GUISegmentation) => this.updateEvent.emit(this)),
        );

        return result;
    }
}

export class DerivedSegmentationRESTStorageConnector extends StorageConnector<DerivedSegmentationHolder> {

    restService: SegRestService;
    restRecord: SimpleSegmentation;
    parentREST: SegmentationRESTStorageConnector;

    updateEvent: EventEmitter<DerivedSegmentationRESTStorageConnector> = new EventEmitter();

    /**
     * Attaches the storage connector to a model instance
     * @param model segmentation model
     * @param imageId optional image id (the image id can only be missing if we are using an existing REST record)
     */
    constructor(restService: SegRestService,
                model: DerivedSegmentationHolder,
                parentREST: SegmentationRESTStorageConnector) {
        super(model);

        this.restService = restService;
        this.parentREST = parentREST;

        // listen to parent rest events
        // zip operator combines both observables --> i.e. waits for rest update and model update
        zip(parentREST.updateEvent.pipe(
                filter((x: SegmentationRESTStorageConnector) => x.restRecord !== null)
            ),
            model.modelChanged)
        .pipe(
            map((data: [SegmentationRESTStorageConnector, ModelChanged<DerivedSegmentationHolder>]) => data[0])
        ).subscribe((restConnector: SegmentationRESTStorageConnector) => {
            this.update().subscribe(
                s => console.log('Updated SimpleSegmentation backend!')
            );
        });
    }

    /**
     * Posts a new object into the rest api
     */
    private post(parentGUISegId: number): Observable<SimpleSegmentation> {
        const simpleSeg: SimpleSegmentation = {
            id: -1,
            json: JSON.stringify(this.model.content),
            segmentation: this.restService.getSegmentationUrl(parentGUISegId)
        };

        return this.restService.postSimpleSegmentation(simpleSeg).pipe(
            tap(s => {console.log('Posted simple segmentation'); })
        );
    }

    /**
     * Updates an existing object via the rest api
     */
    private put(): Observable<SimpleSegmentation> {
        this.restRecord.json = JSON.stringify(this.model.content);

        return this.restService.putSimpleSegmentation(this.restRecord).pipe(
            tap(s => {console.log('Put simple segmentation'); })
        );
    }

    /**
     * Update the object representation in the rest api
     */
    public update(): Observable<SimpleSegmentation> {
        let startingPipe: Observable<SimpleSegmentation>;
        if (this.restRecord) {
            startingPipe = of(this.restRecord);
        } else {
            startingPipe = this.restService.getSimpleSegFromGUISegmentationId(this.parentREST.restRecord.id).pipe(
                tap((ss: SimpleSegmentation) => this.restRecord = ss)
            );
        }

        return startingPipe.pipe(
            switchMap((simpleSeg: SimpleSegmentation) => {
                if (simpleSeg) {
                    return this.put();
                } else {
                    return this.post(this.parentREST.restRecord.id);
                }
            }),
            tap((s: SimpleSegmentation) => {
                this.restRecord = s;
                this.updateEvent.emit(this);
            })
        );
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
        try {
            const trackingModel: TrackingModel = deserialize<TrackingModel>(JSON.parse(guiTracking.json), TrackingModel);

            trackingModel.onDeserialized();

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
        const trackModelJSON: string = JSON.stringify(serialize(this.model));

        this.restRecord.json = trackModelJSON;

        return this.restService.putTracking(this.restRecord).pipe(
            tap(r => this.restRecord = r)
        );
    }

    private post(): Observable<GUITracking> {
        const trackModelJSON = JSON.stringify(serialize(this.model));

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