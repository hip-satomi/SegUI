import { ToastController } from '@ionic/angular';
import { SegmentationModel } from './segmentation-model';

import { UIInteraction, Drawer } from './drawing';
import { Utils, Position, UIUtils } from './utils';
import { Polygon } from './geometry';
import { TrackingChangedEvent, TrackingModel, ChangeType } from './tracking';
import { SelectedSegment, TrackingLink } from './tracking-data';

export class TrackingUI implements UIInteraction, Drawer {

    segmentationModels: SegmentationModel[];
    trackingModel: TrackingModel;
    currentFrame: number;
    canvasElement;
    ctx;
    toastController;
    hoverPoly: Polygon;

    temporarySelection: SelectedSegment;
    selections: SelectedSegment[] = [];

    preHistory = 0;
    postFuture = 1;

    standardTrackingColor = 'rgba(255, 255, 0, 0.5)';
    selectedSourceColor = 'rgba(130, 130, 130, 0.8)';
    existingLinkColor = 'rgba(255, 0, 0, 0.5)';
    currentLinkColor = 'rgba(255, 0, 0, 1)';


    constructor(segmentationModels: SegmentationModel[], trackingModel: TrackingModel, canvasElement, toastController: ToastController) {
        this.segmentationModels = segmentationModels;
        this.trackingModel = trackingModel;

        this.canvasElement = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        this.toastController = toastController;
    }

    get curSegData() {
        return this.segmentationModels[this.currentFrame].segmentationData;
    }

    get selectSource(): boolean {
        if (this.trackingModel.trackingData.selectedSegments.length === 0) {
            return true;
        }

        const frames: number[] = this.trackingModel.trackingData.selectedSegments.map((selSegment: SelectedSegment): number => {
            return selSegment.frame;
        });

        if (Math.min(...frames) > this.currentFrame) {
            // no selection is in the current frame ---> have to select source
            return true;
        }

        return false;
    }

    get sourceSelection(): SelectedSegment {
        const curFrameSelections = this.trackingModel.trackingData.selectedSegments.filter((selSgment: SelectedSegment) => {
            return selSgment.frame === this.currentFrame;
        });

        if (curFrameSelections.length > 1) {
            throw new Error('Too many source selections!');
        }

        if (curFrameSelections.length === 0)  {
            return null;
        }

        return curFrameSelections[0];
    }

    getSelectedPolygon(mouseModelPos: Position, frame: number): [number, Polygon] {
        for (const [index, poly] of this.segmentationModels[frame].polygons.entries()) {
            if (poly.isInside([mouseModelPos.x, mouseModelPos.y])) {
                return [index, poly];
            }
        }

        return [-1, null];
    }

    async onTap(event: any) {
        if (!this.canTrack) {
            return;
        }

        // we have to check whether we did hit a polygon of the current frame
        const mouseModelPos = Utils.screenPosToModelPos(Utils.getMousePosTouch(this.canvasElement, event), this.ctx);

        if (this.selectSource) {
            // this is about selecting the source
            const [polyIndex, poly] = this.getSelectedPolygon(mouseModelPos, this.currentFrame);

            if (poly) {
                // if we did hit a polygon please add the selection
                this.trackingModel.selectSegment(new SelectedSegment(this.currentFrame, polyIndex));

                const toast = await this.toastController.create({
                    message: 'Selected a source segmentation',
                    duration: 2000
                });
                toast.present();
            }
        } else {
            // this is about selecting the targets or deselect the source
            // this is about selecting the source
            const [polyIndex, poly] = this.getSelectedPolygon(mouseModelPos, this.currentFrame + 1);

            if (poly) {
                // if we did hit a polygon please add the selection
                this.trackingModel.selectSegment(new SelectedSegment(this.currentFrame + 1, polyIndex));

                const toast = await this.toastController.create({
                    message: 'Selected a target segmentation',
                    duration: 2000
                });
                toast.present();
            }
        }
    }

    onPress(event: any) {
        throw new Error('Method not implemented.');
    }

    onPanStart(event: any) {
        throw new Error('Method not implemented.');
    }
    onPan(event: any) {
        throw new Error('Method not implemented.');
    }
    onPanEnd(event: any) {
        throw new Error('Method not implemented.');
    }

