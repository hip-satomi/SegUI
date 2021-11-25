/**
 * This file holds implementations of storing and loading data (e.g. segmentation or tracking) in remote locations (e.g. OMERO).
 */

import { OmeroAPIService } from './../services/omero-api.service';
import { deserialize, serialize } from 'typescript-json-serializer';
import { EventEmitter } from '@angular/core';
import { ModelChanged, ChangeType } from './change';
import { debounceTime, filter, map, tap, switchMap, catchError } from 'rxjs/operators';
import { GUISegmentation, GUITracking, SimpleSegmentationREST } from './../services/seg-rest.service';
import { SegRestService } from 'src/app/services/seg-rest.service';
import { SegmentationModel, SegmentationHolder, SimpleSegmentationHolder, GlobalSegmentationModel } from './segmentation-model';
import { Observable, of, zip, empty, Subject } from 'rxjs';
import { StorageConnector } from './storage';



/**
 * Stores segmentation for every frame in an Omero File Attachment for the specific image sequence
 */
export class GlobalSegmentationOMEROStorageConnector extends StorageConnector<GlobalSegmentationModel> {

    /** Image Sequence id */
    imageSetId: number;
    /** omero api */
    omeroAPI: OmeroAPIService;
    updateEvent: EventEmitter<GlobalSegmentationOMEROStorageConnector> = new EventEmitter();

    /**
     * Creates the segmentation holder from an existing json entry in db
     * @param imageSetId the omero image sequence id
     * @param segService segmentation service
     * @param segmentation the segmentation file as a json string
     */
    public static createFromExisting(omeroAPI: OmeroAPIService, segmentation: any, imageSetId: number, destroySignal: Subject<void>): GlobalSegmentationOMEROStorageConnector {
        const model = deserialize<GlobalSegmentationModel>(segmentation, GlobalSegmentationModel);

        if(model.formatVersion != GlobalSegmentationModel.currentFormatVersion) {
            throw new Error("Segmentation format incompatability!");
        }

        // TODO: this should be implemented into the serializer
        model.onDeserialized(destroySignal);

        // create the omero storage connector and bind it to the model
        const srsc = new GlobalSegmentationOMEROStorageConnector(omeroAPI, model, imageSetId);

        return srsc;
    }

    /**
     * Creates a new segmentation holder
     * @param omeroAPI segmentation REST SErvice
     * @param imageSetId the image set id
     * @param imageUrls the image urls
     */
    public static createNew(omeroAPI: OmeroAPIService, imageSetId: number, imageUrls: string[], destroySingal: Subject<void>) {
        // new holder
        const holder = new GlobalSegmentationModel(destroySingal, imageUrls.length);

        // create the omero storage connector and bind it to the model
        const srsc = new GlobalSegmentationOMEROStorageConnector(omeroAPI, holder, imageSetId);

        return srsc;
    }


    /**
     * Binds the storage connector to a model instance
     * @param model segmentation model
     * @param imageId optional image id (the image id can only be missing if we are using an existing REST record)
     */
    constructor(omeroAPI: OmeroAPIService,
                holder: GlobalSegmentationModel, imageId?: number) {
        super(holder);

        this.omeroAPI = omeroAPI;
        this.imageSetId = imageId;


        if (this.imageSetId === undefined) {
            throw new Error('[SegmentationOMEROStorageConnector] imageSetId has to be defined!');
        }

        // register with the on change event
        this.model.modelChanged.pipe(
            filter((changeEvent: ModelChanged<GlobalSegmentationModel>) => {
                return changeEvent.changeType === ChangeType.HARD;
            }),
            debounceTime(5000),
            switchMap((changeEvent: ModelChanged<GlobalSegmentationModel>) => {
                return this.update().pipe(
                    catchError((err) => {
                        console.error('Failed updating GUI segmentation REST model;');
                        this.omeroAPI.userQuestionService.showError("Failed updating the segmentation backend!");
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

/**
 * Connects the simple segmentation holder to an OMERO attachment and stores any HARD change of the segmentation models.
 * 
 * Synchronizes with the GUI {@link SegmentationOMEROStorageConnector} such that simple segmentation is always in sync with GUI Segmentation.
 */
export class SimpleSegmentationOMEROStorageConnector extends StorageConnector<SimpleSegmentationHolder> {

    omeroAPI: OmeroAPIService;
    restRecord: SimpleSegmentationREST;
    parentOMERO: GlobalSegmentationOMEROStorageConnector;

    updateEvent: EventEmitter<SimpleSegmentationOMEROStorageConnector> = new EventEmitter();

    /**
     * Attaches the storage connector to a model instance
     * @param model segmentation model
     * @param imageId optional image id (the image id can only be missing if we are using an existing REST record)
     */
    constructor(omeroAPI: OmeroAPIService,
                model: SimpleSegmentationHolder,
                parentOMERO: GlobalSegmentationOMEROStorageConnector) {
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
     * Update the object representation in omero via the REST API
     */
    public update() {
        const data: string = JSON.stringify(this.model.content);
        return this.omeroAPI.updateFile(this.parentOMERO.imageSetId, 'simpleSegmentation.json', data);
    }
}