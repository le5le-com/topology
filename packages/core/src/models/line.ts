import { Pen, PenType } from './pen';
import { Point } from './point';
import { drawLineFns, drawArrowFns } from '../middles';
import { getBezierPoint } from '../middles/lines/curve';
import { Store } from 'le5le-store';
import { lineLen, curveLen } from '../utils/canvas';
import { text } from '../middles/nodes/text';
import { Rect } from './rect';
import { abs } from '../utils/math';

export class Line extends Pen {
  from: Point;
  to: Point;
  controlPoints: Point[] = [];
  fromArrow: string;
  toArrow: string;
  fromArrowSize = 5;
  toArrowSize = 5;
  fromArrowColor: string;
  toArrowColor: string;

  length: number;

  borderWidth = 0;
  borderColor = '#000000';

  animateColor = '';
  animateSpan = 1;

  animateLineDash: number[];

  isAnimate = false;
  animateFromSize = 0;
  animateToSize = 0;

  animateDot: { x: number; y: number };
  animateDotSize = 3;

  lineJoin: CanvasLineJoin;

  manualCps: boolean;
  disableEmptyLine: boolean;

  constructor(json?: any) {
    super(json);

    this.type = PenType.Line;
    if (json) {
      if (json.from) {
        this.from = new Point(
          json.from.x,
          json.from.y,
          json.from.direction,
          json.from.anchorIndex,
          json.from.id,
          json.autoAnchor
        );
      }
      if (json.to) {
        this.to = new Point(json.to.x, json.to.y, json.to.direction, json.to.anchorIndex, json.to.id, json.autoAnchor);
      }

      this.fromArrow = json.fromArrow || '';
      this.toArrow = json.toArrow || '';
      this.fromArrowSize = json.fromArrowSize || 5;
      this.toArrowSize = json.toArrowSize || 5;
      this.fromArrowColor = json.fromArrowColor;
      this.toArrowColor = json.toArrowColor;
      if (json.animateColor) {
        this.animateColor = json.animateColor;
      }
      if (json.animateSpan) {
        this.animateSpan = json.animateSpan;
      }
      if (json.animateLineDash) {
        this.animateLineDash = json.animateLineDash;
      }
      if (json.animatePlay) {
        this.animatePlay = json.animatePlay;
      }
      if (json.animateStart) {
        this.animateStart = json.animateStart;
      }
      if (json.length) {
        this.length = json.length;
      }
      if (json.borderWidth) {
        this.borderColor = json.borderColor;
        this.borderWidth = json.borderWidth;
      }
      this.animateDotSize = json.animateDotSize || 3;
      this.manualCps = json.manualCps;
      this.disableEmptyLine = json.disableEmptyLine;

      if (json.lineJoin) {
        this.lineJoin = json.lineJoin;
      }
    } else {
      this.name = 'curve';
      this.fromArrow = 'triangleSolid';
    }

    if (!this.font.background) {
      this.font.background = '#fff';
    }

    // 暂时兼容老数据
    if (json.name === 'mind' && json.controlPoints && json.controlPoints.length < 3) {
      json.controlPoints = null;
      this.calcControlPoints();
    }
    //

    if (json.controlPoints) {
      for (const item of json.controlPoints) {
        this.controlPoints.push(new Point(item.x, item.y, item.direction, item.anchorIndex, item.id));
      }
    }
  }

  setFrom(from: Point, fromArrow: string = '') {
    this.from = from;
    this.fromArrow = fromArrow;
    this.textRect = null;
  }

  setTo(to: Point, toArrow: string = 'triangleSolid') {
    this.to = to;
    this.toArrow = toArrow;
    this.textRect = null;
  }

