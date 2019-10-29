import { Point } from './point';
import { pointInRect } from '../middles/utils';

export class Rect {
  ex: number;
  ey: number;
  center: Point = new Point(0, 0);
  constructor(public x: number, public y: number, public width: number, public height: number) {
    this.ex = this.x + this.width;
    this.ey = this.y + this.height;
    this.calceCenter();
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height);
  }

  hit(pt: Point, padding = 0) {
    return pt.x > this.x - padding && pt.x < this.ex + padding && pt.y > this.y - padding && pt.y < this.ey + padding;
  }

  hitRect(rect: Rect) {
    return (
      (rect.x > this.x && rect.x < this.ex && rect.y > this.y && rect.y < this.ey) ||
      (rect.ex > this.x && rect.ex < this.ex && rect.y > this.y && rect.y < this.ey) ||
      (rect.ex > this.x && rect.ex < this.ex && rect.ey > this.y && rect.ey < this.ey) ||
      (rect.x > this.x && rect.x < this.ex && rect.ey > this.y && rect.ey < this.ey)
    );
  }

  hitRotate(point: Point, rotate: number, center: Point) {
    const pts = this.toPoints();
    for (const pt of pts) {
      pt.rotate(rotate, center);
    }

    return pointInRect(point, pts);
  }

  calceCenter() {
    this.center.x = this.x + this.width / 2;
    this.center.y = this.y + this.height / 2;
  }

  toPoints() {
    return [
      new Point(this.x, this.y),
      new Point(this.ex, this.y),
      new Point(this.ex, this.ey),
      new Point(this.x, this.ey)
    ];
  }

  scale(scale: number, center?: Point) {
    if (!center) {
      center = this.center;
    }
    this.x = center.x - (center.x - this.x) * scale;
    this.y = center.y - (center.y - this.y) * scale;
    this.width *= scale;
    this.height *= scale;
    this.ex = this.x + this.width;
    this.ey = this.y + this.height;
    this.calceCenter();
  }

  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.width = Math.round(this.width);
    this.height = Math.round(this.height);
    this.ex = this.x + this.width;
    this.ey = this.y + this.height;
    this.calceCenter();
  }
}
