import { Observable, ReplaySubject } from 'rxjs';
import { UIUtils } from './utils';

/**
 * Wrapper class for canvas
 */
export class Pencil {
    /** drawing context */
    canvasCtx;
    /** canvas html element */
    canvasElement;

    constructor(canvasCtx, canvasElement) {
        this.canvasCtx = canvasCtx;
        this.canvasElement = canvasElement;
    }

    /**
     * Clear the canvas (white)
     */
    clear() {
        UIUtils.clearCanvas(this.canvasElement, this.canvasCtx);
    }
}


export interface Drawer {
    /**
     * Prepare all resources for drawing and return when finished
     */
    prepareDraw(): Observable<Drawer>;

    /**
     * Draw the content
     * @param pencil to use for drawing
     */
    draw(pencil: Pencil): void;
}

/**
 * Interface for typical UI interactions
 * 
 * false return means not consumed --> handed over to the next (higher) entity
 */
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

/**
 * A tool with UI that can be opened and closed
 */
export class Tool extends UIInteraction {
    show = false;
    visibilityChange = new ReplaySubject<boolean>(1);
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    open() {
        this.show = true;
        this.visibilityChange.next(this.show);
    }

    close() {
        this.show = false;
        this.visibilityChange.next(this.show);
    }

    get canUndo() {
        return false;
    }

    get canRedo() {
        return false;
    }

    undo() {
        throw new Error("Undo is not implemented!");
    }

    redo() {
        throw new Error("Redo is not implemented!");
    }
}
