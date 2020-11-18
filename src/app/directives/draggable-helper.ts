import { Directive, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { GlobalPositionStrategy, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { CdkPortal } from '@angular/cdk/portal';

import { Position } from './draggable';

@Directive({
  selector: '[appDraggableHelper]'
})
export class DraggableHelperDirective implements OnInit, OnDestroy {
  dragging = false;

  private dragElement: HTMLElement;
  private relPosition: Position;
  private overlayRef: OverlayRef;
  private positioningStrategy: GlobalPositionStrategy;

  constructor(private templateRef: TemplateRef<any>,
              private viewContainerRef: ViewContainerRef,
              private overlay: Overlay) {
  }

  ngOnInit(): void {
    this.positioningStrategy = new GlobalPositionStrategy();
    this.overlayRef = this.overlay.create({
      positionStrategy: this.positioningStrategy
    });
  }

  ngOnDestroy(): void {
    this.overlayRef.dispose();
  }

  onDragStart(event: PointerEvent): void {
    this.dragElement = event.target as HTMLElement;

    const rect = this.dragElement.getBoundingClientRect();

    this.relPosition = {
      x: rect.left - event.pageX,
      y: rect.top - event.pageY,
    };
  }

  onDragMove(event: PointerEvent): void {
    if (!this.overlayRef.hasAttached()) {
      this.overlayRef.attach(new CdkPortal(this.templateRef, this.viewContainerRef));
    }

    this.positioningStrategy.left(`${event.pageX + this.relPosition.x}px`);
    this.positioningStrategy.top(`${event.pageY + this.relPosition.y}px`);
    this.positioningStrategy.apply();
  }

  onDragEnd(event: PointerEvent): void {
    const rect = this.dragElement.getBoundingClientRect();

    this.overlayRef.overlayElement.classList.add('animated');

    this.positioningStrategy.left(`${rect.left}px`);
    this.positioningStrategy.top(`${rect.top}px`);
    this.positioningStrategy.apply();
    
    // wait for animation to end end remove helper element
    setTimeout(() => {
      this.overlayRef.overlayElement.classList.remove('animated');
      this.overlayRef.detach();
    }, 200);
  }
}
