import { ActionSheetController } from '@ionic/angular';
import { Polygon } from 'src/app/models/geometry';
import { UIInteraction, Drawer, Pencil } from './drawing';
import { ChangeLabelActivityAction, JointAction, MovePointAction, RemovePolygon, SelectPolygon } from './action';
import { UIUtils, Utils } from './utils';
import { LocalSegmentationModel} from './segmentation-model';
import { from, Observable, of, pipe, ReplaySubject, throwError } from 'rxjs';
import { catchError, delay, map, retryWhen, share, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { UserQuestionsService } from '../services/user-questions.service';


/**
 * Class for visualizing single-frame segmentation
 */
export class SegmentationUI implements UIInteraction, Drawer {

    /** the frame segmentation model */
    segModel: LocalSegmentationModel;
    // drawing variables
    canvasElement;
    ctx;

    distanceThreshold: number = 25;
    draggingPointIndex = -1;
    /** Url of the underlying image */
    imageUrl: string;
    /** true when image has been successfuly loaded  */
    imageLoaded: boolean = false;
    /** true when image is currently loading */
    imageIsLoading = false;
    /** the html image */
    image = null;

    image$: Observable<any>;

    image_loading$;

    /** enables single polygon point editing mode: individual points can be moved. Is disabled by default in favor of the brush tool */
    singlePolygonPointEditing = false;

    /**
     * Create a new segmentation visualizer
     * @param segModel the frame segmentation model
     * @param imageUrl the url for the frame image
     * @param canvasElement native canvas element for rendering
     */
    constructor(segModel: LocalSegmentationModel,
                imageUrl: string, canvasElement,
                private actionSheetController: ActionSheetController,
                private userQuestions: UserQuestionsService) {
        this.segModel = segModel;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.imageUrl = imageUrl;

        this.image$ = this.loadImage();
    }

    get imageHeight() {
        return this.image?.height;
    }

    get imageWidth() {
        return this.image?.width;
    }

    /**
     * Loads the image. Promise resolves when the image is fully loaded.
     * Promise rejects when the timeout finishes first!
     */
    loadImage(timeout = 10000, numRetries=5): Observable<any> {
        return of(1).pipe(
            switchMap(() => {
                if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
                    // image is already loaded
                    return of(this.image);
                }

                if (!this.image || !this.imageIsLoading) {
                    // image loading has not started or failed
                    this.image = new Image();
        
                    // catch when the image comes in
                    this.image_loading$ = of(1).pipe(
                        tap(() => {
                            // start loading the image by giving it a url
                            this.image.src = this.imageUrl;
                            this.imageIsLoading = true;
                        }),
                        switchMap(() => {
                            return from(new Promise((resolve, reject) => {
                                // reject the image request when running out of time
                                const timer = setTimeout(() => {
                                    reject();
                                    console.error(`Timeout loading image! ${this.imageUrl}`);
                                }, timeout);
                
                                this.image.onload = () => {
                                    this.imageIsLoading = false;
                                    this.imageLoaded = true;
                    
                                    console.log('Image truly loaded!');
                                    
                                    clearTimeout(timer);
                                    // successfuly loaded!
                                    resolve(this.image);
                                };
                                this.image.onerror = () => {
                                    this.imageIsLoading = false;
                                    clearTimeout(timer);
                                    reject();
                                }
                            })).pipe(
                                take(1),
                            );
                        }),
                        retryWhen(errors => errors.pipe(delay(1000), take(numRetries))),
                        catchError(e => {
                            this.imageIsLoading = false;
                            this.imageLoaded = false;

                            return throwError(e);
                        }),
                        shareReplay()
                    );

                    return this.image_loading$;
               }

               else if(this.imageIsLoading)  {
                   return this.image_loading$;
               }
            })
        );
    }

    onPointerDown(event: any): boolean {
        return false;
    }
    onPointerMove(event: any): boolean {
        return false;
    }
    onPointerUp(event: any): boolean {
        return false;
    }

    onTap(event) {
        console.log("onTap");
        const e = event;

        e.preventDefault();

        const poly = this.segModel.activePolygon;
        const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        const x = mousePos.x;
        const y = mousePos.y;
        let lineInsert = false;

        if (poly) {
            let insertAt = poly.numPoints;

            // compute closest distance to line (in case of inserting a point in between)
            const di = poly.distanceToOuterShape([x, y]);
            if (di.index !== -1 && di.distance < this.distanceThreshold) {
                insertAt = di.index;
                lineInsert = true;
            }

            /*if (lineInsert) {
                // place at correct place (maybe close to line --> directly on the line)
                const act = new AddPointAction([x, y], insertAt, this.segmentationModel.activePolygonId);
                this.segmentationModel.addAction(act);

                //this.segmentationModel.activePointIndex = insertAt;
                return true;
            }*/
            lineInsert = false;
        }

        if (!lineInsert) {
            // check whether you did click onto another polygon
            for (const [index, polygon] of this.segModel.getVisiblePolygons()) {
                if (index === this.segModel.activePolygonId) {
                    continue;
                }
                if (polygon.isInside([x, y])) {
                    // clicke inside a non active polygon
                    this.segModel.addAction(new SelectPolygon(index));

                    if(!this.segModel.activeLabels.map(l => l.id).includes(this.segModel.getPolygonLabelId(index))) {
                        // activate the label if necessary
                        this.segModel.parent.addAction(new ChangeLabelActivityAction(this.segModel.getPolygonLabelId(index), true));
                    }
                    //this.segModel.activePolygonId = index;
                    return true;
                }
            }

        }

        return false;
    }

    /**
     * Handle on press action: shows an action sheet
     * @param event 
     * @returns 
     */
    onPress(event): boolean {
        event.preventDefault();
        let match: [string, Polygon] = null;
        const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        for (const [id, polygon] of this.segModel.segmentationData.getPolygonEntries()) {
            if (polygon.isInside([mousePos.x, mousePos.y])) {
                match = [id, polygon];
                break;
            }
        }

        if (match) {
            // match contains [uuid, Polygon] of the selected polygon

            // select the polygon
            this.segModel.addAction(new SelectPolygon(match[0]));

            // show action opportunities
            const actionSheet = this.actionSheetController.create({
                header: 'Cell Actions',
                buttons: [{
                  text: 'Delete',
                  role: 'destructive',
                  icon: 'trash',
                  handler: () => {
                    // create an action to remove the polygon
                    const removeAction = new RemovePolygon(match[0]);
                    // execute the remove action
                    this.segModel.addAction(removeAction);
                  }
                }, {
                  text: 'Cancel',
                  icon: 'close',
                  role: 'cancel',
                  handler: () => {
                    console.log('Cancel clicked');
                  }
                }]
              });
            actionSheet.then(as => as.present());
        }

        return true;
    }

    /**
     * Decides whether to go into dragging mode
     * @param event 
     * @returns 
     */
     onPanStart(event): boolean {
        if (this.singlePolygonPointEditing) {
            console.log('pan start');

            const poly = this.segModel.activePolygon;
            if(poly == null) {
                // TODO add a polygon here
                return false;
            }
            // check whether we will drag something
            const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
            const x = mousePos.x;
            const y = mousePos.y;


            // compute closest distance to the polygon (in case of dragging a point)
            const distanceInfo = poly.closestPointDistanceInfo([x, y]);
            const minDis = distanceInfo.distance;
            const minDisIndex = distanceInfo.index;
            if (minDis < 50 && minDisIndex >= 0) {
                // activate dragging by setting the point index
                this.draggingPointIndex = minDisIndex;

                this.segModel.activePointIndex = minDisIndex;
            }
            return true;
        }
        return false;
    }

    /**
     * Handles panning start, e.g. dragging an individual polygon point
     * @param event 
     * @returns 
     */
     onPan(event): boolean {
        if (this.singlePolygonPointEditing) {
            if(this.segModel.activePolygonId == null) {
                return false;
            }
            if (this.draggingPointIndex !== -1) {
                console.log("drag");

                const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

                const polygon = this.segModel.activePolygon;
                // change the point temporarily
                polygon.points[this.segModel.activePointIndex] = [mousePos.x, mousePos.y];

                return true;
            }
        }

        return false;
    }

    onPanEnd(event): boolean {
        if (this.singlePolygonPointEditing) {
            if(this.segModel.activePolygonId == null) {
                return false;
            }

            console.log('pan end');

            if (this.draggingPointIndex !== -1) {
                this.draggingPointIndex = -1;

                // record final drag position
                const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

                const polygon = this.segModel.activePolygon;
                this.segModel.addAction(new MovePointAction([mousePos.x, mousePos.y],
                                                    this.segModel.activePointIndex,
                                                    this.segModel.activePolygonId));

                return true;
            }
        }
        return false;
    }

    onMove(event): boolean {
        // TODO: should show drag cursor
        return false;
    }

    delete() {
        if (this.segModel.activePolygon) {
            const removalId = this.segModel.activePolygonId;

            // TODO: Default label id ?
            const jointAction = 
                new JointAction(
                    //...this.segModel.addNewPolygonActions(0),
                    new RemovePolygon(removalId));

            this.segModel.addAction(jointAction);
        }
    }

    get canSave(): boolean {
        return this.segModel.activePolygon?.numPoints > 0;
    }

    save() {
        if (this.canSave) {
            // TODO: Default label id?
            this.userQuestions.activeLabel(this.segModel).pipe(
                tap(label => this.segModel.addNewPolygon(label.id))
            ).subscribe();
        }
    }

    /**
     * Prepare resources for drawing, i.e. loading image
     */
    prepareDraw(): Observable<Drawer> {
        return this.loadImage().pipe(
            switchMap(() => of(this))
        );
    }

    /**
     * Draws both image + segmentation to the canvas
     * 
     * @param ctx canvas context
     */
    draw(pencil: Pencil) {
        pencil.clear();

        const ctx = pencil.canvasCtx;
        //this.drawPolygons(ctx);
        this.drawPolygonsAdv(ctx, true,
            // filter only polygons with visible label
            (p: [string, Polygon]) => {
                return this.segModel.labels[this.segModel.segmentationData.getPolygonLabel(p[0])].visible
            },
            ({uuid, poly}) => {
                const label = this.segModel.labels[this.segModel.segmentationData.getPolygonLabel(uuid)]
                const mode = label.color;

                if (mode == 'random') {
                    return poly.color;
                } else {
                    return label.color;
                }
            }

        );
        this.drawImage(ctx);
    }

    /**
     * Draws the polygons of the segmentation data
     * @param ctx the target canvas context
     * @param markActive iff true marks the currently active polygon
     * @param polyFilter a filter function to draw only specific polygons
     */
    drawPolygons(ctx, markActive = true, polyFilter: (p: [string, Polygon]) => boolean = p => true) {
        for (const [index, polygon] of Array.from(this.segModel.segmentationData.getPolygonEntries()).filter(polyFilter)) {
            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.segModel.activePolygonId, ctx, polygon.getColor());
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, polygon.getColor());
            }
        }
    }

    drawPolygonsAdv(ctx, markActive = true, polyFilter: (p: [string, Polygon]) => boolean = p => true, polyColor: ({uuid: string, poly: Polygon}) => string = ({uuid, poly}) => poly.getColor()) {
        for (const [index, polygon] of Array.from(this.segModel.segmentationData.getPolygonEntries()).filter(polyFilter)) {
            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.segModel.activePolygonId, ctx, polyColor({uuid: index, poly: polygon}));
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, polyColor({uuid: index, poly: polygon}));
            }
        }
    }

    drawAdvanced(ctx, colorGenerator: (polygon: Polygon) => string = (poly: Polygon) => poly.getColor()) {
        const markActive = false;

        for (const [index, polygon] of this.segModel.segmentationData.getPolygonEntries()) {
            if (polygon.numPoints === 0) {
                continue;
            }

            if (markActive) {
                UIUtils.drawSingle(polygon.points, index === this.segModel.activePolygonId, ctx, colorGenerator(polygon));
            } else {
                UIUtils.drawSingle(polygon.points, false, ctx, colorGenerator(polygon));
            }
            //UIUtils.drawCircle(ctx, polygon.center, 4, '#00FF00');
        }
        //ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
    }

    /**
     * Draws the image onto the canvas context
     * 
     * If the image is not yet loaded. It starts loading the image and delays the drawing.
     * @param ctx canvas context
     */
    drawImage(ctx) {
        this.loadImage().subscribe(
            () => {
                // image has been loaded and can be drawn now
                // do not allow interpolation on the image
                ctx.webkitImageSmoothingEnabled = false;
                ctx.mozImageSmoothingEnabled = false;
                ctx.msImageSmoothingEnabled = false;
                ctx.imageSmoothingEnabled = false;

                //console.log('Drawing image');
                

                // draw image
                ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
            },
            () => {console.log('Error while loading image');}
        )
    }
}
