import { Pen } from './pen';
import { Rect } from './rect';
import { Point } from './point';
import { anchorsFns, iconRectFns, textRectFns, drawNodeFns } from '../middles';
import { defaultAnchors } from '../middles/default.anchor';
import { defaultIconRect, defaultTextRect } from '../middles/default.rect';
import { text, iconfont } from '../middles/nodes/text';
import { Store } from 'le5le-store';

export class Node extends Pen {
  is3D = false;
  z: number;
  zRotate = 0;

  // 0 -1 之间的小数
  borderRadius: number;

  // icon
  icon: string;
  iconFamily: string;
  iconSize: number;
  iconColor: string;

  image: string;
  lastImage: string;
  imgNaturalWidth: number;
  imgNaturalHeight: number;
  imageWidth: number;
  imageHeight: number;
  imageRatio = true;
  private img: HTMLImageElement;

  iconRect: Rect;
  fullIconRect: Rect;

  text: string;
  textMaxLine: number;
  textRect: Rect;
  fullTextRect: Rect;

  anchors: Point[] = [];
  rotatedAnchors: Point[] = [];
  parentId: string;
  parentRect: {
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    marginX: number;
    marginY: number;
    rotate: number;
  };
  children: Node[];

  // nodes移动时，停靠点的参考位置
  dockWatchers: Point[];

  // animateType仅仅是辅助标识
  animateType = 0;
  animateDuration = 0;
  animateFrames: {
    duration: number;
    start?: number;
    end?: number;
    initState?: Node;
    linear: boolean;
    state: Node;
  }[] = [];

  constructor(json: any) {
    super(json);

    this.is3D = json.is3D;
    this.z = json.z;
    this.zRotate = json.zRotate || 0;

    this.borderRadius = +json.borderRadius || 0;
    if (this.borderRadius > 1) {
      this.borderRadius = 1;
    }

    this.icon = json.icon;
    this.iconFamily = json.iconFamily;
    this.iconSize = +json.iconSize;
    this.iconColor = json.iconColor;

    this.image = json.image;
    if (json.imgNaturalWidth) {
      this.imgNaturalWidth = json.imgNaturalWidth;
    }
    if (json.imgNaturalHeight) {
      this.imgNaturalHeight = json.imgNaturalHeight;
    }
    if (json.imageWidth) {
      this.imageWidth = json.imageWidth;
    }
    if (json.imageHeight) {
      this.imageHeight = json.imageHeight;
    }
    this.imageRatio = json.imageRatio;

    this.text = json.text;
    if (json.textMaxLine) {
      this.textMaxLine = +json.textMaxLine || 0;
    }
    if (json.parentRect) {
      this.parentRect = json.parentRect;
    }
    if (json.animateFrames) {
      this.animateFrames = json.animateFrames;
    }
    if (json.animateDuration) {
      this.animateDuration = json.animateDuration;
    }
    this.animateType = json.animateType ? json.animateType : json.animateDuration ? '8' : '';
    this.init();

    this.setChild(json);
  }

  static cloneState(json: any) {
    const n = new Node(json);
    delete n.animateFrames;
    return n;
  }

  init() {
    // Calc rect of text.
    if (textRectFns[this.name]) {
      textRectFns[this.name](this);
    } else {
      defaultTextRect(this);
    }

    // Calc rect of icon.
    if (iconRectFns[this.name]) {
      iconRectFns[this.name](this);
    } else {
      defaultIconRect(this);
    }

    this.calcAnchors();
  }

  setChild(json: any) {
    if (!json.children) {
      return;
    }

    this.children = [];
    for (let i = 0; i < json.children.length; ++i) {
      const child = new Node(json.children[i]);
      child.parentId = this.id;
      child.calcChildRect(this);
      child.init();
      child.setChild(json.children[i]);
      this.children.push(child);
    }
  }