    onMove(event: any) {
        if (!this.canTrack) {
            return;
        }

        const frame = (this.selectSource) ? this.currentFrame : this.currentFrame + 1;

        const mouseModelPos = Utils.screenPosToModelPos(Utils.getMousePosMouse(this.canvasElement, event), this.ctx);

        const [index, poly] = this.getSelectedPolygon(mouseModelPos, frame);

        if (poly) {
            this.temporarySelection = new SelectedSegment(frame, index);
        } else {
            this.temporarySelection = null;
        }

        this.hoverPoly = poly;

        this.trackingModel.onModelChanged.emit(new TrackingChangedEvent(this.trackingModel, ChangeType.SOFT));
    }

    get canTrack() {
        return this.currentFrame + 1 < this.segmentationModels.length;
    }

    get combinedSelections() {
        return this.trackingModel.trackingData.selectedSegments.concat((this.temporarySelection) ? [this.temporarySelection] : []);
    }

    draw(canvasContext: any): void {

        const allSelections = this.combinedSelections;

        // split in source and target selections

        const frames = allSelections.map((selSeg: SelectedSegment) => {
            return selSeg.frame;
        });

        const sourceFrame = Math.min(...frames);
        const targetFrame = Math.max(...frames);

        // source drawings
        const sourcePolys = allSelections.filter((selSeg: SelectedSegment) => {
            return selSeg.frame === sourceFrame;
        }).map((selSeg: SelectedSegment) => {
            return this.segmentationModels[selSeg.frame].polygons[selSeg.polygonIndex];
        });

        let targetPolys: Polygon[];
        if (sourceFrame === targetFrame)  {
            targetPolys = [];
        } else {
            targetPolys = allSelections.filter((selSeg: SelectedSegment) => {
                return selSeg.frame === targetFrame;
            }).map((selSeg: SelectedSegment) => {
                return this.segmentationModels[selSeg.frame].polygons[selSeg.polygonIndex];
            });
        }

        // draw selected source segmentation
        for (const poly of sourcePolys) {
            // TODO draw source selection differently (e.g. gray)
            poly.drawAdvanced(canvasContext, false, this.selectedSourceColor);
        }
        
        // draw selected target segmentations
        for (const poly of targetPolys) {
            poly.draw(canvasContext);
        }

        // draw links between the selections
        for (const sPoly of sourcePolys) {
            for (const tPoly of targetPolys) {
                const startCenter = sPoly.center;
                const destCenter = tPoly.center;

                UIUtils.drawLine(canvasContext, startCenter, destCenter, this.currentLinkColor, 2);
            }
        }

        // draw the existing links
        const prefilteredLinks = this.trackingModel.trackingData.trackingLinks.filter((trackingLink: TrackingLink) => {
            return trackingLink.source.frame >= this.currentFrame - this.preHistory
                    && trackingLink.source.frame < this.currentFrame + this.postFuture;
        });
        for (const link of prefilteredLinks) {
            const source = link.source;
            const targets = link.targets;

            for (const t of targets) {
                const sourcePoly = this.segmentationModels[source.frame].polygons[source.polygonIndex];
                const targetPoly = this.segmentationModels[t.frame].polygons[t.polygonIndex];

                const sourceCenter = sourcePoly.center;
                const targetCenter = targetPoly.center;

                UIUtils.drawLine(canvasContext, sourceCenter, targetCenter, this.existingLinkColor, 1);
            }
        }

        this.hoverPoly?.drawCenter(canvasContext, 'rgb(255, 0, 0)', 4);


        if (this.selectSource) {
            // we simply draw the source image + segmentations
            this.segmentationModels[this.currentFrame].drawAdvanced(canvasContext, (polygon: Polygon) => this.standardTrackingColor);
        } else {
            // draw target image + target segmentations
            this.segmentationModels[this.currentFrame + 1].drawAdvanced(canvasContext, (polygon: Polygon) => this.standardTrackingColor);
        }
    }

    undo() {
        if (this.canUndo) {
            this.trackingModel.actionManager.undo();
        }
    }

    redo() {
        if (this.canRedo) {
            this.trackingModel.actionManager.redo();
        }
    }

    get canUndo() {
        return this.trackingModel.actionManager.canUndo;
    }

    get canRedo() {
        return this.trackingModel.actionManager.canRedo;
    }

    get canSave() {
        return this.trackingModel.trackingData.selectedSegments.length >= 2;
    }

    async save() {
        if (this.canSave) {
            this.trackingModel.addLink();

            const toast = await this.toastController.create({
                message: 'Added link',
                duration: 2000
            });

            toast.present();
        }
    }

}