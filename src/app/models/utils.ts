import { Point } from './geometry';
import { multiply, inv } from 'mathjs';
import * as simplify from 'simplify-js';
import { SegCollData} from './segmentation-model';
import { pointsToString, RoIData } from '../services/omero-api.service';

var convert = require('color-convert');

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

  // Load the core build.
  private static lodashCore = require('lodash');

  static clone(obj) {
    return Utils.lodashCore.cloneDeep(obj, true);
  }

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

  /**
   * Check points due to issue 48
   * @param points array of points
   * @returns valid array of valid points
   */
  static checkPoints(points: Point[]): Point[] {
    return points.filter((point: Point) => point && point.length == 2);
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
    ctx.strokeStyle = 'rgba(0,0,0,0)'; // invisible stroke (to better see the labeled cell interior)
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

  /**
   * Generate random bright colors in hex format
   * 
   * Brightness is needed because we usually deal with dark images. Used to give a bigger contrast
   * @returns a hex string color (e.g. '#FFFFFF')
   */
  static randomBrightColor() {
    // sample color in hsl
    const h = Math.random() * 360;
    const s = (0.5 + Math.random() / 2.0) * 100.;
    const l = (0.6 + Math.random() / 5.) * 100.;  // between 0.4-0.6

    const hex = convert.rgb.hex(convert.hsl.rgb(h,s,l));

    return '#'+hex;
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

  /**
   * Creating a list of roi and shape ids to be deleted to clear the omero overlay
   * @param roiData List of RoIs 
   * @returns [(roi id, shape id), ...]
   */
  static createRoIDeletionList(roiData: Array<RoIData>): Array<[number, number]> {

    let deletion_list: Array<[number, number]> = [];

    // loop over rois
    for (const roi of roiData) {
      // filter for polygons only
      const remove_candidates = roi.shapes.filter(shape => shape.type === 'http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon');
      // convert to (roi id, shape id)
      const remove_list = remove_candidates.map(shape => shape.id).map(shape_id => [roi.id, shape_id] as [number, number]);
      // add to the removal list
      deletion_list = deletion_list.concat(remove_list);
    }

    return deletion_list;
  }

  /**
   * Create a list of json RoIs that can be passed to the web interface for creation
   * @param segHolder the segmentation information for the image stack
   * @param sizeZ the z dimension
   * @param sizeT the t dimension
   * @returns a list of omero Polygons RoIs that can be passed to the web interface
   */
  static createNewRoIList(segHolder: SegCollData, sizeZ: number, sizeT: number) {

    // obtain the output node
    let mode: string;
    if (sizeZ == 1 && sizeT >= 1) {
      mode = "t";
    } else if (sizeZ >= 1 && sizeT == 1) {
      mode = "z";
    } else if (sizeZ >= 1 && sizeT >= 1) {
      mode = "zt";
    } else {
      throw new Error("Cannot obtain omero Export mode!");
    }

    const new_list = [];
    // loop over all image slices
    for (const [index, slice] of segHolder.segData.entries()) {
      let z: number, t: number;
      if (mode == "t") {
        z = 0;
        t = index;
      } else if(mode == "z") {
        z = index;
        t = 0;
      } else if(mode == "zt") {
        t = index % sizeZ;
        z = index - (t*sizeZ);
      }
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
