import { ActionSheetController } from '@ionic/angular';
import { Polygon } from 'src/app/models/geometry';
import { UIInteraction, Drawer, Pencil } from './drawing';
import { AddPointAction, JointAction, MovePointAction, RemovePolygon, SelectPolygon } from './action';
import { Utils } from './utils';
import { SegmentationModel } from './segmentation-model';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
export class SegmentationUI implements UIInteraction, Drawer {

    segmentationModel: SegmentationModel;
    canvasElement;
    ctx;
    distanceThreshold: number = 25;
    draggingPointIndex = -1;
    imageUrl: string;
    imageLoaded: boolean;
    imageIsLoading = false;
    image = null;

    /**
     * 
     * @param segmentationModel 
     * @param canvasElement native canvas element
     */
    constructor(segmentationModel: SegmentationModel,
                imageUrl: string, canvasElement,
                private actionSheetController: ActionSheetController) {
        this.segmentationModel = segmentationModel;
        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.imageUrl = imageUrl;
    }

    get imageHeight() {
        return this.image.height;
    }

    get imageWidth() {
        return this.image.width;
    }

    /**
     * Loads the image. Promise resolves when the image is fully loaded.
     * Promise rejects when the timeout finishes first!
     */
    loadImage(timeout = 10000): Observable<any> {
        if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
            // image is already loaded
            return of(this.image);
        }

        if (!this.image || !this.imageIsLoading) {
            // image loading not started or failed
            this.image = new Image();

            // start loading the image by giving it a url
            this.image.src = this.imageUrl;
            this.imageIsLoading = true;
        }

        return from(new Promise((resolve, reject) => {
            this.image.onload = () => {
                this.imageIsLoading = false;
                this.imageLoaded = true;

                console.log('Image truly loaded!');
                
    
                resolve(this.image);
            };
            this.image.onerror = () => {
                this.imageIsLoading = false;
                reject();
            }

            // reject the image request when running out of time
            setTimeout(() => {
                reject();
                console.error("Timeout loading image!");
            }, timeout);

        }));
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

        const poly = this.segmentationModel.activePolygon;
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
            for (const [index, polygon] of this.segmentationModel.segmentationData.getPolygonEntries()) {
                if (index === this.segmentationModel.activePolygonId) {
                    continue;
                }
                if (polygon.isInside([x, y])) {
                    // clicke inside a non active polygon
                    this.segmentationModel.activePolygonId = index;
                    return true;
                }
            }

        }

        return false;
    }

    onPress(event): boolean {
        event.preventDefault();
        let match: [string, Polygon] = null;
        const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);
        for (const [id, polygon] of this.segmentationModel.segmentationData.getPolygonEntries()) {
            if (polygon.isInside([mousePos.x, mousePos.y])) {
                match = [id, polygon];
                break;
            }
        }

        if (match) {
            // match contains [uuid, Polygon] of the selected polygon

            // select the polygon
            this.segmentationModel.addAction(new SelectPolygon(match[0],
                                                               this.segmentationModel.activePolygonId));

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
                    // add another polygon for safety
                    this.segmentationModel.addNewPolygon();
                    // execute the remove action
                    this.segmentationModel.addAction(removeAction);
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

    onPanStart(event): boolean {
        console.log('pan start');

        const poly = this.segmentationModel.activePolygon;
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

            this.segmentationModel.activePointIndex = minDisIndex;
        }
        return true;
    }

    onPan(event): boolean {
        if (this.draggingPointIndex !== -1) {
            console.log("drag");

            const mousePos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

            const polygon = this.segmentationModel.activePolygon;
            this.segmentationModel.addAction(new MovePointAction([mousePos.x, mousePos.y],
                                                this.segmentationModel.activePointIndex,
                                                this.segmentationModel.activePolygonId));

            return true;
        }

        return false;
    }

    onPanEnd(event): boolean {
        console.log('pan end');

        if (this.draggingPointIndex !== -1) {
            this.draggingPointIndex = -1;
            return true;
        }

        return false;
    }

    onMove(event): boolean {
        // TODO: should show drag cursor
        return false;
    }

    delete() {
        if (this.segmentationModel.activePolygon) {
            const removalId = this.segmentationModel.activePolygonId;

            // TODO: this action recording can be dangerous
            //this.segmentationModel.recordActions();
            const jointAction = 
                new JointAction(
                    ...this.segmentationModel.addNewPolygonActions(),
                    new RemovePolygon(removalId));

            this.segmentationModel.addAction(jointAction);

            //this.segmentationModel.actionManager.mergeRecordedActions();
        }
    }

    get canSave(): boolean {
        return this.segmentationModel.activePolygon?.numPoints > 0;
    }

    save() {
        if (this.canSave) {
            this.segmentationModel.addNewPolygon();
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
        this.segmentationModel.draw(ctx);
        this.drawImage(ctx);
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

                console.log('Drawing image');
                

                // draw image
                ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
            },
            () => {console.log('Error while loading image');}
        )
    }
}
