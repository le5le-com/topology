import { Store } from 'le5le-store';

import { s8 } from '../utils/uuid';
import { Point } from './point';
import { Rect } from './rect';
import { EventType, EventAction } from './event';

import { Lock } from './status';
import { pentagon } from '../middles/nodes/pentagon';

export enum PenType {
  Node,
  Line,
}

export abstract class Pen {
  TID: string;
  id: string;
  type = PenType.Node;
  name: string;
  tags: string[];
  rect: Rect = new Rect(0, 0, 0, 0);
  lineWidth = 1;
  rotate = 0;
  offsetRotate = 0;
  globalAlpha = 1;

  dash = 0;
  lineDash: number[];
  lineDashOffset: number;
  strokeStyle = '';
  fillStyle = '';
  lineCap: string;
  font = {
    color: '',
    fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
    fontSize: 12,
    lineHeight: 1.5,
    fontStyle: 'normal',
    fontWeight: 'normal',
    textAlign: 'center',
    textBaseline: 'middle',
    background: '',
  };

  text: string;
  textMaxLine: number;
  whiteSpace: string;
  autoRect: boolean;
  textRect: Rect;
  fullTextRect: Rect;
  textOffsetX: number;
  textOffsetY: number;

  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;

  animateFn: string | Function;
  // animateType仅仅是辅助标识
  animateType: string;
  // Date.getTime
  animateStart: number;
  // Cycle count. Infinite if <= 0.
  animateCycle: number;
  animateCycleIndex = 0;
  nextAnimate: string;
  // Auto-play
  animatePlay: boolean;

  animatePos = 0;

  locked: Lock;
  // 作为子节点，是否可以直接点击选中
  stand: boolean;
  hideInput: boolean;
  hideRotateCP: boolean;
  hideSizeCP: boolean;
  hideAnchor: boolean;

  markdown: string;
  // 外部用于提示的dom id
  tipId: string;
  title: string;

  events: { type: EventType; action: EventAction; value: string; params: string; name?: string }[] = [];
  private eventFns: string[] = ['link', 'doStartAnimate', 'doFn', 'doWindowFn', '', 'doPauseAnimate', 'doStopAnimate'];