  // 根据父节点rect计算自己（子节点）的rect.
  // parent - 父节点.
  // this.parentRect.offsetX - 固定偏移像素。
  // this.parentRect.x - 除去固定偏移像素后，偏移百分比。
  calcChildRect(parent: Node) {
    this.rect = new Rect(
      parent.rect.x +
        this.parentRect.offsetX +
        this.parentRect.marginX +
        (parent.rect.width - this.parentRect.offsetX) * this.parentRect.x,
      parent.rect.y +
        this.parentRect.offsetY +
        this.parentRect.marginY +
        (parent.rect.height - this.parentRect.offsetY) * this.parentRect.y,
      (parent.rect.width - this.parentRect.offsetX) * this.parentRect.width - 2 * this.parentRect.marginX,
      (parent.rect.height - this.parentRect.offsetY) * this.parentRect.height - 2 * this.parentRect.marginY
    );

    if (!this.parentRect.rotate) {
      this.parentRect.rotate = 0;
    }

    const nodeCenter = this.rect.center.clone();
    nodeCenter.rotate(parent.rotate + parent.offsetRotate, parent.rect.center);
    this.rect.x = nodeCenter.x - this.rect.width / 2;
    this.rect.y = nodeCenter.y - this.rect.height / 2;
    this.rect.ex = this.rect.x + this.rect.width;
    this.rect.ey = this.rect.y + this.rect.height;
    this.rect.calceCenter();
    this.rotate = this.parentRect.rotate + parent.rotate + parent.offsetRotate;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!drawNodeFns[this.name]) {
      return;
    }

    // Draw shape.
    drawNodeFns[this.name](ctx, this);

    // Draw text.
    if (this.name !== 'text' && this.text) {
      ctx.save();
      ctx.shadowColor = '';
      ctx.shadowBlur = 0;
      text(ctx, this);
      ctx.restore();
    }

    // Draw image.
    if (this.image) {
      if (this.lastImage !== this.image) {
        this.img = null;
      }
      this.lastImage = this.image;

      // There is the cache of image.
      if (this.img) {
        this.drawImg(ctx);
        return;
      } else {
        // Load image and draw it.
        this.img = new Image();
        this.img.crossOrigin = 'anonymous';
        this.img.src = this.image;
        this.img.onload = () => {
          this.imgNaturalWidth = this.img.naturalWidth;
          this.imgNaturalHeight = this.img.naturalHeight;
          this.drawImg(ctx);
          this.emitRender();
        };
      }

      return;
    }

