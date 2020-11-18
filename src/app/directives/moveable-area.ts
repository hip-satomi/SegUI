import { AfterContentInit, ContentChildren, Directive, ElementRef, HostListener, QueryList } from '@angular/core';

import { MovableDirective } from './moveable';

interface Boundaries {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

@Directive({
  selector: '[appMovableArea]'
})
export class MovableAreaDirective implements AfterContentInit {
  @ContentChildren(MovableDirective) movables: QueryList<MovableDirective>;

  private boundaries: Boundaries;

  constructor(private element: ElementRef) {}

  ngAfterContentInit(): void {
    this.movables.forEach(moveable => {
      moveable.dragStart.subscribe(() => this.measureBoundaries(moveable));
      moveable.dragMove.subscribe(() => this.maintainBoundaries(moveable));
    });
  }

  @HostListener('window:resize') onResize() {
    this.movables.forEach(movable => {
      this.measureBoundaries(movable);
      this.maintainBoundaries(movable);
    });
  }

  private measureBoundaries(movable: MovableDirective) {
    const viewRect = this.element.nativeElement.getBoundingClientRect();
    const draggableViewRect = movable.element.nativeElement.getBoundingClientRect();

    this.boundaries = {
      minX: movable.position.x - (draggableViewRect.left - viewRect.left),
      minY: movable.position.y - (draggableViewRect.top - viewRect.top),
      maxX: movable.position.x - (draggableViewRect.right - viewRect.right),
      maxY: movable.position.y - (draggableViewRect.bottom - viewRect.bottom),
    };
  }

  private maintainBoundaries(movable: MovableDirective) {
    movable.position.x = Math.max(this.boundaries.minX, movable.position.x);
    movable.position.y = Math.max(this.boundaries.minY, movable.position.y);
    movable.position.x = Math.min(this.boundaries.maxX, movable.position.x);
    movable.position.y = Math.min(this.boundaries.maxY, movable.position.y);
  }
}