  parentId: string;
  rectInParent: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
    marginTop?: number | string;
    marginRight?: number | string;
    marginBottom?: number | string;
    marginLeft?: number | string;
    rotate: number;
    rect?: Rect;
  };

  paddingTopNum: number;
  paddingBottomNum: number;
  paddingLeftNum: number;
  paddingRightNum: number;

  visible: boolean;

  // User data.
  data: any;
  value: number;
  constructor(json?: any) {
    if (json) {
      this.TID = json.TID;
      this.id = json.id || s8();
      this.name = json.name || '';
      this.value = json.value;
      this.tags = Object.assign([], json.tags);
      if (json.rect) {
        this.rect = new Rect(json.rect.x, json.rect.y, json.rect.width, json.rect.height);
      }
      this.dash = json.dash || 0;
      this.lineDash = json.lineDash;
      this.lineDashOffset = json.lineDashOffset || 0;
      this.lineWidth = json.lineWidth || 1;
      this.strokeStyle = json.strokeStyle || '';
      this.fillStyle = json.fillStyle || '';
      this.lineCap = json.lineCap;
      this.globalAlpha = json.globalAlpha || 1;
      this.rotate = json.rotate || 0;
      this.offsetRotate = json.offsetRotate || 0;
      if (json.font) {
        Object.assign(this.font, json.font);
      }
      this.text = json.text;
      if (json.textMaxLine) {
        this.textMaxLine = +json.textMaxLine || 0;
      }
      this.whiteSpace = json.whiteSpace;
      this.autoRect = json.autoRect;
      this.textOffsetX = json.textOffsetX || 0;
      this.textOffsetY = json.textOffsetY || 0;

      this.shadowColor = json.shadowColor;
      this.shadowBlur = json.shadowBlur;
      this.shadowOffsetX = json.shadowOffsetX;
      this.shadowOffsetY = json.shadowOffsetY;

      this.animateType = json.animateType;
      this.animateCycle = json.animateCycle;
      this.nextAnimate = json.nextAnimate;
      this.animatePlay = json.animatePlay;
      this.animatePos = json.animatePos || 0;

      this.locked = json.locked;
      this.stand = json.stand;
      this.hideInput = json.hideInput;
      this.hideRotateCP = json.hideRotateCP;
      this.hideSizeCP = json.hideSizeCP;
      this.hideAnchor = json.hideAnchor;
      if (json.events) {
        this.events = JSON.parse(JSON.stringify(json.events));
      } else {
        this.events = [];
      }

      this.markdown = json.markdown;
      this.tipId = json.tipId;
      this.title = json.title;
      this.visible = json.visible !== false;

      if (json.rectInParent) {
        this.rectInParent = json.rectInParent;
      }

      if (typeof json.data === 'object') {
        this.data = JSON.parse(JSON.stringify(json.data));
      } else {
        this.data = json.data || '';
      }
    } else {
      this.id = s8();
      this.textOffsetX = 0;
      this.textOffsetY = 0;
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (!this.visible) {
      return;
    }

    if ((this as any).from && !(this as any).to) {
      return;
    }

    ctx.save();

    // for canvas2svg
    if ((ctx as any).setAttrs) {
      (ctx as any).setAttrs(this);
    }

    if (this.rotate || this.offsetRotate) {
      ctx.translate(this.rect.center.x, this.rect.center.y);
      ctx.rotate(((this.rotate + this.offsetRotate) * Math.PI) / 180);
      ctx.translate(-this.rect.center.x, -this.rect.center.y);
    }

    if (this.lineWidth > 1) {
      ctx.lineWidth = this.lineWidth;
    }

    ctx.strokeStyle = this.strokeStyle || Store.get(this.generateStoreKey('LT:color'));
    this.fillStyle && (ctx.fillStyle = this.fillStyle);

    if (this.lineCap) {
      ctx.lineCap = this.lineCap as CanvasLineCap;
    } else if (this.type === PenType.Line) {
      ctx.lineCap = 'round';
    }

    if (this.globalAlpha < 1) {
      ctx.globalAlpha = this.globalAlpha;
    }

    if (this.lineDash) {
      ctx.setLineDash(this.lineDash);
    } else {
      switch (this.dash) {
        case 1:
          ctx.setLineDash([5, 5]);
          break;
        case 2:
          ctx.setLineDash([10, 10]);
          break;
        case 3:
          ctx.setLineDash([10, 10, 2, 10]);
          break;
      }
    }
    if (this.lineDashOffset) {
      ctx.lineDashOffset = this.lineDashOffset;
    }

    if (this.shadowColor) {
      ctx.shadowColor = this.shadowColor;
      ctx.shadowOffsetX = this.shadowOffsetX;
      ctx.shadowOffsetY = this.shadowOffsetY;
      ctx.shadowBlur = this.shadowBlur;
    }

    this.draw(ctx);

    ctx.restore();

    if ((this as any).children) {
      for (const item of (this as any).children) {
        item.render(ctx);
      }
    }
  }

  click() {
    if (!this.events) {
      return;
    }

    for (const item of this.events) {
      if (item.type !== EventType.Click) {
        continue;
      }

      this[this.eventFns[item.action]] && this[this.eventFns[item.action]](item.value, item.params);
    }
  }

  dblclick() {
    if (!this.events) {
      return;
    }

    for (const item of this.events) {
      if (item.type !== EventType.DblClick) {
        continue;
      }

      this[this.eventFns[item.action]] && this[this.eventFns[item.action]](item.value, item.params);
    }
  }

  doSocketMqtt(
    item: { type: EventType; action: EventAction; value: string; params: string; name?: string },
    msg: any,
    client: any
  ) {
    if (item.action < EventAction.Function || item.action === EventAction.StopAnimate) {
      this[this.eventFns[item.action]](msg.value || msg || item.value, msg.params || item.params, client);
    } else if (item.action < EventAction.SetProps) {
      this[this.eventFns[item.action]](item.value, msg || item.params, client);
    } else if (item.action === EventAction.SetProps) {
      let props: any[] = [];
      let data = msg;
      if (typeof msg === 'string') {
        try {
          data = JSON.parse(msg);
        } catch (error) {}
      }
      if (Array.isArray(data)) {
        props = data;
      }

      for (const prop of props) {
        if (prop.key) {
          const keys = prop.key.split('.');

          if (typeof prop.value === 'object') {
            if (keys[1]) {
              this[keys[0]][keys[1]] = Object.assign(this[prop.key], prop.value);
            } else {
              this[keys[0]] = Object.assign(this[prop.key], prop.value);
            }
          } else {
            if (keys[1]) {
              this[keys[0]][keys[1]] = prop.value;
            } else {
              this[keys[0]] = prop.value;
            }
          }
        }
      }

      if (this.type === PenType.Node) {
        this['elementRendered'] = false;
      }
      if (item.params || item.params === undefined) {
        Store.set(this.generateStoreKey('LT:render'), true);
      }
    }
  }

  show() {
    this.visible = true;
    return this;
  }

  hide() {
    this.visible = false;
    return this;
  }

  isVisible() {
    return this.visible;
  }

  getTID() {
    return this.TID;
  }

  setTID(id: string) {
    this.TID = id;
    return this;
  }

  startAnimate() {
    this.animateStart = Date.now();
    if (this.type === PenType.Node && !this['animateReady']) {
      this['initAnimate']();
    }

    Store.set(this.generateStoreKey('LT:AnimatePlay'), {
      pen: this,
    });
  }

  private link(url: string, params: string) {
    window.open(url, params === undefined ? '_blank' : params);
  }

  private doStartAnimate(tag: string, params: string) {
    if (tag) {
      Store.set(this.generateStoreKey('LT:AnimatePlay'), {
        tag,
      });
    } else {
      this.startAnimate();
    }
  }

  private doPauseAnimate(tag: string, params: string) {
    if (tag) {
      Store.set(this.generateStoreKey('LT:AnimatePlay'), {
        tag,
        stop: true,
      });
    } else {
      this.pauseAnimate();
    }
  }

  private doStopAnimate(tag: string, params: string) {
    if (tag) {
      Store.set(this.generateStoreKey('LT:AnimatePlay'), {
        tag,
        stop: true,
      });
    } else {
      this.stopAnimate();
    }
  }

  private doFn(fn: string, params: string, client?: any) {
    let func: Function;
    if (client) {
      func = new Function('pen', 'params', 'client', fn);
    } else {
      func = new Function('pen', 'params', fn);
    }
    func(this, params, client);
  }

  private doWindowFn(fn: string, params: string, client?: any) {
    (window as any)[fn](this, params, client);
  }

  generateStoreKey(key) {
    return `${this.TID}-${key}`;
  }

  abstract getTextRect(): Rect;
  abstract calcRectInParent(parent: Pen): void;
  abstract calcRectByParent(parent: Pen): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;
  abstract translate(x: number, y: number): void;
  abstract scale(scale: number, center?: Point): void;
  abstract hit(point: { x: number; y: number }, padding?: number): any;
  abstract clone(): Pen;
  abstract initAnimate(): void;
  abstract animate(now: number): void;
  abstract pauseAnimate(): void;
  abstract stopAnimate(): void;
}