  calcControlPoints(force?: boolean) {
    if (this.manualCps && !force) {
      return;
    }
    this.textRect = null;
    if (this.from && this.to && drawLineFns[this.name]) {
      drawLineFns[this.name].controlPointsFn(this);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.animateDot) {
      ctx.fillStyle = this.strokeStyle;
      if (this.animateType === 'dot') {
        ctx.beginPath();
        ctx.arc(this.animateDot.x, this.animateDot.y, this.animateDotSize, 0, 2 * Math.PI, false);
        ctx.fill();
        return;
      } else if (this.animateType === 'comet') {
        const bulles = this.getBubbles();
        ctx.save();
        for (const item of bulles) {
          ctx.globalAlpha = item.a;
          ctx.beginPath();
          ctx.arc(item.pos.x, item.pos.y, item.r, 0, 2 * Math.PI, false);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (!this.isAnimate && this.borderWidth > 0 && this.borderColor) {
      ctx.save();
      if (this.lineJoin) {
        ctx.lineJoin = this.lineJoin;
      }
      ctx.lineWidth = this.lineWidth + this.borderWidth;
      ctx.strokeStyle = this.borderColor;
      if (drawLineFns[this.name]) {
        drawLineFns[this.name].drawFn(ctx, this);
      }
      ctx.restore();
    }

    if ((!this.isAnimate || this.animateType !== 'comet') && drawLineFns[this.name]) {
      if (this.lineJoin) {
        ctx.lineJoin = this.lineJoin;
      }
      drawLineFns[this.name].drawFn(ctx, this);
    }

    const scale = Store.get(this.generateStoreKey('LT:scale')) || 1;
    if (this.fromArrow && drawArrowFns[this.fromArrow]) {
      ctx.save();
      ctx.beginPath();
      ctx.lineDashOffset = 0;
      ctx.setLineDash([]);
      ctx.fillStyle = this.fromArrowColor || this.strokeStyle || ctx.strokeStyle;
      ctx.strokeStyle = ctx.fillStyle;
      let f = this.to;
      if (this.name === 'curve') {
        f = getBezierPoint(
          0.95 - this.lineWidth / 100,
          this.to,
          this.controlPoints[1],
          this.controlPoints[0],
          this.from
        );
      } else if (this.name !== 'line' && this.controlPoints.length) {
        f = this.controlPoints[0];
      }
      drawArrowFns[this.fromArrow](ctx, f, this.from, this.fromArrowSize * scale);
      ctx.restore();
    }
    if (this.toArrow && drawArrowFns[this.toArrow]) {
      ctx.save();
      ctx.beginPath();
      ctx.lineDashOffset = 0;
      ctx.setLineDash([]);
      ctx.fillStyle = this.toArrowColor || this.strokeStyle || ctx.strokeStyle;
      ctx.strokeStyle = ctx.fillStyle;
      let f = this.from;
      if (this.name === 'curve') {
        f = getBezierPoint(
          0.95 - this.lineWidth / 100,
          this.from,
          this.controlPoints[0],
          this.controlPoints[1],
          this.to
        );
      } else if (this.name === 'mind') {
        f = getBezierPoint(
          0.96 - this.lineWidth / 100,
          this.from,
          this.controlPoints[0],
          this.controlPoints[1],
          this.controlPoints[2]
        );
      } else if (this.name !== 'line' && this.controlPoints.length) {
        f = this.controlPoints[this.controlPoints.length - 1];
      }
      drawArrowFns[this.toArrow](ctx, f, this.to, this.toArrowSize * scale);
      ctx.restore();
    }

    if (this.text && !this.isAnimate) {
      if (!this.textRect) {
        this.calcTextRect();
      }
      text(ctx, this);
    }
  }

  pointIn(pt: { x: number; y: number }) {
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

  calcTextRect() {
    const center = this.getCenter();
    let width = Math.abs(this.from.x - this.to.x);
    if (width < 100) {
      width = 100;
    }
    const height =
      this.font.lineHeight *
      this.font.fontSize *
      (this.textMaxLine || (this.text && this.text.split('\n').length) || 1);
    this.textRect = new Rect(center.x - width / 2, center.y - height / 2, width, height);
  }

  getTextRect() {
    // calc every time just in case text line is changed.
    this.calcTextRect();
    return this.textRect;
  }

  getCenter() {
    let center = new Point(this.from.x, this.from.y);
    switch (this.name) {
      case 'line':
        center = this.getLineCenter(this.from, this.to);
        break;
      case 'polyline':
        const i = Math.round(this.controlPoints.length / 2);
        center = this.getLineCenter(this.controlPoints[i - 1] || this.from, this.controlPoints[i] || this.to);
        break;
      case 'curve':
        center = getBezierPoint(0.5, this.to, this.controlPoints[1], this.controlPoints[0], this.from);
    }

    return center;
  }

  getLineCenter(from: Point, to: Point) {
    return new Point((from.x + to.x) / 2, (from.y + to.y) / 2);
  }

  getPointByPos(pos: number): Point {
    if (pos <= 0) {
      return this.from;
    }
    switch (this.name) {
      case 'line':
        return this.getLinePtByPos(this.from, this.to, pos);
      case 'polyline':
        if (!this.controlPoints || !this.controlPoints.length) {
          return this.getLinePtByPos(this.from, this.to, pos);
        } else {
          const points = [].concat(this.controlPoints, this.to);
          let curPt = this.from;
          for (const pt of points) {
            const l = lineLen(curPt, pt);
            if (pos > l) {
              pos -= l;
              curPt = pt;
            } else {
              return this.getLinePtByPos(curPt, pt, pos);
            }
          }
          return this.to;
        }
      case 'curve':
        return getBezierPoint(pos / this.getLen(), this.from, this.controlPoints[0], this.controlPoints[1], this.to);
    }
    return null;
  }

  getLinePtByPos(from: Point, to: Point, pos: number) {
    const length = lineLen(from, to);
    if (pos <= 0) {
      return from;
    }
    if (pos >= length) {
      return to;
    }
    let x: number, y: number;
    x = from.x + (to.x - from.x) * (pos / length);
    y = from.y + (to.y - from.y) * (pos / length);
    return new Point(x, y);
  }

  calcRectInParent(parent: Pen) {
    const parentW = parent.rect.width - parent.paddingLeftNum - parent.paddingRightNum;
    const parentH = parent.rect.height - parent.paddingTopNum - parent.paddingBottomNum;
    this.rectInParent = {
      x: ((this.from.x - parent.rect.x - parent.paddingLeftNum) * 100) / parentW + '%',
      y: ((this.from.y - parent.rect.y - parent.paddingTopNum) * 100) / parentH + '%',
      width: 0,
      height: 0,
      rotate: 0,
    };
  }

  // 根据父节点rect计算自己（子节点）的rect
  calcRectByParent(parent: Pen) {
    if (!this.rectInParent) {
      return;
    }
    const parentW = parent.rect.width - parent.paddingLeftNum - parent.paddingRightNum;
    const parentH = parent.rect.height - parent.paddingTopNum - parent.paddingBottomNum;
    let x =
      parent.rect.x +
      parent.paddingLeftNum +
      abs(parentW, this.rectInParent.x) +
      abs(parentW, this.rectInParent.marginLeft);
    let y =
      parent.rect.y +
      parent.paddingTopNum +
      abs(parentH, this.rectInParent.y) +
      abs(parentW, this.rectInParent.marginTop);

    if (this.rectInParent.marginLeft === undefined && this.rectInParent.marginRight) {
      x -= abs(parentW, this.rectInParent.marginRight);
    }
    if (this.rectInParent.marginTop === undefined && this.rectInParent.marginBottom) {
      y -= abs(parentW, this.rectInParent.marginBottom);
    }

    this.translate(x - this.from.x, y - this.from.y);
  }

  initAnimate() {
    this.animatePos = 0;
  }

  pauseAnimate() {
    Store.set(this.generateStoreKey('LT:AnimatePlay'), {
      pen: this,
      stop: true,
    });
  }

  stopAnimate() {
    this.pauseAnimate();
    this.initAnimate();
  }

  animate(now: number) {
    if (this.animateFromSize) {
      this.lineDashOffset = -this.animateFromSize;
    }
    this.animatePos += this.animateSpan;
    this.animateDot = null;
    switch (this.animateType) {
      case 'beads':
        this.lineDashOffset = -this.animatePos;
        let len = this.lineWidth;
        if (len < 5) {
          len = 5;
        }
        if (this.animateLineDash) {
          this.lineDash = this.animateLineDash;
        } else {
          this.lineDash = [len, len * 2];
        }
        break;
      case 'dot':
      case 'comet':
        this.lineDash = null;
        this.animateDot = this.getPointByPos(this.animatePos + this.animateFromSize);
        break;
      default:
        this.lineDash = [this.animatePos, this.length - this.animatePos + 1];
        break;
    }

    if (this.animatePos > this.length + this.animateSpan - this.animateFromSize - this.animateToSize) {
      if (++this.animateCycleIndex >= this.animateCycle && this.animateCycle > 0) {
        this.animateStart = 0;
        this.animatePos = 0;
        Store.set(this.generateStoreKey('animateEnd'), {
          type: 'line',
          data: this,
        });
        return;
      }

      this.animatePos = this.animateSpan;
    }
  }

  getBubbles() {
    const bubbles: any[] = [];
    for (let i = 0; i < 30 && this.animatePos - i > 0; ++i) {
      bubbles.push({
        pos: this.getPointByPos(this.animatePos - i * 2 + this.animateFromSize),
        a: 1 - i * 0.03,
        r: this.lineWidth - i * 0.01,
      });
    }

    return bubbles;
  }

  round() {
    this.from.round();
    this.to.round();
  }

  translate(x: number, y: number) {
    this.from.x += x;
    this.from.y += y;
    this.to.x += x;
    this.to.y += y;
    if (this.text) {
      this.textRect = null;
    }

    for (const pt of this.controlPoints) {
      pt.x += x;
      pt.y += y;
    }

    Store.set(this.generateStoreKey('pts-') + this.id, null);
  }

  scale(scale: number, center: Point) {
    this.from.x = center.x - (center.x - this.from.x) * scale;
    this.from.y = center.y - (center.y - this.from.y) * scale;
    this.to.x = center.x - (center.x - this.to.x) * scale;
    this.to.y = center.y - (center.y - this.to.y) * scale;
    this.lineWidth *= scale;
    this.borderWidth *= scale;
    this.font.fontSize *= scale;
    if (this.text) {
      this.textRect = null;
    }

    for (const pt of this.controlPoints) {
      pt.x = center.x - (center.x - pt.x) * scale;
      pt.y = center.y - (center.y - pt.y) * scale;
    }

    Store.set(this.generateStoreKey('pts-') + this.id, null);
  }

  hit(pt: Point, padding = 0): any {
    if (this.from.hit(pt, padding) || this.to.hit(pt, padding)) {
      return this;
    }
  }

  clone() {
    return new Line(this);
  }
}
