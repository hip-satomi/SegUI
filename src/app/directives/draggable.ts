import { ContentChild, Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, OnInit, Output } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

import { DraggableHelperDirective } from './draggable-helper';

export interface Position {
  x: number;
  y: number;
}

@Directive({
  selector: '[appDraggable]'
})
export class DraggableDirective implements OnInit {
  @Input('appDraggable') @HostBinding('class.draggable') enabled = true;

  @HostBinding('attr.touch-action') touchAction = 'none';

  @HostBinding('class.dragging') dragging = false;
  @HostBinding('class.helper-active') helperActive = false;

  @ContentChild(DraggableHelperDirective) helper?: DraggableHelperDirective;

  @Output() dragStart = new EventEmitter<PointerEvent>();
  @Output() dragMove = new EventEmitter<PointerEvent>();
  @Output() dragEnd = new EventEmitter<PointerEvent>();

  ngOnInit(): void {
    if (this.helper) {
      this.dragStart.subscribe(event => {
        this.helperActive = true;
        this.helper.onDragStart(event);
      });

      this.dragMove.subscribe(event => {
        this.helper.onDragMove(event);
      });

      this.dragEnd.subscribe(event => {
        this.helperActive = false;
        this.helper.onDragEnd(event);
      });
    }
  }

  @HostListener('pointerdown', ['$event']) onPointerDown(event: PointerEvent) {
    this.dragging = true;
    this.dragStart.next(event);
  }

  @HostListener('document:pointermove', ['$event']) onPointerMove(event: PointerEvent) {
    if (!this.dragging) {
      return;
    }

    this.dragMove.next(event);
  }

  @HostListener('document:pointerup', ['$event']) onPointerUp(event: PointerEvent) {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.dragEnd.next(event);
  }
}
