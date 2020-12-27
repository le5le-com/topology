import { Pen, PenType } from './pen';
import { Rect } from './rect';
import { Point } from './point';
import { Line } from './line';
import { anchorsFns, iconRectFns, textRectFns, drawNodeFns } from '../middles';
import { defaultAnchors } from '../middles/default.anchor';
import { defaultIconRect, defaultTextRect } from '../middles/default.rect';
import { text, iconfont } from '../middles/nodes/text';
import { Store } from 'le5le-store';
import { abs, distance } from '../utils/math';
import { s8 } from '../utils/uuid';
import { pointInRect } from '../utils/canvas';

export const images: {
  [key: string]: { img: HTMLImageElement; cnt: number };
} = {};

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
  imageAlign: string;
  img: HTMLImageElement;

  // 0 - 纯色；1 - 线性渐变；2 - 径向渐变
  bkType: number;
  gradientFromColor: string;
  gradientToColor: string;
  gradientAngle: number;
  gradientRadius: number;

  paddingTop: number | string;
  paddingBottom: number | string;
  paddingLeft: number | string;
  paddingRight: number | string;

  onlySizeX?: boolean;
  onlySizeY?: boolean;

  iconRect: Rect;
  fullIconRect: Rect;

  anchors: Point[] = [];
  rotatedAnchors: Point[] = [];

  children: Pen[];

  // nodes移动时，停靠点的参考位置
  dockWatchers: Point[];

  animateDuration = 0;
  animateFrames: {
    duration: number;
    start?: number;
    end?: number;
    initState?: Node;
    linear: boolean;
    state: Node;
  }[] = [];
  animateAlone: boolean;
  animateReady: Node;
  animateFrame = 0;
  private _animateFrame: number;
  private _animatePos: number;

  gif: boolean;
  video: string;
  audio: string;
  // 0 - 人工播放；1 - auto自动播放；2 - animate play
  play: number;
  playLoop: boolean;
  nextPlay: string;

  iframe: string;
  // 和节点绑定的（多是临时生成）的dom元素
  elementId: string;
  // 外部dom是否完成初始化（用于第三方库辅助变量）
  elementLoaded: any;
  // 外部dom是否已经渲染。当需要重绘时，设置为false（用于第三方库辅助变量）
  elementRendered: boolean;

  constructor(json: any, noChild = false) {
    super(json);

    this.type = PenType.Node;
    this.is3D = json.is3D;
    this.z = json.z;
    this.zRotate = json.zRotate || 0;

    this.borderRadius = +json.borderRadius || 0;

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
    this.imageAlign = json.imageAlign || 'center';

    this.bkType = json.bkType;
    this.gradientFromColor = json.gradientFromColor;
    this.gradientToColor = json.gradientToColor;
    this.gradientAngle = json.gradientAngle || 0;
    this.gradientRadius = json.gradientRadius || 0.01;

    this.paddingTop = json.paddingTop || 0;
    this.paddingBottom = json.paddingBottom || 0;
    this.paddingLeft = json.paddingLeft || 0;
    this.paddingRight = json.paddingRight || 0;

    this.onlySizeX = json.onlySizeX;
    this.onlySizeY = json.onlySizeY;

    // 兼容老数据
    if (json.children && json.children[0] && json.children[0].parentRect) {
      this.paddingLeft = json.children[0].parentRect.offsetX;
      this.paddingRight = 0;
      this.paddingTop = json.children[0].parentRect.offsetY;
      this.paddingBottom = 0;
    }

    if (json.parentRect) {
      this.rectInParent = {
        x: json.parentRect.x * 100 + '%',
        y: json.parentRect.y * 100 + '%',
        width: json.parentRect.width * 100 + '%',
        height: json.parentRect.height * 100 + '%',
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 0,
        rotate: json.parentRect.rotate,
      };
      this.paddingTop = json.parentRect.marginY;
      this.paddingBottom = json.parentRect.marginY;
      this.paddingLeft = json.parentRect.marginX;
      this.paddingRight = json.parentRect.marginX;
    }
    // 兼容老数据 end

    if (json.animateFrames) {
      this.animateFrames = json.animateFrames;
      for (const item of this.animateFrames) {
        if (!item.state.init) {
          item.state = new Node(item.state, true);
        }
      }
    }
    if (json.animateDuration) {
      this.animateDuration = json.animateDuration;
    }
    this.animateFrame = json.animateFrame || 0;
    this.animateType = json.animateType ? json.animateType : json.animateDuration ? 'custom' : '';
    this.animateAlone = json.animateAlone;

    this.iframe = json.iframe;
    this.elementId = json.elementId;
    this.audio = json.audio;
    this.video = json.video;
    this.play = json.play;
    this.nextPlay = json.nextPlay;

    if (json.elementLoaded !== undefined) {
      this.elementId = null;
      this.elementLoaded = false;
    }

    this.init();

    if (!noChild) {
      this.setChild(json.children);
    } else {
      this.children = null;
    }
  }

  static cloneState(json: any) {
    const n = new Node(json);
    delete n.animateFrames;
    return n;
  }

  restore(state?: Node) {
    if (!state) {
      state = this.animateReady;
    }
    if (!state) {
      return;
    }
    for (const key in this) {
      if (key.indexOf('animate') < 0) {
        this[key] = (state as any)[key];
      }
    }

    this.init();
  }

  init() {
    this.calcAbsPadding();

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
    this.elementRendered = false;

    this.addToDiv();
  }

  addToDiv() {
    if (this.audio || this.video || this.iframe || this.elementId || this.hasGif()) {
      Store.set(this.generateStoreKey('LT:addDiv'), this);
    }
  }

  hasGif() {
    if (this.gif) {
      return true;
    }

    if (this.children) {
      for (const item of this.children) {
        if (item.type === PenType.Node && (item as Node).hasGif()) {
          return true;
        }
      }
    }

    return false;
  }

  calcAbsPadding() {
    this.paddingLeftNum = abs(this.rect.width, this.paddingLeft);
    this.paddingRightNum = abs(this.rect.width, this.paddingRight);
    this.paddingTopNum = abs(this.rect.height, this.paddingTop);
    this.paddingBottomNum = abs(this.rect.height, this.paddingBottom);
  }

  setChild(children: any[]) {
    if (!children) {
      return;
    }

    this.children = [];
    for (const item of children) {
      let child: Pen;
      switch (item.type) {
        case PenType.Line:
          child = new Line(item);
          child.calcRectByParent(this);
          break;
        default:
          child = new Node(item);
          child.parentId = this.id;
          child.calcRectByParent(this);
          (child as Node).init();
          (child as Node).setChild(item.children);
          break;
      }
      this.children.push(child);
    }
  }

  setTID(id: string) {
    this.TID = id;

    if (!this.children) {
      return;
    }

    for (const item of this.children) {
      this.TID = id;
      switch (item.type) {
        case PenType.Node:
          (item as Node).setTID(id);
          break;
      }
    }

    return this;
  }

  setChildrenIds() {
    if (!this.children) {
      return;
    }

    for (const item of this.children) {
      item.id = s8();
      switch (item.type) {
        case PenType.Node:
          (item as Node).setChildrenIds();
          break;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!drawNodeFns[this.name]) {
      return;
    }

    // DrawBk
    switch (this.bkType) {
      case 1:
        this.drawBkLinearGradient(ctx);
        break;
      case 2:
        this.drawBkRadialGradient(ctx);
        break;
    }

    // Draw shape.
    drawNodeFns[this.name](ctx, this);

    // Draw text.
    if (this.name !== 'text' && this.text) {
      text(ctx, this);
    }

    // Draw image.
    if (this.image) {
      this.drawImg(ctx);
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

  drawBkLinearGradient(ctx: CanvasRenderingContext2D) {
    const from = new Point(this.rect.x, this.rect.center.y);
    const to = new Point(this.rect.ex, this.rect.center.y);
    if (this.gradientAngle % 90 === 0 && this.gradientAngle % 180) {
      if (this.gradientAngle % 270) {
        from.x = this.rect.center.x;
        from.y = this.rect.y;
        to.x = this.rect.center.x;
        to.y = this.rect.ey;
      } else {
        from.x = this.rect.center.x;
        from.y = this.rect.ey;
        to.x = this.rect.center.x;
        to.y = this.rect.y;
      }
    } else if (this.gradientAngle) {
      from.rotate(this.gradientAngle, this.rect.center);
      to.rotate(this.gradientAngle, this.rect.center);
    }

    // contributor: https://github.com/sunnyguohua/topology
    const grd = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    grd.addColorStop(0, this.gradientFromColor);
    grd.addColorStop(1, this.gradientToColor);
    ctx.fillStyle = grd;
  }

  drawBkRadialGradient(ctx: CanvasRenderingContext2D) {
    let r = this.rect.width;
    if (r < this.rect.height) {
      r = this.rect.height;
    }
    r *= 0.5;
    const grd = ctx.createRadialGradient(
      this.rect.center.x,
      this.rect.center.y,
      r * this.gradientRadius,
      this.rect.center.x,
      this.rect.center.y,
      r
    );
    grd.addColorStop(0, this.gradientFromColor);
    grd.addColorStop(1, this.gradientToColor);

    ctx.fillStyle = grd;
  }

  drawImg(ctx: CanvasRenderingContext2D) {
    if (this.lastImage !== this.image) {
      this.img = null;
      if (this.lastImage && this.lastImage.indexOf('.gif') > 0) {
        Store.set(this.generateStoreKey('LT:addDiv'), this);
      }
    }

    const gif = this.image.indexOf('.gif') > 0;

    if (!gif && this.img) {
      ctx.save();
      ctx.shadowColor = '';
      ctx.shadowBlur = 0;

      const rect = this.getIconRect();
      let x = rect.x;
      let y = rect.y;
      let w = rect.width;
      let h = rect.height;
      if (this.imageWidth) {
        w = this.imageWidth;
      }
      if (this.imageHeight) {
        h = this.imageHeight;
      }
      if (this.imageRatio) {
        if (this.imageWidth) {
          h = (this.imgNaturalHeight / this.imgNaturalWidth) * w;
        } else {
          w = (this.imgNaturalWidth / this.imgNaturalHeight) * h;
        }
      }
      if (this.name !== 'image') {
        x += (rect.width - w) / 2;
        y += (rect.height - h) / 2;
      }
      switch (this.imageAlign) {
        case 'top':
          y = rect.y;
          break;
        case 'bottom':
          y = rect.ey - h;
          break;
        case 'left':
          x = rect.x;
          break;
        case 'right':
          x = rect.ex - w;
          break;
        case 'left-top':
          x = rect.x;
          y = rect.y;
          break;
        case 'right-top':
          x = rect.ex - w;
          y = rect.y;
          break;
        case 'left-bottom':
          x = rect.x;
          y = rect.ey - h;
          break;
        case 'right-bottom':
          x = rect.ex - w;
          y = rect.ey - h;
          break;
      }
      ctx.drawImage(this.img, x, y, w, h);
      ctx.restore();
      return;
    }

    // Load image and draw it.
    if (!gif && images[this.image]) {
      this.img = images[this.image].img;
      ++images[this.image].cnt;

      this.lastImage = this.image;
      this.imgNaturalWidth = this.img.naturalWidth;
      this.imgNaturalHeight = this.img.naturalHeight;
      this.drawImg(ctx);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      this.lastImage = this.image;
      this.imgNaturalWidth = img.naturalWidth;
      this.imgNaturalHeight = img.naturalHeight;
      this.img = img;
      images[this.image] = {
        img,
        cnt: 1,
      };
      Store.set(this.generateStoreKey('LT:imageLoaded'), true);
      if (!this.gif && gif) {
        this.gif = true;
        Store.set(this.generateStoreKey('LT:addDiv'), this);
      }
    };
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
    const w = abs(parentW, this.rectInParent.width);
    const h = abs(parentH, this.rectInParent.height);
    if (this.rectInParent.marginLeft === undefined && this.rectInParent.marginRight) {
      x -= abs(parentW, this.rectInParent.marginRight);
    }
    if (this.rectInParent.marginTop === undefined && this.rectInParent.marginBottom) {
      y -= abs(parentW, this.rectInParent.marginBottom);
    }
    this.rect = new Rect(x, y, w, h);

    if (!this.rectInParent.rotate) {
      this.rectInParent.rotate = 0;
    }

    const offsetR = parent.rotate + parent.offsetRotate;
    this.rotate = this.rectInParent.rotate + offsetR;

    if (!this.rectInParent.rect) {
      this.rectInParent.rect = this.rect.clone();
    }
  }

  calcChildrenRect() {
    if (!this.children) {
      return;
    }
    for (const item of this.children) {
      item.calcRectByParent(this);
      if (item.type === PenType.Node) {
        (item as Node).init();
        (item as Node).calcChildrenRect();
      }
    }
  }

  calcRectInParent(parent: Pen) {
    const parentW = parent.rect.width - parent.paddingLeftNum - parent.paddingRightNum;
    const parentH = parent.rect.height - parent.paddingTopNum - parent.paddingBottomNum;
    this.rectInParent = {
      x: ((this.rect.x - parent.rect.x - parent.paddingLeftNum) * 100) / parentW + '%',
      y: ((this.rect.y - parent.rect.y - parent.paddingTopNum) * 100) / parentH + '%',
      width: (this.rect.width * 100) / parentW + '%',
      height: (this.rect.height * 100) / parentH + '%',
      rotate: this.rectInParent ? this.rectInParent.rotate || 0 : this.rotate || 0,
      rect: this.rect.clone(),
    };
  }

  getDockWatchers() {
    this.dockWatchers = this.rect.toPoints();
    this.dockWatchers.unshift(this.rect.center);
  }

  initAnimate() {
    let passed = 0;
    for (let i = 0; i < this.animateFrames.length; ++i) {
      this.animateFrames[i].start = passed;
      passed += this.animateFrames[i].duration;
      this.animateFrames[i].end = passed;
      this.animateFrames[i].initState = Node.cloneState(i ? this.animateFrames[i - 1].state : this);
    }
    this.animateDuration = passed;

    this.animateReady = Node.cloneState(this);

    this.animatePos = 0;
    this.animateFrame = 0;
  }

  pauseAnimate() {
    this.animateFrame = this._animateFrame;
    this.animatePos = this._animatePos;
    Store.set(this.generateStoreKey('LT:AnimatePlay'), {
      pen: this,
      stop: true,
    });
  }

  stopAnimate() {
    this.restore();
    this.initAnimate();
    Store.set(this.generateStoreKey('LT:AnimatePlay'), {
      pen: this,
      stop: true,
    });
    Store.set(this.generateStoreKey('LT:render'), {
      pen: this,
      stop: true,
    });
  }

  animate(now: number) {
    let timeline = now - this.animateStart;

    if (this.animateFrame > 0) {
      this.animateFrames.forEach((item, index) => {
        if (this.animateFrame < index + 1) {
          timeline += item.duration;
        }
      });

      timeline += this.animatePos;
    }

    // Finished on animate.
    if (timeline > this.animateDuration) {
      this.animatePos = 0;
      this.animateFrame = 0;
      if (++this.animateCycleIndex >= this.animateCycle && this.animateCycle > 0) {
        this.animateStart = 0;
        this.animateCycleIndex = 0;
        const item = this.animateFrames[this.animateFrames.length - 1];
        if (item) {
          this.restore(item.state);
        }
        Store.set(this.generateStoreKey('animateEnd'), {
          type: 'node',
          data: this,
        });
        return;
      }
      this.animateStart = now;
      timeline = 0;
    }

    let rectChanged = false;

    for (let i = 0; i < this.animateFrames.length; ++i) {
      const item = this.animateFrames[i];
      if (timeline >= item.start && timeline < item.end) {
        this.dash = item.state.dash;
        this.strokeStyle = item.state.strokeStyle;
        this.fillStyle = item.state.fillStyle;
        this.text = item.state.text;
        this.font = item.state.font;
        this.iconFamily = item.state.iconFamily;
        this.icon = item.state.icon;
        this.iconSize = item.state.iconSize;
        this.iconColor = item.state.iconColor;
        this.visible = item.state.visible;

        this._animateFrame = i + 1;
        if (this._animateFrame > this.animateFrame) {
          this.animateFrame = 0;
          this.animatePos = 0;
        }
        this._animatePos = timeline - item.start;
        const rate = this._animatePos / item.duration;

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
          this.rect.calcCenter();

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
          if (item.state.lineDashOffset) {
            if (!this.lineDashOffset) {
              this.lineDashOffset = item.state.lineDashOffset;
            } else {
              this.lineDashOffset += item.state.lineDashOffset;
            }
          }

          if (item.state.value !== item.initState.value) {
            this.value = (item.initState.value || 0) + ((item.state.value || 0) - (item.initState.value || 0)) * rate;
          }
        } else {
          this.rect = item.state.rect;
          this.lineWidth = item.state.lineWidth;
          this.rotate = item.state.rotate;
          this.globalAlpha = item.state.globalAlpha;
          this.lineDashOffset = item.state.lineDashOffset;
        }
      }
    }

    if (rectChanged) {
      this.init();
      if (!this.animateAlone) {
        Store.set(this.generateStoreKey('LT:rectChanged'), this);
      }
    }
  }

  scale(scale: number, center?: Point) {
    if (!center) {
      center = this.rect.center;
    }
    this.rect.x = center.x - (center.x - this.rect.x) * scale;
    this.rect.y = center.y - (center.y - this.rect.y) * scale;
    this.z *= scale;
    this.rect.width *= scale;
    this.rect.height *= scale;
    this.rect.ex = this.rect.x + this.rect.width;
    this.rect.ey = this.rect.y + this.rect.height;
    if (this.imageWidth) {
      this.imageWidth *= scale;
    }
    if (this.imageHeight) {
      this.imageHeight *= scale;
    }
    this.lastImage = null;
    this.font.fontSize *= scale;
    this.iconSize *= scale;
    if (typeof this.paddingLeft === 'number') {
      this.paddingLeft *= scale;
    }
    if (typeof this.paddingTop === 'number') {
      this.paddingTop *= scale;
    }
    if (typeof this.paddingRight === 'number') {
      this.paddingRight *= scale;
    }
    if (typeof this.paddingBottom === 'number') {
      this.paddingBottom *= scale;
    }

    if (this.rectInParent) {
      if (typeof this.rectInParent.x === 'number') {
        this.rectInParent.x *= scale;
      }
      if (typeof this.rectInParent.y === 'number') {
        this.rectInParent.y *= scale;
      }
      if (typeof this.rectInParent.width === 'number') {
        this.rectInParent.width *= scale;
      }
      if (typeof this.rectInParent.height === 'number') {
        this.rectInParent.height *= scale;
      }
      if (typeof this.rectInParent.marginLeft === 'number') {
        this.rectInParent.marginLeft *= scale;
      }
      if (typeof this.rectInParent.marginTop === 'number') {
        this.rectInParent.marginTop *= scale;
      }
      if (typeof this.rectInParent.marginRight === 'number') {
        this.rectInParent.marginRight *= scale;
      }
      if (typeof this.rectInParent.marginBottom === 'number') {
        this.rectInParent.marginBottom *= scale;
      }
    }

    this.rect.calcCenter();

    if (this.animateFrames && this.animateFrames.length) {
      for (const item of this.animateFrames) {
        if (item.initState) {
          item.initState.scale(scale, center);
        }
        if (item.state) {
          item.state.scale(scale, center);
        }

        // fix bug
        item.state.font.fontSize = item.initState.font.fontSize;
      }
    }

    this.elementRendered = false;
    this.init();

    if (this.children) {
      for (const item of this.children) {
        item.scale(scale, center);
      }
    }

    if (this.animateReady) {
      this.animateReady.scale(scale, center);
    }
  }

  translate(x: number, y: number) {
    this.rect.x += x;
    this.rect.y += y;
    this.rect.ex = this.rect.x + this.rect.width;
    this.rect.ey = this.rect.y + this.rect.height;
    this.rect.calcCenter();

    if (this.animateFrames && this.animateFrames.length) {
      for (const frame of this.animateFrames) {
        const { initState, state } = frame;
        if (initState && initState.translate) {
          initState.translate(x, y);
        }
        if (state && state.translate) {
          state.translate(x, y);
        }
      }
    }

    this.init();

    if (this.children) {
      for (const item of this.children) {
        item.translate(x, y);
      }
    }

    if (this.animateReady) {
      this.animateReady.translate(x, y);
    }
  }

  initRect() {
    this.rect.init();
    if (this.children) {
      this.calcChildrenRect();
      for (const item of this.children) {
        if (item instanceof Node) {
          item.initRect();
        }
      }
    }
  }

  nearestAnchor(pt: Point) {
    let dis = 99999;
    let index = 0;
    for (let i = 0; i < this.rotatedAnchors.length; ++i) {
      const d = distance(pt, this.rotatedAnchors[i]);
      if (dis > d) {
        dis = d;
        index = i;
      }
    }

    return {
      index,
      direction: this.rotatedAnchors[index].direction,
    };
  }

  hitInSelf(point: { x: number; y: number }, padding = 0) {
    if (this.rotate % 360 === 0) {
      return this.rect.hit(point, padding);
    }

    const pts = this.rect.toPoints();
    for (const pt of pts) {
      pt.rotate(this.rotate, this.rect.center);
    }
    return pointInRect(point, pts);
  }

  hit(pt: { x: number; y: number }, padding = 0) {
    let node: any;
    if (this.hitInSelf(pt, padding)) {
      node = this;
    }

    if (this.children) {
      const len = this.children.length;
      for (let i = len - 1; i > -1; --i) {
        const pen = this.children[i];
        const p = pen.hit(pt, padding);
        if (p) {
          node = p;
          break;
        }
      }
    }

    return node;
  }

  round() {
    this.rect.round();
    if (this.children) {
      for (const item of this.children) {
        item.rect.round();
      }
    }
  }

  clone() {
    const n = new Node(this);
    n.setTID(this.TID);
    this.setChildrenIds();
    return n;
  }
}
