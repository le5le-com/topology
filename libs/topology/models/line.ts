import { Pen } from './pen';
import { Rect } from './rect';
import { Point } from './point';
import { drawLineFns, drawArrowFns } from '../middles';
import { getBezierPoint } from '../middles/lines/curve';
import { Store } from 'le5le-store';
import { lineLen, curveLen } from '../utils';
import { text } from '../middles/nodes/text';

export class Line extends Pen {
  from: Point;
  to: Point;
  controlPoints: Point[] = [];
  fromArrow: string;
  toArrow: string;

  length: number;

  borderWidth = 0;
  borderColor = '#000';

  text: string;
  textMaxLine: number;
  textRect: Rect;

  animateColor = '';
  animateSpan = 1;
  animatePos = 0;
  bubbles: Point[] = [];
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
      this.text = json.text;
      if (json.textMaxLine) {
          this.textMaxLine = +json.textMaxLine || 0;
      }
    } else {
      this.name = 'curve';
      this.fromArrow = 'triangleSolid';
    }
    this.initTextRect();
  }

  setFrom(from: Point, fromArrow: string = '') {
    this.from = from;
    this.fromArrow = fromArrow;
    this.initTextRect();
  }

  setTo(to: Point, toArrow: string = 'triangleSolid') {
    this.to = to;
    this.toArrow = toArrow;
    this.initTextRect();
  }

  calcControlPoints() {
    if (this.to && drawLineFns[this.name]) {
      drawLineFns[this.name].controlPointsFn(this);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.bubbles.length) {
      const tailWidth = 4 + this.lineWidth;
      for (let i = 0, l = this.bubbles.length; i < l; i++) {
        const p = this.bubbles[i];
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = this.strokeStyle;
        ctx.arc(p.x, p.y, tailWidth * (l - i) / l / 2, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
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
    // Draw text.
    if (this.text) {
      this.initTextRect();
      ctx.save();
      ctx.shadowColor = '';
      ctx.shadowBlur = 0;
      text(ctx, this);
      ctx.restore();
    }
  }
  initTextRect() {
    if (!this.from || !this.to || !this.text) {
      return;
    }
    const width = 100, heigth = this.font.lineHeight * this.font.fontSize;
    const point = this.getPointByLength(this.getLen() / 2);
    this.textRect = new Rect(point.x - width / 2, point.y - heigth / 2, width, heigth);
  }

  getPointByLength(len: number): Point {
    if (len <= 0) {
      return this.from;
    }
    let x: number, y: number;
    switch (this.name) {
      case 'line':
        return this.getLinePoint(this.from, this.to, len);
      case 'polyline':
        if (!this.controlPoints || !this.controlPoints.length) {
          return this.getLinePoint(this.from, this.to, len);
        } else {
          const points = [].concat(this.controlPoints, this.to);
          let curPt = this.from;
          for (const pt of points) {
            const l = lineLen(curPt, pt);
            if (len > l) {
              len -= l;
              curPt = pt;
            } else {
              return this.getLinePoint(curPt, pt, len);
            }
          }
          return this.to;
        }
      case 'curve':
        const length = this.getLen();
        const from = this.from, to = this.to, cp1 = this.controlPoints[0], cp2 = this.controlPoints[1];
        // tslint:disable-next-line:max-line-length
        x = from.x * Math.pow((1 - len / length), 3) + 3 * cp1.x * (len / length) * Math.pow((1 - len / length), 2) + 3 * cp2.x * Math.pow((len / length), 2) * (1 - len / length) + to.x * Math.pow((len / length), 3);
        // tslint:disable-next-line:max-line-length
        y = from.y * Math.pow((1 - len / length), 3) + 3 * cp1.y * (len / length) * Math.pow((1 - len / length), 2) + 3 * cp2.y * Math.pow((len / length), 2) * (1 - len / length) + to.y * Math.pow((len / length), 3);
        break;
    }
    return new Point(x, y);
  }

  getLinePoint(from: Point, to: Point, len: number) {
    const length = lineLen(from, to);
    if (len <= 0) {
      return from;
    }
    if (len >= length) {
      return to;
    }
    let x: number, y: number;
    x = from.x + (to.x - from.x) * (len / length);
    y = from.y + (to.y - from.y) * (len / length);
    return new Point(x, y);
  }

  getTextRect() {
    return this.textRect;
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
    if (this.bubbles.length > 0) {
       this.bubbles = [];
    }
    if (+this.animateType === 1) {
      this.lineDashOffset = -this.animatePos;
      this.lineDash = [this.lineWidth, this.lineWidth * 2];
    } else if (+this.animateType === 2) {
      if (this.lineDash) {
        this.lineDash = null;
      }
      const tailLength = 30;
      for (let i = 0; i < tailLength; i++) {
        const curPt = this.getPointByLength(this.animatePos - i * (this.animateSpan + 1));
        this.bubbles.push(curPt);
      }
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
