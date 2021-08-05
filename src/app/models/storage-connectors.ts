import { OmeroAPIService } from './../services/omero-api.service';
import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';
import { EventEmitter } from '@angular/core';
import { ModelChanged, ChangeType } from './change';
import { concatMap, debounceTime, filter, map, tap, switchMap, catchError } from 'rxjs/operators';
import { GUISegmentation, GUITracking, SimpleSegmentationREST } from './../services/seg-rest.service';
import { SegRestService } from 'src/app/services/seg-rest.service';
import { SegmentationModel, SegmentationHolder, DerivedSegmentationHolder } from './segmentation-model';
import { TrackingModel } from './tracking';
import { Observable, of, combineLatest, zip, empty } from 'rxjs';
import { StorageConnector } from './storage';



/**
 * Stores segmentation for every frame in an Omero File Attachment for the specific image sequence
 */
export class SegmentationOMEROStorageConnector extends StorageConnector<SegmentationHolder> {

    imageSetId: number;
    omeroAPI: OmeroAPIService;
    updateEvent: EventEmitter<SegmentationOMEROStorageConnector> = new EventEmitter();

    /**
     * Creates the segmentation holder from an existing json entry in db
     * @param segService segmentation service
     * @param segmentation the segmentation REST entry
     */
    public static createFromExisting(omeroAPI: OmeroAPIService, segmentation: any, imageSetId: number): SegmentationOMEROStorageConnector {
        const model = deserialize<SegmentationHolder>(segmentation, SegmentationHolder);

        // TODO: this should be implemented into the serializer
        model.onDeserialized();

        const srsc = new SegmentationOMEROStorageConnector(omeroAPI, model, imageSetId);

        return srsc;
    }

    /**
     * Creates a new segmentation holder
     * @param omeroAPI segmentation REST SErvice
     * @param imageSetId the image set id
     * @param imageUrls the image urls
     */
    public static createNew(omeroAPI: OmeroAPIService, imageSetId: number, imageUrls: string[]) {
        const holder = new SegmentationHolder();

        for (const url of imageUrls) {
            holder.addSegmentation(new SegmentationModel());
        }

        const srsc = new SegmentationOMEROStorageConnector(omeroAPI, holder, imageSetId);

        return srsc;
    }


    /**
     * Attaches the storage connector to a model instance
     * @param model segmentation model
     * @param imageId optional image id (the image id can only be missing if we are using an existing REST record)
     */
    constructor(omeroAPI: OmeroAPIService,
                holder: SegmentationHolder, imageId?: number) {
        super(holder);

        this.omeroAPI = omeroAPI;
        this.imageSetId = imageId;


        if (this.imageSetId === undefined) {
            throw new Error('[SegmentationOMEROStorageConnector] imageSetId has to be defined!');
        }

        // register with the on change event
        this.model.modelChanged.pipe(
            filter((changeEvent: ModelChanged<SegmentationModel>) => {
                return changeEvent.changeType === ChangeType.HARD;
            }),
            debounceTime(5000),
            switchMap((changeEvent: ModelChanged<SegmentationModel>) => {
                return this.update().pipe(
                    catchError((err) => {
                        console.error('Failed updating GUI segmentation REST model;');
                        console.error(err);
                        return empty();
                    })
                );
            }))
        .subscribe((val) => {
            console.log('Updated REST model!');
        }, err => { console.error(err); });
    }

    /**
     * Update the object representation in the rest api
     */
    public update(): Observable<any> {
        const segModelJSON: string = JSON.stringify(serialize(this.model));
        return this.omeroAPI.updateFile(this.imageSetId, 'GUISegmentation.json', segModelJSON).pipe(
            // notify the update
            tap(() => this.updateEvent.emit(this))
        );
    }
}

export class DerivedSegmentationOMEROStorageConnector extends StorageConnector<DerivedSegmentationHolder> {

    omeroAPI: OmeroAPIService;
    restRecord: SimpleSegmentationREST;
    parentOMERO: SegmentationOMEROStorageConnector;

    updateEvent: EventEmitter<DerivedSegmentationOMEROStorageConnector> = new EventEmitter();

    /**
     * Attaches the storage connector to a model instance
     * @param model segmentation model
     * @param imageId optional image id (the image id can only be missing if we are using an existing REST record)
     */
    constructor(omeroAPI: OmeroAPIService,
                model: DerivedSegmentationHolder,
                parentOMERO: SegmentationOMEROStorageConnector) {
        super(model);

        this.omeroAPI = omeroAPI;
        this.parentOMERO = parentOMERO;

        // listen to parent rest events
        // zip operator combines both observables --> i.e. waits for rest update and model update
        zip(parentOMERO.updateEvent, model.modelChanged)
        .pipe(
            // switch to backend update observable
            switchMap(() => {
                return this.update().pipe(
                    catchError((err) => {
                        console.error('Error while updating Simple segmentation backend!');
                        console.error(err);
                        return empty();
                    })
                );
            })
        ).subscribe(() => {
            console.log('Updated SimpleSegmentation backend!');
        });
    }

    /**
     * Update the object representation in the rest api
     */
    public update() {
        const data: string = JSON.stringify(this.model.content);
        return this.omeroAPI.updateFile(this.parentOMERO.imageSetId, 'simpleSegmentation.json', data);
    }
}

export class TrackingOMEROStorageConnector extends StorageConnector<TrackingModel> {

    srsc: SegmentationOMEROStorageConnector;
    restRecord: GUITracking;
    omeroApi: OmeroAPIService;

    static createNew(omeroAPI: OmeroAPIService, srsc: SegmentationOMEROStorageConnector): TrackingOMEROStorageConnector {
        return new TrackingOMEROStorageConnector(omeroAPI, new TrackingModel(), srsc);
    }

    static createFromExisting(omeroAPI: OmeroAPIService, srsc: SegmentationOMEROStorageConnector, guiTracking: any) {
        try {
            const trackingModel: TrackingModel = deserialize<TrackingModel>(guiTracking, TrackingModel);

            trackingModel.onDeserialized();

            return new TrackingOMEROStorageConnector(omeroAPI, trackingModel, srsc, guiTracking);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    constructor(omeroAPI: OmeroAPIService,
                trackingModel: TrackingModel,
                srsc: SegmentationOMEROStorageConnector,
                restRecord?: GUITracking) {
        super(trackingModel);
        this.omeroApi = omeroAPI;
        this.srsc = srsc;
        this.restRecord = restRecord;

        // register with the on change event
        this.model.onModelChanged.pipe(
            filter((changeEvent: ModelChanged<TrackingModel>) => {
                return changeEvent.changeType === ChangeType.HARD;
            }),
            debounceTime(5000),
            switchMap(() => {
                return this.update().pipe(
                    catchError((err) => {
                        console.error('Error while updating tracking REST backend!');
                        console.error(err);
                        return empty();
                    })
                );
            })
        ).subscribe((val) => {
            console.log('Updated tracking REST model!');
        });
    }

    public update() {
        // update the tracking file
        const trackModelJSON = JSON.stringify(serialize(this.model));
        return this.omeroApi.updateFile(this.srsc.imageSetId, 'GUITracking.json', trackModelJSON);
    }
}