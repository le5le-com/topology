import { Store } from 'le5le-store';

import { Point } from '../../models/point';
import { Line } from '../../models/line';
import { Direction } from '../../models/direction';
import { pointInLine } from '../../utils/canvas';
import { getBezierPoint, generateStoreKey } from './curve';

const distance = 8;

export function mind(ctx: CanvasRenderingContext2D, l: Line) {
  ctx.beginPath();
  ctx.moveTo(l.from.x, l.from.y);
  ctx.lineTo(l.controlPoints[0].x, l.controlPoints[0].y);
  ctx.bezierCurveTo(
    l.controlPoints[1].x,
    l.controlPoints[1].y,
    l.controlPoints[2].x,
    l.controlPoints[2].y,
    l.to.x,
    l.to.y
  );
  ctx.stroke();
}

export function mindControlPoints(ctx: CanvasRenderingContext2D, l: Line) {
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle + '80';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(l.controlPoints[0].x, l.controlPoints[0].y);
  ctx.lineTo(l.controlPoints[1].x, l.controlPoints[1].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(l.to.x, l.to.y);
  ctx.lineTo(l.controlPoints[2].x, l.controlPoints[2].y);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.lineWidth = 2;
  for (const item of l.controlPoints) {
    ctx.beginPath();
    ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

export function calcMindControlPoints(l: Line) {
  if (!l.from.direction) {
    l.from.direction = Direction.Bottom;
  }
  if (!l.to.direction) {
    l.to.direction = (l.from.direction + 2) % 4;
    if (!l.to.direction) {
      l.to.direction = Direction.Left;
    }
  }

  const from = new Point(l.from.x, l.from.y, l.from.direction);
  switch (l.from.direction) {
    case Direction.Up:
      from.y -= distance;
      break;
    case Direction.Right:
      from.x += distance;
      break;
    case Direction.Bottom:
      from.y += distance;
      break;
    case Direction.Left:
      from.x -= distance;
      break;
  }

  const w = l.to.x - from.x;
  const h = l.to.y - from.y;
  if (l.from.direction === Direction.Left || l.from.direction === Direction.Right) {
    l.controlPoints = [from, new Point(from.x, from.y + h / 3), new Point(from.x, l.to.y)];
  } else {
    l.controlPoints = [from, new Point(from.x + w / 3, from.y), new Point(l.to.x, from.y)];
  }

  Store.set(generateStoreKey(l, 'pts-') + l.id, null);
}

export function pointInMind(point: Point, l: Line) {
  let points: Point[] = Store.get(generateStoreKey(l, 'pts-') + l.id) as Point[];
  if (!points) {
    points = [l.from];
    for (let i = 0.01; i < 1; i += 0.01) {
      points.push(getBezierPoint(i, l.controlPoints[0], l.controlPoints[1], l.controlPoints[2], l.to));
    }
    points.push(l.to);
    Store.set(generateStoreKey(l, 'pts-') + l.id, points);
  }
  const cnt = points.length - 1;
  for (let i = 0; i < cnt; ++i) {
    if (pointInLine(point, points[i], points[i + 1])) {
      return true;
    }
  }
  return false;
}
