export interface Drawer {
    draw(canvasContext): void;
}

export interface UIInteraction {

    onTap(event);
    onPress(event);

    onPanStart(event);
    onPan(event);
    onPanEnd(event);
}
