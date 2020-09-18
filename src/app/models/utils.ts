import { multiply, inv } from 'mathjs';

export interface Position {
    x, y
}

export const dotLineLength = function(x, y, x0, y0, x1, y1, o) {
    function lineLength(x, y, x0, y0){
      return Math.sqrt((x -= x0) * x + (y -= y0) * y);
    }
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
  }

export const hexToRgb = function(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

/**
* returns [min distance index, min distance value]
* @param pos single position (e.g. mouse)
* @param positions list of positions (e.g. target points)
*/
export const pairwiseDistanceMin = function(pos: number[], positions: number[][]) {
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
}

export class Utils {

  /**
   * Converts a canvas transform to a 3x3 transformation matrix
   * @param t 
   */
  static transformToMatrix(t) {
    return [[t.a, t.c, t.e], [t.b, t.d, t.f], [0, 0, 1]];
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
}

export class UIUtils {
  /**
   * Draws a single segmentation polygon
   * @param points the list of polygon border
   * @param p index in the global polygon list
   */
  static drawSingle(points, active, ctx, color) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // create the path for polygon
    ctx.beginPath();
    for (const point of points) {
      if (active) {
        ctx.fillRect(point[0] - 2, point[1] - 2, 4, 4);
        ctx.strokeRect(point[0] - 2, point[1] - 2, 4, 4);
      }
      ctx.lineTo(point[0], point[1]);
    }
    ctx.closePath();

    // perform the filling
    const fillColor = hexToRgb(color);
    ctx.fillStyle = 'rgba(' + fillColor.r + ',' + fillColor.g + ',' + fillColor.b + ',0.3)';
    ctx.fill();
    ctx.stroke();
  }

  static randomColor() {
    return '#'+(function lol(m,s,c){return s[m.floor(m.random() * s.length)] + (c && lol(m,s,c-1));})(Math,'0123456789ABCDEF',4)
  }

}
