import { Point } from './geometry';
import { multiply, inv } from 'mathjs';
import * as simplify from 'simplify-js';
import { SegCollData, SegmentationHolder } from './segmentation-model';
import { pointsToString } from '../services/omero-api.service';
import { SegmentationData } from './segmentation-data';
import { AddLabelAction } from './action';

export interface Position {
    x: number;
    y: number;
}

export const dotLineLength = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, o) => {
    const lineLength = (x: number, y: number, x0: number, y0: number) => {
      return Math.sqrt((x -= x0) * x + (y -= y0) * y);
    };
    if(o && !(o = function(x, y, x0, y0, x1, y1){
      if(!(x1 - x0)) return {x: x0, y: y};
      else if(!(y1 - y0)) return {x: x, y: y0};
      var left, tg = -1 / ((y1 - y0) / (x1 - x0));
      return {x: left = (x1 * (x * tg - y + y0) + x0 * (x * - tg + y - y1)) / (tg * (x1 - x0) + y0 - y1), y: tg * left - tg * x + y};
    }(x, y, x0, y0, x1, y1), o.x >= Math.min(x0, x1) && o.x <= Math.max(x0, x1) && o.y >= Math.min(y0, y1) && o.y <= Math.max(y0, y1))){
      var l1 = lineLength(x, y, x0, y0), l2 = lineLength(x, y, x1, y1);
      return l1 > l2 ? l2 : l1;
    }
    else {
      var a = y0 - y1, b = x1 - x0, c = x0 * y1 - y0 * x1;
      return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
    }
  };

export const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

/**
* returns [min distance index, min distance value]
* @param pos single position (e.g. mouse)
* @param positions list of positions (e.g. target points)
*/
export const pairwiseDistanceMin = (pos: number[], positions: number[][]) => {
 const x = pos[0];
 const y = pos[1];
 let minDisIndex = -1;
 let minDis = 0;
 for (const [index, point] of positions.entries()) {
   const dis = Math.sqrt(Math.pow(x - point[0], 2) + Math.pow(y - point[1], 2));
   if (minDisIndex === -1 || minDis > dis) {
     minDis = dis;
     minDisIndex = index;
   }
 }

 return {index: minDisIndex, distance: minDis};
};

export class Utils {

  static tree = require( 'tree-kit' );

  static euclideanDistance(a: Point, b: Point) {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
  }

  /**
   * Converts a canvas transform to a 3x3 transformation matrix
   * @param t 
   */
  static transformToMatrix(t) {
    return [[t.a, t.c, t.e], [t.b, t.d, t.f], [0, 0, 1]];
  }

  static createTransform(xScale, yScale, xTranlate, yTranslate) {
    return {
      a: xScale,
      b: 0,
      c: 0,
      d: yScale,
      e: xTranlate,
      f: yTranslate
    };
  }
  
  /**
   * Converts a 3x3 transformation matrix to a canvas transform named dictionary.
   * @param m 
   */
  static matrixToTransform(m) {
    return {
      a: m[0][0],
      b: m[1][0],
      c: m[0][1],
      d: m[1][1],
      e: m[0][2],
      f: m[1][2]
    };
  }

  /**
   * Converts positions between screen and model coordinates (applies the inverse transformation matrix)
   * @param pos screen position
   */
  static screenPosToModelPos(pos: Position, canvasCtx): Position {
    let x = pos.x;
    let y = pos.y;

    // convert to geometry coordnate space
    const t = canvasCtx.getTransform();

    const transformMatrix = inv(Utils.transformToMatrix(t));

    const transformedMouse = multiply(transformMatrix, [x, y, 1]);

    x = transformedMouse[0];
    y = transformedMouse[1];

    return {x, y};
  }

  static getMousePos(canvas, evt, onScreen=false): Position {
    // special handling for touch events
    if (evt.touches) {
      evt = evt.touches[0];
    }
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if (evt.center) {
      // if this is a tap or press event (from hammer js)
      x = evt.center.x - rect.left;
      y = evt.center.y - rect.top;
    } else {
      // otherwise (native browser event)
      x = evt.clientX - rect.left;
      y = evt.clientY - rect.top;
    }

    if (!onScreen) {
      // convert to geometry coordnate space
      const modelPos = Utils.screenPosToModelPos({x, y}, ctx);
      x = modelPos.x;
      y = modelPos.y;
    }
    return {
      x, y
      };
  }

