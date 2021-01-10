import { Observable } from 'rxjs';
import { UIUtils } from './utils';

export class Pencil {
    canvasCtx;
    canvasElement;

    constructor(canvasCtx, canvasElement) {
        this.canvasCtx = canvasCtx;
        this.canvasElement = canvasElement;
    }

    clear() {
        UIUtils.clearCanvas(this.canvasElement, this.canvasCtx);
    }
}


export interface Drawer {
    /**
     * Prepare all resources for drawing and return when finished
     */
    prepareDraw(): Observable<Drawer>;
    draw(pencil: Pencil): void;
}

export class UIInteraction {

    onTap(event): boolean {
        return false;
    }
    onPress(event): boolean {
        return false;
    }

    onPointerDown(event): boolean {
        return false;
    }
    onPointerMove(event): boolean {
        return false;
    }
    onPointerUp(event): boolean {
        return false;
    }

    onPanStart(event): boolean {
        return false;
    }
    onPan(event): boolean {
        return false;
    }
    onPanEnd(event): boolean  {
        return false;
    }

    onMove(event): boolean {
        return false;
    }
}

export interface Deletable {
    delete(): boolean;
}