    // Draw icon
    if (this.icon) {
      ctx.save();
      ctx.shadowColor = '';
      ctx.shadowBlur = 0;
      iconfont(ctx, this);
      ctx.restore();
    }
  }

  drawImg(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;

    const rect = this.getIconRect().clone();
    const w = rect.width;
    const h = rect.height;
    if (this.imageWidth) {
      rect.width = this.imageWidth;
    }
    if (this.imageHeight) {
      rect.height = this.imageHeight;
    }
    if (this.imageRatio) {
      if (this.imageWidth) {
        rect.height = (this.imgNaturalHeight / this.imgNaturalWidth) * rect.width;
      } else {
        rect.width = (this.imgNaturalWidth / this.imgNaturalHeight) * rect.height;
      }
    }
    if (this.name !== 'image') {
      rect.x += (w - rect.width) / 2;
      rect.y += (h - rect.height) / 2;
    }

    ctx.drawImage(this.img, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  emitRender() {
    Store.set('render', 1);
  }

  calcAnchors() {
    this.anchors = [];
    if (anchorsFns[this.name]) {
      anchorsFns[this.name](this);
    } else {
      defaultAnchors(this);
    }

    this.calcRotateAnchors();
  }

  calcRotateAnchors(angle?: number) {
    if (angle === undefined) {
      angle = this.rotate;
    }
    this.rotatedAnchors = [];
    for (const item of this.anchors) {
      this.rotatedAnchors.push(item.clone().rotate(angle, this.rect.center));
    }
  }

  getTextRect() {
    let textRect = this.textRect;
    if (!this.icon && !this.image) {
      textRect = this.fullTextRect;
    }

    return textRect;
  }

  getIconRect() {
    let rect = this.iconRect;
    if (!this.text) {
      rect = this.fullIconRect || this.fullTextRect || this.rect;
    }

    return rect;
  }

  getDockWatchers() {
    this.dockWatchers = this.rect.toPoints();
    this.dockWatchers.unshift(this.rect.center);
  }

  clearImg() {
    this.img = null;
  }

  updateAnimateProps() {
    let passed = 0;
    for (let i = 0; i < this.animateFrames.length; ++i) {
      this.animateFrames[i].start = passed;
      passed += this.animateFrames[i].duration;
      this.animateFrames[i].end = passed;
      this.animateFrames[i].initState = Node.cloneState(i ? this.animateFrames[i - 1].state : this);
    }
  }

  animate(ctx: CanvasRenderingContext2D, now: number) {
    let timeline = now - this.animateStart;
    if (timeline > this.animateDuration) {
      if (++this.animateCycleIndex >= this.animateCycle && this.animateCycle > 0) {
        this.animateStart = 0;
        this.animateCycleIndex = 0;
        const item = this.animateFrames[this.animateFrames.length - 1];
        this.dash = item.state.dash;
        this.strokeStyle = item.state.strokeStyle;
        this.fillStyle = item.state.fillStyle;
        this.font = item.state.font;

        this.lineWidth = item.state.lineWidth;
        this.rotate = item.state.rotate;
        this.globalAlpha = item.state.globalAlpha;
        if (item.state.rect && item.state.rect.width) {
          this.rect = new Rect(item.state.rect.x, item.state.rect.y, item.state.rect.width, item.state.rect.height);
          this.init();
        }
        Store.set('animateEnd', {
          type: 'node',
          data: this
        });
        return this.nextAnimate;
      }
      this.animateStart = now;
      timeline = 0;
      this.animateFrames[0].initState = Node.cloneState(this);
    }

    let rectChanged = false;
    for (let i = 0; i < this.animateFrames.length; ++i) {
      const item = this.animateFrames[i];
      if (timeline >= item.start && timeline < item.end) {
        this.dash = item.state.dash;
        this.strokeStyle = item.state.strokeStyle;
        this.fillStyle = item.state.fillStyle;
        this.font = item.state.font;

        const rate = (timeline - item.start) / item.duration;

        if (item.linear) {
          if (item.state.rect.x !== item.initState.rect.x) {
            this.rect.x = item.initState.rect.x + (item.state.rect.x - item.initState.rect.x) * rate;
            rectChanged = true;
          }
          if (item.state.rect.y !== item.initState.rect.y) {
            this.rect.y = item.initState.rect.y + (item.state.rect.y - item.initState.rect.y) * rate;
            rectChanged = true;
          }
          if (item.state.rect.width !== item.initState.rect.width) {
            this.rect.width = item.initState.rect.width + (item.state.rect.width - item.initState.rect.width) * rate;
            rectChanged = true;
          }
          if (item.state.rect.height !== item.initState.rect.height) {
            this.rect.height =
              item.initState.rect.height + (item.state.rect.height - item.initState.rect.height) * rate;
            rectChanged = true;
          }
          this.rect.ex = this.rect.x + this.rect.width;
          this.rect.ey = this.rect.y + this.rect.height;
          this.rect.calceCenter();

          if (item.initState.z !== undefined && item.state.z !== item.initState.z) {
            this.z = item.initState.z + (item.state.z - item.initState.z) * rate;
            rectChanged = true;
          }

          if (item.state.borderRadius !== item.initState.borderRadius) {
            this.borderRadius =
              item.initState.borderRadius + (item.state.borderRadius - item.initState.borderRadius) * rate;
          }

          if (item.state.lineWidth !== item.initState.lineWidth) {
            this.lineWidth = item.initState.lineWidth + (item.state.lineWidth - item.initState.lineWidth) * rate;
          }

          if (item.state.rotate !== item.initState.rotate) {
            this.rotate = item.initState.rotate + (item.state.rotate - item.initState.rotate) * rate;
            rectChanged = true;
          }

          if (item.state.globalAlpha !== item.initState.globalAlpha) {
            this.globalAlpha =
              item.initState.globalAlpha + (item.state.globalAlpha - item.initState.globalAlpha) * rate;
          }
        } else {
          this.rect = item.state.rect;
          this.lineWidth = item.state.lineWidth;
          this.rotate = item.state.rotate;
          this.globalAlpha = item.state.globalAlpha;
        }
      }
    }
    if (rectChanged) {
      this.init();
      Store.set('nodeMovedInAnimate', this);
    }

    this.render(ctx);
  }

  scale(scale: number, center?: Point) {
    if (!center) {
      center = this.rect.center;
    }
    this.rect.x = center.x - (center.x - this.rect.x) * scale;
    this.rect.y = center.y - (center.y - this.rect.y) * scale;
    this.rect.width *= scale;
    this.rect.height *= scale;
    if (this.imageWidth) {
      this.imageWidth *= scale;
    }
    if (this.imageHeight) {
      this.imageHeight *= scale;
    }
    this.font.fontSize *= scale;
    this.iconSize *= scale;
    this.rect.ex = this.rect.x + this.rect.width;
    this.rect.ey = this.rect.y + this.rect.height;
    this.rect.calceCenter();
    this.init();

    if (this.children) {
      for (const item of this.children) {
        item.scale(scale, center);
      }
    }
  }

  round() {
    this.rect.round();
    if (this.children) {
      for (const item of this.children) {
        item.rect.round();
      }
    }
  }
}