  static getMousePosMouse(canvasElement, e): Position {
    const rect = canvasElement.getBoundingClientRect();
    const x: number = e.clientX - rect.left;
    const y: number = e.clientY - rect.top;

    return {x, y};
  }

  static getMousePosTouch(canvasElement, touchEvent): Position {
    const rect = canvasElement.getBoundingClientRect();
    const x: number = touchEvent.center.x - rect.left;
    const y: number = touchEvent.center.y - rect.top;

    return {x, y};
  }

  /**
   * Simplifies a point list using simplify-js http://mourner.github.io/simplify-js/
   * @param pointList the point list
   * @param tolerance tolerance value. the lower the closer it is to the original shape
   */
  static simplifyPointList(pointList: Point[], tolerance: number): Point[] {
    const points = pointList.map(p => ({x: p[0], y: p[1]}) );
    const simplePoints = simplify(points, tolerance);
    return simplePoints.map(sp => [sp.x, sp.y]);
  }
}

export class UIUtils {
  /**
   * Draws a single segmentation polygon
   * @param points the list of polygon border
   * @param p index in the global polygon list
   */
  static drawSingle(points: Point[], active: boolean, ctx, color: string) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // create the path for polygon
    ctx.beginPath();
    for (const point of points) {
      if (active) {
        ctx.fillRect(point[0] - 1, point[1] - 1, 2, 2);
        ctx.strokeRect(point[0] - 1, point[1] - 1, 2, 2);
      }
      ctx.lineTo(point[0], point[1]);
    }
    ctx.closePath();

    // perform the filling
    if (!color.startsWith('rgb')) {
      const fillColor = hexToRgb(color);
      ctx.fillStyle = 'rgba(' + fillColor.r + ',' + fillColor.g + ',' + fillColor.b + ',0.3)';
    } else {
      ctx.fillStyle = color;
    }
    ctx.fill();
    ctx.stroke();
  }

  static drawCircle(ctx, center: [number, number], radius: number, color) {
    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, 2 * Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#003300';
    ctx.stroke();
  }

  static drawLine(ctx, start: [number, number], stop: [number, number], color, lineWidth = 2) {
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(stop[0], stop[1]);
    ctx.closePath();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  static randomColor() {
    return '#'+(function lol(m,s,c){return s[m.floor(m.random() * s.length)] + (c && lol(m,s,c-1));})(Math,'0123456789ABCDEF',4)
  }

  static fitToContainer(canvasElement) {
    let changed = false;
    // Make it visually fill the positioned parent
    if (canvasElement.style.width !== '100%') {
      canvasElement.style.width = '100%';
      canvasElement.style.height = '100%';

      changed = true;
    }
    if (canvasElement.width !== canvasElement.offsetWidth
      || canvasElement.height !== canvasElement.offsetHeight) {
      // ...then set the internal size to match
      canvasElement.width  = canvasElement.offsetWidth;
      canvasElement.height = canvasElement.offsetHeight;

      changed = true;
    }

    return changed;
  }

  static clearCanvas(canvasElement, ctx) {
    // Store the current transformation matrix
    ctx.save();

    // Use the identity matrix while clearing the canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Restore the transform
    ctx.restore();
  }

}

export class OmeroUtils {

  static createRoIDeletionList(data) {

    let empty_rois = [];

    for (const roi of data.roiData) {
      const remove_list = roi.shapes.map(shape => shape.id).map(shape_id => [roi.id, shape_id]);
      empty_rois = empty_rois.concat(remove_list);
    }

    return empty_rois;
  }

  static createNewRoIList(segHolder: SegCollData) {
    const new_list = [];
    // loop over all image slices
    for (const [index, slice] of segHolder.segData.entries()) {
      const z = 0;
      const t = index;
      // loop over all annotated polygons in the slice
      for (const [id, poly] of slice.getPolygons()) {
        if(poly.numPoints == 0) {
          continue;
        }
        const roi_data = {
          "@type": "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon",
          Area:	0.,
          FillColor:	-256,
          Length: -1,
          oldId: "-6:-850",
          Points: pointsToString(poly.points),
          StrokeColor: -65281,
          StrokeWidth: {
            "@type":	"TBD#LengthI",
            Symbol:	"px",
            Unit:	"PIXEL",
            Value:	1
          },
          // set the label name as a comment
          Text: segHolder.getLabelById(slice.getPolygonLabel(id)).name,
          TheT:	t,
          TheZ:	z,
        }
        new_list.push(roi_data);
      }
    }

    return new_list;
  }
}
