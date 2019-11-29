import { Pen } from './pen';
import { Point } from './point';
import { drawLineFns, drawArrowFns } from '../middles';
import { getBezierPoint } from '../middles/lines/curve';
import { Store } from 'le5le-store';
import { lineLen, curveLen } from '../utils';

export class Line extends Pen {
  from: Point;
  to: Point;
  controlPoints: Point[] = [];
  fromArrow: string;
  toArrow: string;

  length: number;

  borderWidth = 0;
  borderColor = '#000000';

  animateColor = '';
  animateSpan = 1;
  animatePos = 0;
  constructor(json?: any) {
    super(json);

    if (json) {
      if (json.from) {
        this.from = new Point(json.from.x, json.from.y, json.from.direction, json.from.anchorIndex, json.from.id);
      }
      if (json.to) {
        this.to = new Point(json.to.x, json.to.y, json.to.direction, json.to.anchorIndex, json.to.id);
      }
      for (const item of json.controlPoints) {
        this.controlPoints.push(new Point(item.x, item.y, item.direction, item.anchorIndex, item.id));
      }
      this.fromArrow = json.fromArrow || '';
      this.toArrow = json.toArrow || '';
      if (json.animateColor) {
        this.animateColor = json.animateColor;
      }
      if (json.animateSpan) {
        this.animateSpan = json.animateSpan;
      }
      if (json.length) {
        this.length = json.length;
      }
      if (json.borderWidth) {
        this.borderColor = json.borderColor;
        this.borderWidth = json.borderWidth;
      }
    } else {
      this.name = 'curve';
      this.fromArrow = 'triangleSolid';
    }
  }

  setFrom(from: Point, fromArrow: string = '') {
    this.from = from;
    this.fromArrow = fromArrow;
  }

  setTo(to: Point, toArrow: string = 'triangleSolid') {
    this.to = to;
    this.toArrow = toArrow;
  }

  calcControlPoints() {
    if (this.to && drawLineFns[this.name]) {
      drawLineFns[this.name].controlPointsFn(this);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.borderWidth > 0 && this.borderColor) {
      ctx.save();
      ctx.lineWidth = this.lineWidth + this.borderWidth;
      ctx.strokeStyle = this.borderColor;
      if (drawLineFns[this.name]) {
        drawLineFns[this.name].drawFn(ctx, this);
      }
      ctx.restore();
    }

    if (drawLineFns[this.name]) {
      drawLineFns[this.name].drawFn(ctx, this);
    }

    const scale = Store.get('LT:scale');
    if (this.fromArrow && drawArrowFns[this.fromArrow]) {
      ctx.save();
      ctx.beginPath();
      if (this.strokeStyle) {
        ctx.fillStyle = this.strokeStyle;
      } else {
        ctx.fillStyle = ctx.strokeStyle;
      }
      let f = this.to;
      if (this.name === 'curve') {
        f = getBezierPoint(0.9, this.to, this.controlPoints[1], this.controlPoints[0], this.from);
      } else if (this.name !== 'line' && this.controlPoints.length) {
        f = this.controlPoints[0];
      }
      drawArrowFns[this.fromArrow](ctx, f, this.from, scale);
      ctx.restore();
    }
    if (this.toArrow && drawArrowFns[this.toArrow]) {
      ctx.save();
      ctx.beginPath();
      if (this.strokeStyle) {
        ctx.fillStyle = this.strokeStyle;
      } else {
        ctx.fillStyle = ctx.strokeStyle;
      }
      let f = this.from;
      if (this.name === 'curve') {
        f = getBezierPoint(0.9, this.from, this.controlPoints[0], this.controlPoints[1], this.to);
      } else if (this.name !== 'line' && this.controlPoints.length) {
        f = this.controlPoints[this.controlPoints.length - 1];
      }
      drawArrowFns[this.toArrow](ctx, f, this.to, scale);
      ctx.restore();
    }
  }

  pointIn(pt: Point) {
    return drawLineFns[this.name].pointIn(pt, this);
  }

  getLen() {
    switch (this.name) {
      case 'line':
        return lineLen(this.from, this.to);
      case 'polyline':
        if (!this.controlPoints || !this.controlPoints.length) {
          return lineLen(this.from, this.to);
        }

        let len = 0;
        let curPt = this.from;
        for (const pt of this.controlPoints) {
          len += lineLen(curPt, pt);
          curPt = pt;
        }
        len += lineLen(curPt, this.to);
        return len | 0;

      case 'curve':
        return curveLen(this.from, this.controlPoints[0], this.controlPoints[1], this.to);
    }

    return 0;
  }

  animate() {
    this.animatePos += this.animateSpan;
    if (this.animateType) {
      this.lineDashOffset = -this.animatePos;
      this.lineDash = [this.lineWidth, this.lineWidth * 2];
    } else {
      this.lineDash = [this.animatePos, this.length - this.animatePos + 1];
    }
    if (this.animatePos > this.length + this.animateSpan) {
      if (++this.animateCycleIndex >= this.animateCycle && this.animateCycle > 0) {
        this.animateStart = 0;
        Store.set('animateEnd', {
          type: 'line',
          data: this
        });
        return this.nextAnimate;
      }

      this.animatePos = this.animateSpan;
    }
  }

  round() {
    this.from.round();
    this.to.round();
  }
}
