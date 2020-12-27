import { Point } from '../models/point';
import { Pen } from '../models/pen';
import { Node } from '../models/node';
import { Line } from '../models/line';
import { getBezierPoint } from '../middles/lines/curve';
import { Rect } from '../models/rect';

export function getRect(pens: Pen[]) {

  const points: Point[] = [];
  for (const item of pens) {
    if (item instanceof Node) {
      const pts = item.rect.toPoints();
      if (item.rotate) {
        for (const pt of pts) {
          pt.rotate(item.rotate, item.rect.center);
        }
      }
      points.push.apply(points, pts);
    } else if (item instanceof Line) {
      // points.push(item.from);
      // points.push(item.to);
      if (item.name === 'curve') {
        for (let i = 0.01; i < 1; i += 0.02) {
          points.push(getBezierPoint(i, item.from, item.controlPoints[0], item.controlPoints[1], item.to));
        }
      }
    }
  }
  const { x1, y1, x2, y2 } = getBboxOfPoints(points);

  return new Rect(x1, y1, x2 - x1, y2 - y1);
}


export function getBboxOfPoints(points: Point[]) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  for (const item of points) {
    const { x, y } = item;
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  }
  return { x1, y1, x2, y2 };
}
