export interface Drawer {
    draw(canvasContext): void;
}

export interface UIInteraction {

    onTap(event): boolean;
    onPress(event): boolean;

    onPointerDown(event): boolean;
    onPointerMove(event): boolean;
    onPointerUp(event): boolean;

    onPanStart(event): boolean;
    onPan(event): boolean;
    onPanEnd(event): boolean;

    onMove(event): boolean;
}
