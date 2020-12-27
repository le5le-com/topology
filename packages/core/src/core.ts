import { Store, Observer } from 'le5le-store';
// https://github.com/developit/mitt
import { default as mitt, Emitter, EventType, Handler } from 'mitt';
import { Options, KeyType, KeydownType, DefalutOptions, Padding } from './options';
import { Pen, PenType } from './models/pen';
import { Node } from './models/node';
import { Point } from './models/point';
import { Line } from './models/line';
import { TopologyData } from './models/data';
import { Lock, AnchorMode } from './models/status';
import { drawNodeFns, drawLineFns, calcTextRect } from './middles';
import { Offscreen } from './offscreen';
import { RenderLayer } from './renderLayer';
import { HoverLayer } from './hoverLayer';
import { ActiveLayer } from './activeLayer';
import { AnimateLayer } from './animateLayer';
import { DivLayer } from './divLayer';
import { Rect } from './models/rect';
import { s8 } from './utils/uuid';
import { del, find, getParent, pointInRect } from './utils/canvas';
import { getRect } from './utils/rect';
import { formatPadding } from './utils/padding';
import { Socket } from './socket';
import { MQTT } from './mqtt';
import { Direction } from './models';
import { isMobile } from './utils';

const resizeCursors = ['nw-resize', 'ne-resize', 'se-resize', 'sw-resize'];
enum MoveInType {
  None,
  Line,
  LineMove,
  LineFrom,
  LineTo,
  LineControlPoint,
  Nodes,
  ResizeCP,
  HoverAnchors,
  AutoAnchor,
  Rotate,
}

interface ICaches {
  index: number;
  list: TopologyData[];
}

const dockOffset = 10;

export class Topology {
  id: string;
  data: TopologyData = new TopologyData();
  clipboard: TopologyData;
  caches: ICaches = {
    index: 0,
    list: [],
  };
  options: Options;

  parentElem: HTMLElement;
  canvas: RenderLayer;
  offscreen: Offscreen;
  hoverLayer: HoverLayer;
  activeLayer: ActiveLayer;
  animateLayer: AnimateLayer;
  divLayer: DivLayer;

  private subcribe: Observer;
  private subcribeRender: Observer;
  private subcribeImage: Observer;
  private imageTimer: any;
  private subcribeAnimateEnd: Observer;
  private subcribeAnimateMoved: Observer;
  private subcribeMediaEnd: Observer;

  touchedNode: any;
  lastHoverNode: Node;
  lastHoverLine: Line;
  touches?: TouchList;
  touchScale?: number;
  touchStart?: number;

  input = document.createElement('textarea');
  inputObj: Pen;
  mouseDown: { x: number; y: number; restore?: boolean };
  lastTranlated = { x: 0, y: 0 };
  moveIn: {
    type: MoveInType;
    activeAnchorIndex: number;
    hoverAnchorIndex: number;
    hoverNode: Node;
    hoverLine: Line;
    activeNode: Node;
    lineControlPoint: Point;
  } = {
    type: MoveInType.None,
    activeAnchorIndex: 0,
    hoverAnchorIndex: 0,
    hoverNode: null,
    hoverLine: null,
    activeNode: null,
    lineControlPoint: null,
  };
  canvasPos?: DOMRect;

  needCache = false;

  private tip = '';
  private raf: number;
  tipMarkdown: HTMLElement;
  tipElem: HTMLElement;

  socket: Socket;
  mqtt: MQTT;
  _emitter: Emitter;

  private scheduledAnimationFrame = false;
  private scrolling = false;
  private rendering = false;
  constructor(parent: string | HTMLElement, options?: Options) {
    this.id = s8();
    this._emitter = mitt();
    Store.set(this.generateStoreKey('topology-data'), this.data);

    if (!options) {
      options = {};
    }
    const font = Object.assign({}, DefalutOptions.font, options.font);
    options.font = font;
    this.options = Object.assign({}, DefalutOptions, options);
    Store.set(this.generateStoreKey('LT:color'), this.options.color || '#222222');
    Store.set(this.generateStoreKey('LT:fontColor'), this.options.font.color || '#222222');

    this.setupDom(parent);
    this.setupSubscribe();
    this.setupMouseEvent();

    this.cache();

    (window as any).topology = this;
  }

  private setupDom(parent: string | HTMLElement) {
    if (typeof parent === 'string') {
      this.parentElem = document.getElementById(parent);
    } else {
      this.parentElem = parent;
    }
    this.parentElem.style.position = 'relative';
    this.parentElem.style.overflow = 'auto';
    this.parentElem.onresize = this.winResize;
    window.addEventListener('resize', this.winResize);

    const id = this.id;
    this.activeLayer = new ActiveLayer(this.options, id);
    this.activeLayer.topology = this;
    this.hoverLayer = new HoverLayer(this.options, id);
    this.animateLayer = new AnimateLayer(this.options, id);
    this.offscreen = new Offscreen(this.parentElem, this.options, id);
    this.canvas = new RenderLayer(this.parentElem, this.options, id);
    this.divLayer = new DivLayer(this.parentElem, this.options, id);

    this.input.style.position = 'absolute';
    this.input.style.zIndex = '-1';
    this.input.style.left = '-1000px';
    this.input.style.width = '0';
    this.input.style.height = '0';
    this.input.style.outline = 'none';
    this.input.style.border = '1px solid #cdcdcd';
    this.input.style.resize = 'none';
    this.parentElem.appendChild(this.input);

    this.createMarkdownTip();

    this.resize();
  }

  private setupSubscribe() {
    this.subcribe = Store.subscribe(this.generateStoreKey('LT:render'), () => {
      this.render();
    });
    this.subcribeRender = Store.subscribe('LT:render', () => {
      this.render();
    });
    this.subcribeImage = Store.subscribe(this.generateStoreKey('LT:imageLoaded'), () => {
      if (this.imageTimer) {
        clearTimeout(this.imageTimer);
      }
      this.imageTimer = setTimeout(() => {
        this.render();
      }, 100);
    });
    this.subcribeAnimateMoved = Store.subscribe(this.generateStoreKey('LT:rectChanged'), (e: any) => {
      this.activeLayer.updateLines(this.data.pens);
    });
    this.subcribeMediaEnd = Store.subscribe(this.generateStoreKey('mediaEnd'), (node: Node) => {
      if (node.nextPlay) {
        this.animateLayer.readyPlay(node.nextPlay);
        this.animateLayer.animate();
      }
      this.dispatch('mediaEnd', node);
    });
    this.subcribeAnimateEnd = Store.subscribe(this.generateStoreKey('animateEnd'), (e: any) => {
      if (!e) {
        return;
      }
      switch (e.type) {
        case 'node':
          this.offscreen.render();
          break;
      }
      this.divLayer.playNext(e.data.nextAnimate);
      this.dispatch('animateEnd', e);
    });
  }

  private setupMouseEvent() {
    this.canvasPos = this.divLayer.canvas.getBoundingClientRect();
    this.parentElem.addEventListener('scroll', this.onScroll);
    window.addEventListener('scroll', this.onScroll);

    this.divLayer.canvas.ondragover = (event) => event.preventDefault();
    this.divLayer.canvas.ondrop = (event) => {
      if (this.data.locked) {
        return;
      }
      try {
        const json = event.dataTransfer.getData('Topology') || event.dataTransfer.getData('Text');
        if (!json) return;
        const obj = JSON.parse(json);
        event.preventDefault();
        this.dropNodes(Array.isArray(obj) ? obj : [obj], event.offsetX, event.offsetY);
      } catch {}
    };

    if (isMobile()) {
      // ipad
      document.addEventListener('gesturestart', this.preventDefault);

      this.divLayer.canvas.ontouchstart = (event) => {
        this.touchStart = new Date().getTime();
        const pos = new Point(
          event.changedTouches[0].pageX - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
          event.changedTouches[0].pageY - window.scrollY - (this.canvasPos.top || this.canvasPos.y)
        );

        if (event.touches.length > 1) {
          this.touches = event.touches;
          this.touchScale = this.data.scale;

          this.lastTranlated.x = pos.x;
          this.lastTranlated.y = pos.y;

          return;
        }

        this.getMoveIn(pos);
        this.hoverLayer.node = this.moveIn.hoverNode;
        this.onmousedown({
          x: pos.x,
          y: pos.y,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          button: 0,
        });
      };

      this.divLayer.canvas.ontouchmove = (event) => {
        event.stopPropagation();
        const timeNow = new Date().getTime();
        if (timeNow - this.touchStart < 20) {
          return;
        }

        const len = event.changedTouches.length;
        if (len > 1) {
          const touches = event.changedTouches;

          if (len === 2) {
            const scale =
              (event as any).scale ||
              Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) /
                Math.hypot(
                  this.touches[0].pageX - this.touches[1].pageX,
                  this.touches[0].pageY - this.touches[1].pageY
                );

            const x0 = this.touches[0].pageX - touches[0].pageX;
            const x1 = this.touches[1].pageX - touches[1].pageX;
            const y0 = this.touches[0].pageY - touches[0].pageY;
            const y1 = this.touches[1].pageY - touches[1].pageY;
            if (!((x0 >= 0 && x1 >= 0) || (x0 <= 0 && x1 <= 0) || (y0 >= 0 && y1 >= 0) || (y0 <= 0 && y1 <= 0))) {
              event.preventDefault();
              this.scaleTo(scale * this.touchScale);
            }
          } else if (len === 3) {
            const pos = new Point(
              event.changedTouches[0].pageX - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
              event.changedTouches[0].pageY - window.scrollY - (this.canvasPos.top || this.canvasPos.y)
            );

            this.translate(pos.x, pos.y, true);
          }

          return;
        }

        event.preventDefault();

        const pos = new Point(
          event.changedTouches[0].pageX - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
          event.changedTouches[0].pageY - window.scrollY - (this.canvasPos.top || this.canvasPos.y)
        );

        this.onMouseMove({
          x: pos.x,
          y: pos.y,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          buttons: 1,
        });
      };

      this.divLayer.canvas.ontouchend = (event) => {
        this.touches = null;
        this.ontouchend(event);
      };
    } else {
      this.divLayer.canvas.onmousedown = (event: MouseEvent) => {
        const e = {
          x: event.pageX - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
          y: event.pageY - window.scrollY - (this.canvasPos.top || this.canvasPos.y),
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          button: event.button,
        };
        this.lastTranlated.x = e.x;
        this.lastTranlated.y = e.y;
        this.onmousedown(e);
      };
      this.divLayer.canvas.onmousemove = (event: MouseEvent) => {
        this.onMouseMove({
          x: event.pageX - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
          y: event.pageY - window.scrollY - (this.canvasPos.top || this.canvasPos.y),
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          buttons: event.buttons,
        });
      };
      this.divLayer.canvas.onmouseup = (event: MouseEvent) => {
        this.onmouseup();

        if (!this.touchedNode) {
          return;
        }

        this.touchedNode.rect.x = event.pageX - window.scrollX - this.canvasPos.x - this.touchedNode.rect.width / 2;
        this.touchedNode.rect.y = event.pageY - window.scrollY - this.canvasPos.y - this.touchedNode.rect.height / 2;

        const node = new Node(this.touchedNode);
        this.addNode(node, true);
        this.touchedNode = undefined;
      };
    }

    this.divLayer.canvas.ondblclick = this.ondblclick;
    this.divLayer.canvas.tabIndex = 0;
    this.divLayer.canvas.onblur = () => {
      this.mouseDown = null;
    };
    this.divLayer.canvas.onwheel = (event) => {
      if (this.options.disableScale) {
        return;
      }
      switch (this.options.scaleKey) {
        case KeyType.Any:
          break;
        case KeyType.Ctrl:
          if (!event.ctrlKey) {
            return;
          }
          break;
        case KeyType.Shift:
          if (!event.shiftKey) {
            return;
          }
          break;
        case KeyType.Alt:
          if (!event.altKey) {
            return;
          }
          break;
        case KeyType.Any:
          break;
        default:
          if (!event.ctrlKey && !event.altKey) {
            return;
          }
      }

      event.preventDefault();
      event.stopPropagation();

      const pos = new Point(
        event.x - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
        event.y - window.scrollY - (this.canvasPos.top || this.canvasPos.y)
      );
      if (event.deltaY < 0) {
        this.scale(1.1, pos);
      } else {
        this.scale(0.9, pos);
      }

      this.divLayer.canvas.focus();

      return false;
    };

    switch (this.options.keydown) {
      case KeydownType.Document:
        document.addEventListener('keydown', this.onkeydown);
        break;
      case KeydownType.Canvas:
        this.divLayer.canvas.addEventListener('keydown', this.onkeydown);
        break;
    }
  }

  private onScroll = () => {
    this.canvasPos = this.divLayer.canvas.getBoundingClientRect();
  };

  private preventDefault = (event: any) => {
    event.preventDefault();
  };

  private ontouchend(event: TouchEvent) {
    this.onmouseup();

    if (!this.touchedNode) {
      return;
    }

    this.touchedNode.rect.x =
      event.changedTouches[0].pageX - window.scrollX - this.canvasPos.x - this.touchedNode.rect.width / 2;
    this.touchedNode.rect.y =
      event.changedTouches[0].pageY - window.scrollY - this.canvasPos.y - this.touchedNode.rect.height / 2;

    const node = new Node(this.touchedNode);
    this.addNode(node, true);
    this.touchedNode = undefined;
  }

  winResize = () => {
    let timer: any;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      this.resize();
      this.overflow();
    }, 100);
  };

  resize(size?: { width: number; height: number }) {
    this.canvas.resize(size);
    this.offscreen.resize(size);
    this.divLayer.resize(size);

    this.render();
    this.dispatch('resize', size);
  }

  dropNodes(jsonList: any[], offsetX: number, offsetY: number) {
    let x: number, y: number;
    if (jsonList.length) {
      const rect = jsonList[0].rect;
      x = rect.x;
      y = rect.y;
    }
    let firstNode;
    jsonList.forEach((json) => {
      if (!firstNode) {
        json.rect.x = (offsetX - json.rect.width / 2) << 0;
        json.rect.y = (offsetY - json.rect.height / 2) << 0;
        firstNode = json;
      } else {
        //Layout relative to the first node
        const rect = json.rect;
        const dx = rect.x - x,
          dy = rect.y - y;
        json.rect.x = firstNode.rect.x + dx;
        json.rect.y = firstNode.rect.y + dy;
      }

      if (json.type === PenType.Line) {
        this.addLine(
          Object.assign(
            {
              name: 'line',
              from: new Point(json.rect.x, json.rect.y),
              fromArrow: this.data.fromArrow,
              to: new Point(json.rect.x + json.rect.width, json.rect.y + json.rect.height),
              toArrow: this.data.toArrow,
              strokeStyle: this.options.color,
            },
            json
          ),
          true
        );
      } else {
        const node = new Node(json);
        this.addNode(node, true);
        if (node.name === 'div') {
          this.dispatch('LT:addDiv', node);
        }
      }
    });

    this.divLayer.canvas.focus();
  }

  addNode(node: Node | any, focus = false) {
    if (!drawNodeFns[node.name]) {
      return null;
    }

    // if it's not a Node
    if (!node.init) {
      node = new Node(node);
    }

    if (!node.strokeStyle && this.options.color) {
      node.strokeStyle = this.options.color;
    }

    for (const key in node.font) {
      if (!node.font[key]) {
        node.font[key] = this.options.font[key];
      }
    }

    if (this.data.scale !== 1) {
      node.scale(this.data.scale);
    }

    // if (node.autoRect) {
    //   const ctx = this.canvas.canvas.getContext('2d');
    //   const rect = calcTextRect(ctx, node);
    //   node.rect.width = rect.width + node.lineWidth * 2;
    //   node.rect.height = rect.height;
    //   node.init();
    //   node.initRect();
    // }

    node.setTID(this.id);
    this.data.pens.push(node);

    if (focus) {
      this.activeLayer.setPens([node]);
      this.render();
      this.animate(true);
      this.cache();
      this.dispatch('addNode', node);
    }

    return node;
  }

  addLine(line: any, focus = false) {
    if (this.data.locked) {
      return null;
    }

    if (!line.clone) {
      line = new Line(line);
      line.calcControlPoints(true);
    }
    if (this.data.scale !== 1) {
      line.font.fontSize *= this.data.scale;
    }
    this.data.pens.push(line);

    if (focus) {
      this.activeLayer.setPens([line]);
      this.render();
      this.animate(true);
      this.cache();
      this.dispatch('addLine', line);
    }

    return line;
  }

  // Render or redraw
  render(noFocus = false) {
    if (noFocus) {
      this.activeLayer.pens = [];
      this.hoverLayer.node = null;
      this.hoverLayer.line = null;
    }
    if (this.rendering) {
      return this;
    }
    this.rendering = true;
    this.offscreen.render();
    this.canvas.render();
    this.rendering = false;
  }

  // open - redraw by the data
  open(data?: any) {
    if (!data) {
      data = { pens: [] };
    }
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    this.animateLayer.stop();
    this.lock(data.locked || Lock.None);

    if (data.lineName) {
      this.data.lineName = data.lineName;
    }
    this.data.fromArrow = data.fromArrow;
    this.data.toArrow = data.toArrow;
    this.data.lineWidth = data.lineWidth;

    this.data.scale = data.scale || 1;
    Store.set(this.generateStoreKey('LT:scale'), this.data.scale);
    this.dispatch('scale', this.data.scale);

    this.data.bkColor = data.bkColor;
    this.data.bkImage = data.bkImage;
    this.data.tooltip = data.tooltip;
    this.data.pens = [];

    // for old data.
    if (data.nodes) {
      for (const item of data.nodes) {
        item.TID = this.id;
        this.data.pens.push(new Node(item));
      }
      for (const item of data.lines) {
        this.data.pens.push(new Line(item));
      }
    }
    // end.

    if (data.pens) {
      for (const item of data.pens) {
        if (!item.type) {
          item.TID = this.id;
          this.data.pens.push(new Node(item));
        } else {
          this.data.pens.push(new Line(item));
        }
      }
    }

    this.data.websocket = data.websocket;
    this.data.mqttUrl = data.mqttUrl;
    this.data.mqttOptions = data.mqttOptions || { clientId: s8() };
    this.data.mqttTopics = data.mqttTopics;
    this.data.grid = data.grid;
    this.data.gridColor = data.gridColor;
    this.data.gridSize = data.gridSize;
    this.data.rule = data.rule;
    this.data.ruleColor = data.ruleColor;
    if (typeof data.data === 'object') {
      this.data.data = JSON.parse(JSON.stringify(data.data));
    } else {
      this.data.data = data.data || '';
    }

    this.caches.list = [];
    this.cache();

    this.divLayer.clear();

    this.overflow();
    this.render(true);

    this.parentElem.scrollLeft = 0;
    this.parentElem.scrollTop = 0;

    this.animate(true);
    this.openSocket();
    this.openMqtt();
  }

  openSocket(url?: string) {
    this.closeSocket();
    if (url || this.data.websocket) {
      this.socket = new Socket(url || this.data.websocket, this.data);
    }
  }

  closeSocket() {
    if (this.socket) {
      this.socket.close();
    }
  }

  openMqtt(url?: string, options?: any) {
    this.closeMqtt();
    if (url || this.data.mqttUrl) {
      this.mqtt = new MQTT(url || this.data.mqttUrl, options || this.data.mqttOptions, this.data.mqttTopics, this.data);
    }
  }

  closeMqtt() {
    if (this.mqtt) {
      this.mqtt.close();
    }
  }

  overflow(padding = 50) {
    const rect = this.getRect();
    let { width, height } = rect;
    if (width < rect.ex) {
      width = rect.ex + padding;
    }
    if (width < this.canvas.width) {
      width = this.canvas.width;
    }
    if (height < rect.ey) {
      height = rect.ey + padding;
    }
    if (height < this.canvas.height) {
      height = this.canvas.height;
    }
    const size = { width, height };
    this.resize(size);
    return size;
  }

  private setNodeText() {
    this.inputObj.text = this.input.value;
    this.input.style.zIndex = '-1';
    this.input.style.left = '-1000px';
    this.input.style.width = '0';
    this.cache();
    this.offscreen.render();

    this.dispatch('setText', this.inputObj);

    this.inputObj = null;
  }

  onMouseMove = (e: {
    x: number;
    y: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {
    if (this.scheduledAnimationFrame || this.data.locked === Lock.NoEvent) {
      return;
    }

    // https://caniuse.com/#feat=mdn-api_mouseevent_buttons
    if (this.mouseDown && !this.mouseDown.restore && e.buttons !== 1) {
      // 防止异常情况导致mouseup事件没有触发
      this.onmouseup();
      return;
    }

    if (this.mouseDown && (this.data.locked || !this.moveIn.type)) {
      let b = !!this.data.locked;
      switch (this.options.translateKey) {
        case KeyType.Any:
          b = true;
          break;
        case KeyType.Ctrl:
          if (e.ctrlKey) {
            b = true;
          }
          break;
        case KeyType.Shift:
          if (e.shiftKey) {
            b = true;
          }
          break;
        case KeyType.Alt:
          if (e.altKey) {
            b = true;
          }
          break;
        default:
          if (e.ctrlKey || e.altKey) {
            b = true;
          }
      }

      if (!this.options.disableTranslate && b && this.data.locked < Lock.NoMove) {
        this.translate(e.x, e.y, true);
        return false;
      }
    }

    if (this.data.locked && this.mouseDown) {
      return;
    }

    this.scheduledAnimationFrame = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      this.raf = null;

      if (!this.mouseDown) {
        this.getMoveIn(e);

        // Render hover anchors.
        if (this.moveIn.hoverNode !== this.lastHoverNode) {
          if (this.lastHoverNode) {
            // Send a move event.
            this.dispatch('moveOutNode', this.lastHoverNode);

            this.hideTip();

            // Clear hover anchors.
            this.hoverLayer.node = null;
          }
          if (this.moveIn.hoverNode) {
            this.hoverLayer.node = this.moveIn.hoverNode;

            // Send a move event.
            this.dispatch('moveInNode', this.moveIn.hoverNode);

            this.showTip(this.moveIn.hoverNode, e);
          }
        }

        if (this.moveIn.hoverLine !== this.lastHoverLine && !this.moveIn.hoverNode) {
          if (this.lastHoverLine) {
            this.dispatch('moveOutLine', this.lastHoverLine);
            this.hideTip();
          }
          if (this.moveIn.hoverLine) {
            this.dispatch('moveInLine', this.moveIn.hoverLine);

            this.showTip(this.moveIn.hoverLine, e);
          }
        }

        if (this.moveIn.type === MoveInType.LineControlPoint) {
          this.hoverLayer.hoverLineCP = this.moveIn.lineControlPoint;
        } else if (this.hoverLayer.hoverLineCP) {
          this.hoverLayer.hoverLineCP = null;
        }
        if (
          this.moveIn.hoverNode !== this.lastHoverNode ||
          this.moveIn.type === MoveInType.HoverAnchors ||
          this.hoverLayer.lasthoverLineCP !== this.hoverLayer.hoverLineCP
        ) {
          this.hoverLayer.lasthoverLineCP = this.hoverLayer.hoverLineCP;
          this.render();
        }

        this.scheduledAnimationFrame = false;
        return;
      }

      // Move out parent element.
      const moveOutX = e.x + 50 > this.parentElem.clientWidth + this.parentElem.scrollLeft;
      const moveOutY = e.y + 50 > this.parentElem.clientHeight + this.parentElem.scrollTop;
      if (!this.options.disableMoveOutParent && (moveOutX || moveOutY)) {
        this.dispatch('moveOutParent', e);

        if (this.options.autoExpandDistance > 0) {
          let resize = false;
          if (e.x + 50 > this.divLayer.canvas.clientWidth) {
            this.canvas.width += this.options.autoExpandDistance;
            resize = true;
          }
          if (e.y + 50 > this.divLayer.canvas.clientHeight) {
            this.canvas.height += this.options.autoExpandDistance;
            resize = true;
          }
          if (resize) {
            this.resize({
              width: this.canvas.width,
              height: this.canvas.height,
            });
          }

          this.scroll(
            moveOutX ? this.options.autoExpandDistance / 2 : 0,
            moveOutY ? this.options.autoExpandDistance / 2 : 0
          );
        }
      }

      const moveLeft = e.x - 100 < this.parentElem.scrollLeft;
      const moveTop = e.y - 100 < this.parentElem.scrollTop;
      if (moveLeft || moveTop) {
        this.scroll(moveLeft ? -100 : 0, moveTop ? -100 : 0);
      }

      this.hideTip();
      switch (this.moveIn.type) {
        case MoveInType.None:
          this.hoverLayer.dragRect = new Rect(
            this.mouseDown.x,
            this.mouseDown.y,
            e.x - this.mouseDown.x,
            e.y - this.mouseDown.y
          );
          break;
        case MoveInType.Nodes:
          if (this.activeLayer.locked()) {
            break;
          }

          const x = e.x - this.mouseDown.x;
          const y = e.y - this.mouseDown.y;
          if (x || y) {
            const offset = this.getDockPos(x, y, e.ctrlKey || e.shiftKey || e.altKey);
            this.activeLayer.move(offset.x ? offset.x : x, offset.y ? offset.y : y);
            this.needCache = true;
          }
          break;
        case MoveInType.ResizeCP:
          this.activeLayer.resize(this.moveIn.activeAnchorIndex, this.mouseDown, e);
          this.dispatch('resizePens', this.activeLayer.pens);
          this.needCache = true;
          break;
        case MoveInType.LineTo:
        case MoveInType.HoverAnchors:
        case MoveInType.AutoAnchor:
          let arrow = this.data.toArrow;
          if (this.moveIn.hoverLine) {
            arrow = this.moveIn.hoverLine.toArrow;
          }
          if (this.hoverLayer.line) {
            this.activeLayer.pens = [this.hoverLayer.line];
          }
          this.hoverLayer.lineTo(this.getLineDock(new Point(e.x, e.y), AnchorMode.In), arrow);
          this.needCache = true;
          break;

        case MoveInType.LineFrom:
          this.hoverLayer.lineFrom(this.getLineDock(new Point(e.x, e.y), AnchorMode.Out));
          this.needCache = true;
          break;
        case MoveInType.LineMove:
          this.hoverLayer.lineMove(e, this.mouseDown);
          this.animateLayer.updateLines([this.hoverLayer.line]);
          this.needCache = true;
          break;
        case MoveInType.LineControlPoint:
          this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id].x = e.x;
          this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id].y = e.y;
          this.moveIn.hoverLine.textRect = null;
          if (drawLineFns[this.moveIn.hoverLine.name] && drawLineFns[this.moveIn.hoverLine.name].dockControlPointFn) {
            drawLineFns[this.moveIn.hoverLine.name].dockControlPointFn(
              this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id],
              this.moveIn.hoverLine
            );
          }
          this.needCache = true;
          Store.set(this.generateStoreKey('LT:updateLines'), [this.moveIn.hoverLine]);
          break;
        case MoveInType.Rotate:
          if (this.activeLayer.pens.length) {
            this.activeLayer.offsetRotate(this.getAngle(e));
            this.activeLayer.updateLines();
          }
          this.needCache = true;
          break;
      }

      this.render();
      this.scheduledAnimationFrame = false;
    });
  };

  onmousedown = (e: {
    x: number;
    y: number;
    button?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {
    if (e.button !== 0 && e.button !== 2) return;

    this.mouseDown = e;
    if (e.altKey) {
      this.divLayer.canvas.style.cursor = 'move';
    }

    if (this.inputObj) {
      this.setNodeText();
    }

    switch (this.moveIn.type) {
      // Click the space.
      case MoveInType.None:
        this.activeLayer.clear();
        this.hoverLayer.clear();
        this.dispatch('space', this.mouseDown);
        break;
      // Click a line.
      case MoveInType.Line:
      case MoveInType.LineControlPoint:
        if (e.ctrlKey || e.shiftKey) {
          this.activeLayer.add(this.moveIn.hoverLine);
          this.dispatch('multi', this.activeLayer.pens);
        } else {
          this.activeLayer.pens = [this.moveIn.hoverLine];
          this.dispatch('line', this.moveIn.hoverLine);
        }
        if (this.data.locked || this.moveIn.hoverLine.locked) {
          this.moveIn.hoverLine.click();
        }
        break;
      case MoveInType.LineMove:
        this.hoverLayer.initLine = new Line(this.moveIn.hoverLine);
        if (this.data.locked || this.moveIn.hoverLine.locked) {
          this.moveIn.hoverLine.click();
        }
      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.LineFrom:
      case MoveInType.LineTo:
        this.activeLayer.pens = [this.moveIn.hoverLine];
        this.dispatch('line', this.moveIn.hoverLine);

        this.hoverLayer.line = this.moveIn.hoverLine;

        break;
      case MoveInType.HoverAnchors:
        this.hoverLayer.line = this.addLine({
          name: this.data.lineName,
          from: new Point(
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].x,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].y,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].direction,
            this.moveIn.hoverAnchorIndex,
            this.moveIn.hoverNode.id
          ),
          fromArrow: this.data.fromArrow,
          to: new Point(
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].x,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].y
          ),
          toArrow: this.data.toArrow,
          strokeStyle: this.options.color,
          lineWidth: this.data.lineWidth,
        });
        this.dispatch('anchor', {
          anchor: this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex],
          anchorIndex: this.moveIn.hoverAnchorIndex,
          node: this.moveIn.hoverNode,
          line: this.hoverLayer.line,
        });
        break;

      case MoveInType.AutoAnchor:
        this.hoverLayer.line = this.addLine({
          name: this.data.lineName,
          from: new Point(
            this.moveIn.hoverNode.rect.center.x,
            this.moveIn.hoverNode.rect.center.y,
            Direction.None,
            0,
            this.moveIn.hoverNode.id
          ),
          fromArrow: this.data.fromArrow,
          to: new Point(this.moveIn.hoverNode.rect.center.x, this.moveIn.hoverNode.rect.center.y),
          toArrow: this.data.toArrow,
          strokeStyle: this.options.color,
          lineWidth: this.data.lineWidth,
        });
        this.hoverLayer.line.from.autoAnchor = true;
        this.dispatch('nodeCenter', this.moveIn.hoverNode);
        break;
      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.Nodes:
        if (!this.moveIn.activeNode) {
          break;
        }

        if (e.ctrlKey || e.shiftKey) {
          if (this.moveIn.hoverNode && this.activeLayer.hasInAll(this.moveIn.hoverNode)) {
            this.activeLayer.setPens([this.moveIn.hoverNode]);
            this.dispatch('node', this.moveIn.hoverNode);
          } else if (!this.activeLayer.has(this.moveIn.activeNode)) {
            this.activeLayer.add(this.moveIn.activeNode);
            if (this.activeLayer.pens.length > 1) {
              this.dispatch('multi', this.activeLayer.pens);
            } else {
              this.dispatch('node', this.moveIn.activeNode);
            }
          }
        } else if (e.altKey) {
          if (this.moveIn.hoverNode) {
            this.activeLayer.setPens([this.moveIn.hoverNode]);
            this.dispatch('node', this.moveIn.hoverNode);
          } else if (this.moveIn.hoverLine) {
            this.activeLayer.setPens([this.moveIn.hoverLine]);
            this.dispatch('line', this.moveIn.hoverLine);
          }
        } else if (this.activeLayer.pens.length < 2) {
          this.activeLayer.setPens([this.moveIn.activeNode]);
          this.dispatch('node', this.moveIn.activeNode);
        }

        if (this.data.locked || this.moveIn.activeNode.locked) {
          this.moveIn.activeNode.click();
        }

        break;
    }

    // Save node rects to move.
    if (this.activeLayer.pens.length) {
      this.activeLayer.saveNodeRects();
    }

    this.render();
  };

  onmouseup = () => {
    if (!this.mouseDown) return;

    this.mouseDown = null;
    this.lastTranlated.x = 0;
    this.lastTranlated.y = 0;
    this.hoverLayer.dockAnchor = null;
    this.hoverLayer.dockLineX = 0;
    this.hoverLayer.dockLineY = 0;
    this.divLayer.canvas.style.cursor = 'default';

    if (this.hoverLayer.dragRect) {
      this.getPensInRect(this.hoverLayer.dragRect);

      if (this.activeLayer.pens && this.activeLayer.pens.length > 1) {
        this.dispatch('multi', this.activeLayer.pens);
      } else if (this.activeLayer.pens && this.activeLayer.pens[0] && this.activeLayer.pens[0].type === PenType.Line) {
        this.dispatch('line', this.activeLayer.pens[0]);
      } else if (this.activeLayer.pens && this.activeLayer.pens[0] && this.activeLayer.pens[0].type === PenType.Node) {
        this.dispatch('node', this.activeLayer.pens[0]);
      }
    } else {
      switch (this.moveIn.type) {
        // Add the line.
        case MoveInType.HoverAnchors:
          // New active.
          if (this.hoverLayer.line) {
            let willAddLine: boolean;
            if (this.hoverLayer.line.to.id) {
              if (!this.options.disableRepeatLine) {
                willAddLine = true;
              } else {
                const lines = this.data.pens.filter(
                  (pen) =>
                    pen.type === PenType.Line &&
                    (pen as Line).from.isSameAs(this.hoverLayer.line.from) &&
                    (pen as Line).to.isSameAs(this.hoverLayer.line.to)
                );
                willAddLine = lines.length <= 1;
              }
            } else {
              willAddLine = !this.options.disableEmptyLine && !this.hoverLayer.line.disableEmptyLine;
            }

            if (willAddLine) {
              this.activeLayer.pens = [this.hoverLayer.line];
              this.dispatch('addLine', this.hoverLayer.line);
            } else {
              this.data.pens.pop();
              this.activeLayer.clear();
            }
          }

          this.offscreen.render();

          this.hoverLayer.line = null;
          break;
        case MoveInType.AutoAnchor:
          if (
            (this.hoverLayer.line.disableEmptyLine || this.options.disableEmptyLine) &&
            (!this.hoverLayer.line.from.id || !this.hoverLayer.line.to.id)
          ) {
            this.needCache = true;
            this.activeLayer.clear();
            this.data.pens.splice(this.findIndex(this.hoverLayer.line), 1);
          } else {
            this.activeLayer.updateLines();
            this.dispatch('addLine', this.hoverLayer.line);
          }

          break;
        case MoveInType.Rotate:
          this.activeLayer.updateRotate();
          break;

        case MoveInType.LineControlPoint:
          Store.set(this.generateStoreKey('pts-') + this.moveIn.hoverLine.id, null);
          break;

        case MoveInType.LineFrom:
        case MoveInType.LineTo:
          if (
            (this.hoverLayer.line.disableEmptyLine || this.options.disableEmptyLine) &&
            (!this.hoverLayer.line.from.id || !this.hoverLayer.line.to.id)
          ) {
            this.needCache = true;
            this.activeLayer.clear();
            this.data.pens.splice(this.findIndex(this.hoverLayer.line), 1);
          }
          break;
      }
    }

    this.hoverLayer.dragRect = null;
    this.render();

    if (this.needCache) {
      this.cache();
    }
    this.needCache = false;
  };

  private ondblclick = (e: MouseEvent) => {
    if (this.moveIn.hoverNode) {
      this.dispatch('dblclick', this.moveIn.hoverNode);

      if (
        this.moveIn.hoverNode
          .getTextRect()
          .hit(
            new Point(
              e.x - window.scrollX - (this.canvasPos.left || this.canvasPos.x),
              e.y - window.scrollY - (this.canvasPos.top || this.canvasPos.y)
            )
          )
      ) {
        this.showInput(this.moveIn.hoverNode);
      }

      this.moveIn.hoverNode.dblclick();
    } else if (this.moveIn.hoverLine) {
      this.dispatch('dblclick', this.moveIn.hoverLine);

      if (
        !this.moveIn.hoverLine.text ||
        this.moveIn.hoverLine
          .getTextRect()
          .hit(
            new Point(e.x - (this.canvasPos.x || this.canvasPos.left), e.y - (this.canvasPos.y || this.canvasPos.top))
          )
      ) {
        this.showInput(this.moveIn.hoverLine);
      }

      this.moveIn.hoverLine.dblclick();
    }
  };

  private onkeydown = (key: KeyboardEvent) => {
    if (
      this.data.locked ||
      (key.target as HTMLElement).tagName === 'INPUT' ||
      (key.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }

    let done = false;
    let moveX = 0;
    let moveY = 0;
    switch (key.key) {
      case 'a':
      case 'A':
        this.activeLayer.setPens(this.data.pens);
        done = true;
        break;
      case 'Delete':
      case 'Backspace':
        this.delete();
        break;
      case 'ArrowLeft':
        moveX = -5;
        if (key.ctrlKey) {
          moveX = -1;
        }
        done = true;
        break;
      case 'ArrowUp':
        moveY = -5;
        if (key.ctrlKey) {
          moveY = -1;
        }
        done = true;
        break;
      case 'ArrowRight':
        moveX = 5;
        if (key.ctrlKey) {
          moveX = 1;
        }
        done = true;
        break;
      case 'ArrowDown':
        moveY = 5;
        if (key.ctrlKey) {
          moveY = 1;
        }
        done = true;
        break;
      case 'x':
      case 'X':
        this.cut();
        break;
      case 'c':
      case 'C':
        this.copy();
        break;
      case 'v':
      case 'V':
        this.paste();
        break;
      case 'y':
      case 'Y':
        if (key.ctrlKey) {
          this.redo();
        }
        break;
      case 'z':
      case 'Z':
        if (key.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        break;
    }

    if (!done) {
      return;
    }

    key.preventDefault();
    key.stopPropagation();

    if (moveX || moveY) {
      this.activeLayer.saveNodeRects();
      this.activeLayer.move(moveX, moveY);
      this.overflow();
      this.animateLayer.animate();
    }

    this.render();
    this.cache();
  };

  private getMoveIn(pt: { x: number; y: number }) {
    this.lastHoverNode = this.moveIn.hoverNode;
    this.lastHoverLine = this.moveIn.hoverLine;
    this.moveIn.type = MoveInType.None;
    this.moveIn.hoverNode = null;
    this.moveIn.lineControlPoint = null;
    this.moveIn.hoverLine = null;
    this.hoverLayer.hoverAnchorIndex = -1;

    if (
      !this.data.locked &&
      !(this.activeLayer.pens.length === 1 && this.activeLayer.pens[0].type) &&
      !this.activeLayer.locked() &&
      this.activeLayer.rotateCPs[0] &&
      this.activeLayer.rotateCPs[0].hit(pt, 15)
    ) {
      this.moveIn.type = MoveInType.Rotate;

      const cursor = this.options.rotateCursor;
      this.divLayer.canvas.style.cursor = cursor.includes('/') ? `url("${cursor}"), auto` : cursor;
      return;
    }

    if (this.activeLayer.pens.length > 1 && pointInRect(pt, this.activeLayer.sizeCPs)) {
      this.moveIn.type = MoveInType.Nodes;
    }

    if (!this.data.locked && !this.activeLayer.locked() && !this.options.hideSizeCP) {
      if (
        this.activeLayer.pens.length > 1 ||
        (!this.activeLayer.pens[0].type && !this.activeLayer.pens[0].hideSizeCP)
      ) {
        for (let i = 0; i < this.activeLayer.sizeCPs.length; ++i) {
          if (this.activeLayer.sizeCPs[i].hit(pt, 10)) {
            this.moveIn.type = MoveInType.ResizeCP;
            this.moveIn.activeAnchorIndex = i;
            this.divLayer.canvas.style.cursor = resizeCursors[i];
            return;
          }
        }
      }
    }

    // In active pen.
    if (!this.data.locked) {
      for (const item of this.activeLayer.pens) {
        if (item instanceof Line && !item.locked) {
          for (let i = 0; i < item.controlPoints.length; ++i) {
            if (!item.locked && item.controlPoints[i].hit(pt, 10)) {
              item.controlPoints[i].id = i;
              this.moveIn.type = MoveInType.LineControlPoint;
              this.moveIn.lineControlPoint = item.controlPoints[i];
              this.moveIn.hoverLine = item;
              this.divLayer.canvas.style.cursor = 'pointer';
              return;
            }
          }
          if (this.inLine(pt, item)) {
            return;
          }
        }
      }
    }

    this.divLayer.canvas.style.cursor = 'default';
    const len = this.data.pens.length;
    let inLine: Pen;
    for (let i = len - 1; i > -1; --i) {
      if (this.data.pens[i].type === PenType.Node && this.inNode(pt, this.data.pens[i] as Node)) {
        if (inLine && (this.moveIn.type as any) !== MoveInType.HoverAnchors) {
          this.inLine(pt, inLine as Line);
        }
        return;
      } else if (this.data.pens[i].type === PenType.Line && this.inLine(pt, this.data.pens[i] as Line)) {
        // 优先判断是否在节点锚点上
        inLine = this.data.pens[i];
      }
    }
  }

  inChildNode(pt: { x: number; y: number }, children: Pen[]) {
    if (!children) {
      return null;
    }

    const len = children.length;
    for (let i = len - 1; i > -1; --i) {
      const item = children[i];

      if (item.type === PenType.Line) {
        if (this.inLine(pt, item as Line)) {
          return item;
        }
        continue;
      }
      let node = this.inChildNode(pt, (item as Node).children);
      if (node) {
        return node;
      }

      node = this.inNode(pt, item as Node, true);
      if (node) {
        return node;
      }
    }

    return null;
  }

  inNode(pt: { x: number; y: number }, node: Node, inChild = false) {
    if (this.data.locked === Lock.NoEvent || !node.visible || node.locked === Lock.NoEvent) {
      return null;
    }

    const child = this.inChildNode(pt, node.children);
    if (child) {
      if (this.moveIn.type < MoveInType.HoverAnchors) {
        if (child.type === PenType.Line) {
          this.moveIn.activeNode = node;
          this.moveIn.type = MoveInType.Nodes;
        } else if (child.stand) {
          this.moveIn.activeNode = child;
          this.moveIn.type = MoveInType.Nodes;
        } else {
          this.moveIn.activeNode = node;
          this.moveIn.type = MoveInType.Nodes;
        }
      }
      return child;
    }

    if (node.hitInSelf(pt)) {
      this.moveIn.hoverNode = node;
      this.moveIn.type = MoveInType.Nodes;
      if (!this.data.locked && !node.locked) {
        this.divLayer.canvas.style.cursor = 'move';
      } else {
        this.divLayer.canvas.style.cursor = this.options.hoverCursor;
      }

      // Too small
      if (
        !this.data.locked &&
        !node.locked &&
        !(this.options.hideAnchor || node.hideAnchor || node.rect.width < 20 || node.rect.height < 20)
      ) {
        for (let j = 0; j < node.rotatedAnchors.length; ++j) {
          if (node.rotatedAnchors[j].hit(pt, this.options.anchorSize)) {
            if (!this.mouseDown && node.rotatedAnchors[j].mode === AnchorMode.In) {
              continue;
            }
            this.moveIn.type = MoveInType.HoverAnchors;
            this.moveIn.hoverAnchorIndex = j;
            this.hoverLayer.hoverAnchorIndex = j;
            this.divLayer.canvas.style.cursor = 'crosshair';
            break;
          }
        }

        if (this.options.autoAnchor && node.rect.center.hit(pt, this.options.anchorSize)) {
          this.moveIn.hoverNode = node;
          this.moveIn.type = MoveInType.AutoAnchor;
          this.divLayer.canvas.style.cursor = 'crosshair';
        }
      }

      if (!inChild) {
        this.moveIn.activeNode = this.moveIn.hoverNode;
      }

      return node;
    }

    if (this.options.hideAnchor || node.hideAnchor || this.data.locked || node.locked) {
      return null;
    }

    if (node.hitInSelf(pt, this.options.anchorSize)) {
      for (let j = 0; j < node.rotatedAnchors.length; ++j) {
        if (node.rotatedAnchors[j].hit(pt, this.options.anchorSize)) {
          if (!this.mouseDown && node.rotatedAnchors[j].mode === AnchorMode.In) {
            continue;
          }
          this.moveIn.hoverNode = node;
          this.moveIn.type = MoveInType.HoverAnchors;
          this.moveIn.hoverAnchorIndex = j;
          this.hoverLayer.hoverAnchorIndex = j;
          this.divLayer.canvas.style.cursor = 'crosshair';

          if (!inChild) {
            this.moveIn.activeNode = node;
          }

          return node;
        }
      }
    }

    return null;
  }

  inLine(point: { x: number; y: number }, line: Line) {
    if (this.data.locked === Lock.NoEvent || !line.visible || line.locked === Lock.NoEvent) {
      return null;
    }

    if (line.from.hit(point, this.options.anchorSize)) {
      this.moveIn.type = MoveInType.LineFrom;
      this.moveIn.hoverLine = line;
      if (this.data.locked || line.locked) {
        this.divLayer.canvas.style.cursor = this.options.hoverCursor;
      } else {
        this.divLayer.canvas.style.cursor = 'move';
      }
      return line;
    }

    if (line.to.hit(point, this.options.anchorSize)) {
      this.moveIn.type = MoveInType.LineTo;
      this.moveIn.hoverLine = line;
      if (this.data.locked || line.locked) {
        this.divLayer.canvas.style.cursor = this.options.hoverCursor;
      } else {
        this.divLayer.canvas.style.cursor = 'move';
      }
      return line;
    }

    if (line.pointIn(point)) {
      this.moveIn.type = MoveInType.LineMove;
      this.moveIn.hoverLine = line;
      this.divLayer.canvas.style.cursor = this.options.hoverCursor;
      if (line.from.id || line.to.id) {
        this.moveIn.type = MoveInType.Line;
      }
      return line;
    }

    return null;
  }

  private getLineDock(point: Point, mode: AnchorMode = AnchorMode.Default) {
    this.hoverLayer.dockAnchor = null;
    for (const item of this.data.pens) {
      if (item instanceof Node) {
        const pen = item.hit(point, 10);

        if (!pen) {
          continue;
        }
        if (pen.type === PenType.Line) {
          if (pen.from.hit(point, 10)) {
            point.x = pen.from.x;
            point.y = pen.from.y;
            this.hoverLayer.dockAnchor = pen.from;
            break;
          }

          if (pen.to.hit(point, 10)) {
            point.x = pen.to.x;
            point.y = pen.to.y;
            this.hoverLayer.dockAnchor = pen.to;
            break;
          }

          break;
        }

        this.hoverLayer.node = pen;
        if (this.options.autoAnchor && pen.rect.center.hit(point, 10)) {
          point.id = pen.id;
          point.autoAnchor = true;
          point.x = pen.rect.center.x;
          point.y = pen.rect.center.y;
          this.hoverLayer.dockAnchor = pen.rect.center;
        }

        for (let i = 0; i < pen.rotatedAnchors.length; ++i) {
          if (pen.rotatedAnchors[i].mode && pen.rotatedAnchors[i].mode !== mode) {
            continue;
          }
          if (pen.rotatedAnchors[i].hit(point, 10)) {
            point.id = pen.id;
            point.anchorIndex = i;
            point.autoAnchor = false;
            point.direction = pen.rotatedAnchors[i].direction;
            point.x = pen.rotatedAnchors[i].x;
            point.y = pen.rotatedAnchors[i].y;
            this.hoverLayer.dockAnchor = pen.rotatedAnchors[i];
            break;
          }
        }
      } else if (item instanceof Line) {
        if (item.id === this.hoverLayer.line.id) {
          continue;
        }

        if (item.from.hit(point, 10)) {
          point.x = item.from.x;
          point.y = item.from.y;
          this.hoverLayer.dockAnchor = item.from;
          break;
        }

        if (item.to.hit(point, 10)) {
          point.x = item.to.x;
          point.y = item.to.y;
          this.hoverLayer.dockAnchor = item.to;
          break;
        }

        if (item.controlPoints) {
          for (const cp of item.controlPoints) {
            if (cp.hit(point, 10)) {
              point.x = cp.x;
              point.y = cp.y;
              this.hoverLayer.dockAnchor = cp;
              break;
            }
          }
        }
      }

      if (this.hoverLayer.dockAnchor) {
        break;
      }
    }

    return point;
  }

  private getPensInRect(rect: Rect) {
    if (rect.width < 0) {
      rect.width = -rect.width;
      rect.x = rect.ex;
      rect.ex = rect.x + rect.width;
    }
    if (rect.height < 0) {
      rect.height = -rect.height;
      rect.y = rect.ey;
      rect.ey = rect.y + rect.height;
    }
    this.activeLayer.pens = [];
    for (const item of this.data.pens) {
      if (item.locked === Lock.NoEvent) {
        continue;
      }
      if (item instanceof Node) {
        if (rect.hitByRect(item.rect)) {
          this.activeLayer.add(item);
        }
      }
      if (item instanceof Line) {
        if (rect.hit(item.from) && rect.hit(item.to)) {
          this.activeLayer.add(item);
        }
      }
    }
  }

  private getAngle(pt: { x: number; y: number }) {
    if (pt.x === this.activeLayer.rect.center.x) {
      return pt.y <= this.activeLayer.rect.center.y ? 0 : 180;
    }

    if (pt.y === this.activeLayer.rect.center.y) {
      return pt.x < this.activeLayer.rect.center.x ? 270 : 90;
    }

    const x = pt.x - this.activeLayer.rect.center.x;
    const y = pt.y - this.activeLayer.rect.center.y;
    let angle = (Math.atan(Math.abs(x / y)) / (2 * Math.PI)) * 360;
    if (x > 0 && y > 0) {
      angle = 180 - angle;
    } else if (x < 0 && y > 0) {
      angle += 180;
    } else if (x < 0 && y < 0) {
      angle = 360 - angle;
    }
    if (this.activeLayer.pens.length === 1) {
      return angle - this.activeLayer.pens[0].rotate;
    }

    return angle;
  }

  showInput(item: Pen, force?: boolean) {
    if (!force && (this.data.locked || item.locked || item.hideInput || this.options.hideInput)) {
      return;
    }

    this.inputObj = item;
    const textRect = item.getTextRect();
    this.input.value = item.text || '';
    this.input.style.left = textRect.x + 'px';
    this.input.style.top = textRect.y + 'px';
    this.input.style.width = textRect.width + 'px';
    this.input.style.height = textRect.height + 'px';
    this.input.style.zIndex = '1000';
    if (item.rotate / 360) {
      this.input.style.transform = `rotate(${item.rotate}deg)`;
    } else {
      this.input.style.transform = null;
    }
    this.input.focus();
  }

  getRect(pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }

    return getRect(pens);
  }

  // Get a dock rect for moving nodes.
  getDockPos(offsetX: number, offsetY: number, noDock?: boolean) {
    this.hoverLayer.dockLineX = 0;
    this.hoverLayer.dockLineY = 0;

    const offset = {
      x: 0,
      y: 0,
    };

    if (noDock || this.options.disableDockLine) {
      return offset;
    }

    let x = 0;
    let y = 0;
    let disX = dockOffset;
    let disY = dockOffset;

    for (const activePt of this.activeLayer.dockWatchers) {
      for (const item of this.data.pens) {
        if (!(item instanceof Node) || this.activeLayer.has(item) || item.name === 'text') {
          continue;
        }

        if (!item.dockWatchers) {
          item.getDockWatchers();
        }
        for (const p of item.dockWatchers) {
          x = Math.abs(p.x - activePt.x - offsetX);
          if (x < disX) {
            disX = -99999;
            offset.x = p.x - activePt.x;
            this.hoverLayer.dockLineX = p.x | 0;
          }

          y = Math.abs(p.y - activePt.y - offsetY);
          if (y < disY) {
            disY = -99999;
            offset.y = p.y - activePt.y;
            this.hoverLayer.dockLineY = p.y | 0;
          }
        }
      }
    }

    return offset;
  }

  cache() {
    if (this.caches.index < this.caches.list.length - 1) {
      this.caches.list.splice(this.caches.index + 1, this.caches.list.length - this.caches.index - 1);
    }
    const data = new TopologyData(this.data);
    this.caches.list.push(data);
    if (this.caches.list.length > this.options.cacheLen) {
      this.caches.list.shift();
    }

    this.caches.index = this.caches.list.length - 1;
  }

  cacheReplace(pens: Pen[]) {
    if (pens && pens.length) {
      const needPenMap = {};
      for (let i = 0, len = pens.length; i < len; i++) {
        const pen = pens[i];
        const id = pen.id;
        if (pen instanceof Node) {
          needPenMap[id] = new Node(pen);
        } else if (pen instanceof Line) {
          needPenMap[id] = new Line(pen);
        }
      }
      const cacheListData: TopologyData = this.caches.list[0];
      if (!cacheListData) {
        return;
      }
      for (let i = 0, len = cacheListData.pens.length; i < len; i++) {
        const id = cacheListData.pens[i].id;
        if (needPenMap[id]) {
          cacheListData.pens[i] = needPenMap[id];
        }
      }
    }
  }

  undo(noRedo = false, force?: boolean) {
    if ((!force && this.data.locked) || this.caches.index < 1) {
      return;
    }

    this.divLayer.clear(true);
    const data = new TopologyData(this.caches.list[--this.caches.index]);
    this.data.pens.splice(0, this.data.pens.length);
    this.data.pens.push.apply(this.data.pens, data.pens);
    this.render(true);
    this.divLayer.render();

    if (noRedo) {
      this.caches.list.splice(this.caches.index + 1, this.caches.list.length - this.caches.index - 1);
    }

    this.dispatch('undo', this.data);
  }

  redo(force?: boolean) {
    if ((!force && this.data.locked) || this.caches.index > this.caches.list.length - 2) {
      return;
    }
    this.divLayer.clear(true);
    const data = new TopologyData(this.caches.list[++this.caches.index]);
    this.data.pens.splice(0, this.data.pens.length);
    this.data.pens.push.apply(this.data.pens, data.pens);
    this.render(true);
    this.divLayer.render();

    this.dispatch('redo', this.data);
  }

  toImage(padding: Padding = 0, type = 'image/png', quality = 1, callback: any = null): string {
    const rect = this.getRect();
    const p = formatPadding(padding || 0);
    rect.x -= p[3];
    rect.y -= p[0];
    rect.width += p[3] + p[1];
    rect.height += p[0] + p[2];

    // const dpi = this.offscreen.getDpiRatio();
    // const dpiRect = rect.clone();
    // dpiRect.scale(dpi);

    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    // ctx.scale(dpi, dpi);

    if (type && type !== 'image/png') {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (this.data.bkColor || this.options.bkColor) {
      ctx.fillStyle = this.data.bkColor || this.options.bkColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (this.data.bkImage) {
      ctx.drawImage(this.canvas.bkImg, 0, 0, canvas.width, canvas.height);
    }

    for (const item of this.data.pens) {
      let pen: Pen;
      if (item.type) {
        pen = new Line(item);
      } else {
        pen = new Node(item);
      }

      pen.translate(-rect.x, -rect.y);
      pen.render(ctx);
    }

    if (callback) {
      canvas.toBlob(callback);
    }
    return canvas.toDataURL(type, quality);
  }

  saveAsImage(name?: string, padding: Padding = 0, type: string = 'image/png', quality = 1) {
    const a = document.createElement('a');
    a.setAttribute('download', name || 'le5le.topology.png');
    a.setAttribute('href', this.toImage(padding, type, quality));
    const evt = document.createEvent('MouseEvents');
    evt.initEvent('click', true, true);
    a.dispatchEvent(evt);
  }

  // param:
  //       - string ->idOrTag
  //       - Pen[]  -> will deletes
  delete(param?: string | Pen[], force?: boolean) {
    if (this.data.locked && !force) {
      return;
    }

    let deleted: Pen[] = [];
    if (typeof param === 'string') {
      deleted = del(param, this.data.pens);
    } else {
      const pens: Pen[] = param || this.activeLayer.pens;

      for (let i = 0; i < pens.length; i++) {
        const item = pens[i];

        if (del(item.id, this.data.pens).length) {
          deleted.push(item);
          --i;
          if (item.type === PenType.Node) {
            this.divLayer.removeDiv(item as Node);
          }
          if (this.options.disableEmptyLine) {
            this.delEmptyLines(item.id);
          }
          this.animateLayer.pens.delete(item.id);
        }
      }
    }

    if (deleted.length) {
      this.render(true);
      this.cache();

      this.dispatch('delete', deleted);
    }
  }

  delEmptyLines(deleteedId?: string) {
    for (let i = 0; i < this.data.pens.length; i++) {
      if (this.data.pens[i].type !== PenType.Line) {
        continue;
      }

      const line = this.data.pens[i] as Line;
      if (!line.from.id || !line.to.id || line.from.id === deleteedId || line.to.id === deleteedId) {
        this.data.pens.splice(i, 1);
        this.animateLayer.pens.delete(line.id);
        --i;
      }
    }
  }

  cut() {
    if (this.data.locked) {
      return;
    }

    this.clipboard = new TopologyData({
      pens: [],
    });
    for (let i = 0; i < this.activeLayer.pens.length; i++) {
      const pen = this.activeLayer.pens[i];
      this.clipboard.pens.push(pen.clone());
      const found = this.findIndex(pen);
      if (found > -1) {
        if (pen.type === PenType.Node) {
          this.divLayer.removeDiv(this.data.pens[found] as Node);
        }
        this.data.pens.splice(found, 1);
        --i;
      }
    }

    this.cache();

    this.activeLayer.clear();
    this.hoverLayer.node = null;
    this.moveIn.hoverLine = null;
    this.moveIn.hoverNode = null;

    this.render();

    this.dispatch('delete', this.clipboard.pens);
  }

  copy() {
    this.clipboard = new TopologyData({
      pens: [],
    });
    for (const pen of this.activeLayer.pens) {
      this.clipboard.pens.push(pen.clone());
    }
    this.dispatch('copy', this.clipboard);
  }

  paste() {
    if (!this.clipboard || this.data.locked) {
      return;
    }

    this.hoverLayer.node = null;
    this.hoverLayer.line = null;

    this.activeLayer.pens = [];

    const idMaps: any = {};
    for (const pen of this.clipboard.pens) {
      if (pen.type === PenType.Node) {
        this.newId(pen, idMaps);
        pen.rect.x += 20;
        pen.rect.ex += 20;
        pen.rect.y += 20;
        pen.rect.ey += 20;
        (pen as Node).init();
      }
      if (pen instanceof Line) {
        pen.id = s8();
        pen.from = new Point(
          pen.from.x + 20,
          pen.from.y + 20,
          pen.from.direction,
          pen.from.anchorIndex,
          idMaps[pen.from.id]
        );
        pen.to = new Point(pen.to.x + 20, pen.to.y + 20, pen.to.direction, pen.to.anchorIndex, idMaps[pen.to.id]);
        const controlPoints = [];
        for (const pt of pen.controlPoints) {
          controlPoints.push(new Point(pt.x + 20, pt.y + 20));
        }
        pen.controlPoints = controlPoints;
      }
      this.data.pens.push(pen);
      this.activeLayer.add(pen);
    }

    this.render();
    this.animate(true);
    this.cache();
    this.copy();

    if (this.clipboard.pens.length > 1) {
      this.dispatch('paste', {
        pens: this.clipboard.pens,
      });
    } else if (this.activeLayer.pens.length > 0) {
      this.dispatch('paste', this.activeLayer.pens[0]);
    }

    this.overflow();
  }

  newId(node: any, idMaps: any) {
    const old = node.id;
    node.id = s8();
    idMaps[old] = node.id;
    if (node.children) {
      for (const item of node.children) {
        this.newId(item, idMaps);
      }
    }
  }

  animate(autoplay = false) {
    this.animateLayer.readyPlay(null, autoplay);
    this.animateLayer.animate();
  }

  updateProps(cache: boolean = true, pens?: Pen[]) {
    if (!pens) {
      pens = this.activeLayer.pens;
    }
    for (const pen of pens) {
      if (pen instanceof Node) {
        if (pen.autoRect) {
          const ctx = this.canvas.canvas.getContext('2d');
          const rect = calcTextRect(ctx, pen);
          pen.rect.width = rect.width + pen.lineWidth * 2;
          pen.rect.height = rect.height;
        }

        pen.init();
        pen.initRect();
      }
    }

    this.activeLayer.updateLines(pens);
    this.activeLayer.calcControlPoints();
    this.activeLayer.saveNodeRects();

    this.render();
    // tslint:disable-next-line: no-unused-expression
    cache && this.cache();
  }

  lock(lock: Lock) {
    this.data.locked = lock;
    for (const item of this.data.pens) {
      (item as any).addToDiv && (item as any).addToDiv();
    }

    this.dispatch('locked', this.data.locked);
  }

  lockPens(pens: Pen[], lock: Lock) {
    for (const item of this.data.pens) {
      for (const pen of pens) {
        if (item.id === pen.id) {
          item.locked = lock;
          (item as any).addToDiv && (item as any).addToDiv();
          break;
        }
      }
    }

    this.dispatch('lockPens', {
      pens,
      lock,
    });
  }

  up(pen: Pen, pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }
    const i = this.findIndex(pen, pens);

    if (i > -1 && i !== pens.length - 1) {
      pens.splice(i + 2, 0, pens[i]);
      pens.splice(i, 1);
    } else {
      const parent = getParent(pens, pen);
      if (!parent) {
        return;
      }

      this.up(pen, parent.children);
    }
  }

  top(pen: Pen, pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }
    const i = this.findIndex(pen, pens);
    if (i > -1) {
      pens.push(pens[i]);
      pens.splice(i, 1);
    } else {
      const parent = getParent(pens, pen);
      if (!parent) {
        return;
      }

      this.top(pen, parent.children);
    }
  }

  down(pen: Pen, pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }
    const i = this.findIndex(pen, pens);
    if (i > -1 && i !== 0) {
      pens.splice(i - 1, 0, pens[i]);
      pens.splice(i + 1, 1);
    } else {
      const parent = getParent(pens, pen);
      if (!parent) {
        return;
      }

      this.down(pen, parent.children);
    }
  }

  bottom(pen: Pen, pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }
    const i = this.findIndex(pen, pens);
    if (i > -1) {
      pens.unshift(pens[i]);
      pens.splice(i + 1, 1);
    } else {
      const parent = getParent(pens, pen);
      if (!parent) {
        return;
      }

      this.bottom(pen, parent.children);
    }
  }

  getParent(pen: Pen) {
    return getParent(this.data.pens, pen);
  }

  combine(pens?: Pen[], stand = false) {
    if (!pens) {
      pens = this.activeLayer.pens;
    }

    const rect = this.getRect(pens);
    for (const item of pens) {
      const i = this.findIndex(item);
      if (i > -1) {
        this.data.pens.splice(i, 1);
      }
    }

    let node = new Node({
      name: 'combine',
      rect: new Rect(rect.x, rect.y, rect.width, rect.height),
      text: '',
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      strokeStyle: 'transparent',
      children: [],
    });

    for (let i = 0; i < pens.length; ++i) {
      if (pens[i].type === PenType.Node && rect.width === pens[i].rect.width && rect.height === pens[i].rect.height) {
        node = pens[i] as Node;
        if (!node.children) {
          node.children = [];
        }
        pens.splice(i, 1);
        break;
      }
    }

    for (const item of pens) {
      item.stand = stand;
      item.parentId = node.id;
      item.calcRectInParent(node);
      node.children.push(item);
    }
    this.data.pens.push(node);

    this.activeLayer.setPens([node]);

    this.dispatch('node', node);

    this.cache();
  }

  uncombine(node?: Pen) {
    if (!node) {
      node = this.activeLayer.pens[0];
    }

    if (!(node instanceof Node)) {
      return;
    }

    for (const item of node.children) {
      item.parentId = undefined;
      item.rectInParent = undefined;
      item.locked = Lock.None;
      this.data.pens.push(item);
    }

    const i = this.findIndex(node);
    if (i > -1 && node.name === 'combine') {
      this.data.pens.splice(i, 1);
    } else {
      node.children = null;
    }

    this.cache();

    this.activeLayer.clear();
    this.hoverLayer.clear();

    this.dispatch('space', null);
  }

  find(idOrTag: string, pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }

    return find(idOrTag, pens);
  }

  findIndex(pen: Pen, pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }

    return pens.findIndex((item: Pen) => item.id === pen.id);
  }

  translate(x: number, y: number, process?: boolean, noNotice?: boolean) {
    if (!process) {
      this.lastTranlated.x = 0;
      this.lastTranlated.y = 0;
    }
    const offsetX = x - this.lastTranlated.x;
    const offsetY = y - this.lastTranlated.y;

    for (const item of this.data.pens) {
      item.translate(offsetX, offsetY);
    }
    this.animateLayer.pens.forEach((pen) => {
      if (pen instanceof Line) {
        pen.translate(offsetX, offsetY);
      }
    });

    this.lastTranlated.x = x;
    this.lastTranlated.y = y;
    this.render();
    this.cache();

    !noNotice && this.dispatch('translate', { x, y });
  }

  // scale for scaled canvas:
  //   > 1, expand
  //   < 1, reduce
  scale(scale: number, center?: Point) {
    if (this.data.scale * scale < this.options.minScale || this.data.scale * scale > this.options.maxScale) {
      return;
    }

    this.data.scale = Math.round(this.data.scale * scale * 100) / 100;
    !center && (center = this.getRect().center);

    for (const item of this.data.pens) {
      item.scale(scale, center);
    }
    this.animateLayer.pens.forEach((pen) => {
      if (pen instanceof Line) {
        pen.scale(scale, center);
      }
    });
    Store.set(this.generateStoreKey('LT:scale'), this.data.scale);

    this.render();
    this.cache();

    this.dispatch('scale', this.data.scale);
  }

  // scale for origin canvas:
  scaleTo(scale: number, center?: Point) {
    this.scale(scale / this.data.scale, center);
  }

  round() {
    for (const item of this.data.pens) {
      if (item instanceof Node) {
        item.round();
      }
    }
  }

  centerView(padding?: Padding) {
    if (!this.hasView()) return;
    const rect = this.getRect();
    const viewCenter = this.getViewCenter(padding);
    const { center } = rect;
    this.translate(viewCenter.x - center.x, viewCenter.y - center.y);
    const { parentElem } = this.canvas;
    const x = (parentElem.scrollWidth - parentElem.offsetWidth) / 2;
    const y = (parentElem.scrollHeight - parentElem.offsetHeight) / 2;
    parentElem.scrollTo(x, y);
    return true;
  }

  fitView(viewPadding?: Padding) {
    if (!this.hasView()) return;
    // 1. 重置画布尺寸为容器尺寸
    const { parentElem } = this.canvas;
    const { offsetWidth: width, offsetHeight: height } = parentElem;
    this.resize({
      width,
      height,
    });
    // 2. 图形居中
    this.centerView(viewPadding);
    // 3. 获取设置的留白值
    const padding = formatPadding(viewPadding || this.options.viewPadding);
    // 4. 获取图形尺寸
    const rect = this.getRect();
    // 6. 计算缩放比
    const w = (width - padding[1] - padding[3]) / rect.width;
    const h = (height - padding[0] - padding[2]) / rect.height;
    let ratio = w;
    if (w > h) {
      ratio = h;
    }
    this.scale(ratio);
  }

  hasView() {
    const rect = this.getRect();
    return !(rect.width === 99999 || rect.height === 99999);
  }

  getViewCenter(viewPadding?: Padding) {
    const padding = formatPadding(viewPadding || this.options.viewPadding);
    const { width, height } = this.canvas;
    return {
      x: (width - padding[1] - padding[3]) / 2 + padding[3],
      y: (height - padding[0] - padding[2]) / 2 + padding[0],
    };
  }

  generateStoreKey(key: string) {
    return `${this.id}-${key}`;
  }

  private createMarkdownTip() {
    this.tipMarkdown = document.createElement('div');
    this.tipMarkdown.style.position = 'fixed';
    this.tipMarkdown.style.zIndex = '-1';
    this.tipMarkdown.style.left = '-9999px';
    this.tipMarkdown.style.width = '260px';
    this.tipMarkdown.style.outline = 'none';
    this.tipMarkdown.style.border = '1px solid #333';
    this.tipMarkdown.style.backgroundColor = 'rgba(0,0,0,.7)';
    this.tipMarkdown.style.color = '#fff';
    this.tipMarkdown.style.padding = '10px 15px';
    this.tipMarkdown.style.overflowY = 'auto';
    this.tipMarkdown.style.minHeight = '30px';
    this.tipMarkdown.style.maxHeight = '260px';
    document.body.appendChild(this.tipMarkdown);
  }

  private showTip(data: Pen, pos: { x: number; y: number }) {
    if (!data || data.id === this.tip || this.data.tooltip === false || this.data.tooltip === 0) {
      return;
    }

    if (data.title) {
      this.divLayer.canvas.title = data.title;
      this.tip = data.id;
      return;
    }

    if (data.tipId) {
      this.tipElem = document.getElementById(data.tipId);
    }

    let elem = this.tipElem;
    if (data.markdown) {
      elem = this.tipMarkdown;
      const marked = (window as any).marked;
      if (marked) {
        this.tipMarkdown.innerHTML = marked(data.markdown);
      } else {
        this.tipMarkdown.innerHTML = data.markdown;
      }
      const a = this.tipMarkdown.getElementsByTagName('A');
      for (let i = 0; i < a.length; ++i) {
        a[i].setAttribute('target', '_blank');
      }
    }

    if (!elem) {
      return;
    }

    const parentRect = this.parentElem.getBoundingClientRect();
    const elemRect = elem.getBoundingClientRect();
    let x = (parentRect.left || parentRect.x) + data.rect.x;
    let y = pos.y + (parentRect.top || parentRect.y);
    if (data instanceof Node) {
      y = (parentRect.top || parentRect.y) + (data as Node).rect.ey;
    }

    x -= this.parentElem.scrollLeft;
    y -= this.parentElem.scrollTop;

    if (x < 0) {
      x = 0;
    }
    if (x + elemRect.width > document.body.clientWidth) {
      x = document.body.clientWidth - elemRect.width;
    }
    if (y + elemRect.height > document.body.clientHeight) {
      y = document.body.clientHeight - elemRect.height;
    }

    elem.style.display = 'block';
    elem.style.position = 'fixed';
    elem.style.left = x + 'px';
    elem.style.top = y + 'px';
    elem.style.zIndex = '100';

    this.tip = data.id;

    this.dispatch('tip', elem);
  }

  private hideTip() {
    if (!this.tip) {
      return;
    }
    this.tipMarkdown.style.left = '-9999px';
    this.tipMarkdown.style.zIndex = '-1';
    if (this.tipElem) {
      this.tipElem.style.left = '-9999px';
      this.tipElem.style.zIndex = '-1';
      this.tipElem = null;
    }
    this.divLayer.canvas.title = '';

    this.tip = '';
  }

  scroll(x: number, y: number) {
    if (this.scrolling) {
      return;
    }
    this.scrolling = true;
    this.parentElem.scrollLeft += x;
    this.parentElem.scrollTop += y;
    setTimeout(() => {
      this.scrolling = false;
    }, 700);
  }

  toComponent(pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }

    const rect = this.getRect(pens);
    let node = new Node({
      name: 'combine',
      rect: new Rect(rect.x, rect.y, rect.width, rect.height),
      text: '',
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      strokeStyle: 'transparent',
      children: [],
    });

    for (const item of pens) {
      if (item.type === PenType.Node && rect.width === item.rect.width && rect.height === item.rect.height) {
        node = item as Node;
        if (!node.children) {
          node.children = [];
        }
        break;
      }
    }

    for (const item of pens) {
      if (item !== node) {
        item.parentId = node.id;
        item.calcRectInParent(node);
        node.children.push(item);
      }
    }

    return node;
  }

  clearBkImg() {
    this.canvas.clearBkImg();
  }

  dispatch(event: string, data: any) {
    if (this.options.on) {
      this.options.on(event, data);
    }
    this.fire(event, data);
    return this;
  }

  on(eventType: EventType, handler: Handler) {
    this._emitter.on(eventType, handler);
    return this;
  }

  off(eventType: EventType, handler: Handler) {
    this._emitter.off(eventType, handler);
    return this;
  }

  fire(eventType: EventType, params: any) {
    this._emitter.emit(eventType, params);
    return this;
  }

  getValue(idOrTag: string, attr = 'text') {
    let pen: Pen;
    this.data.pens.forEach((item) => {
      if (item.id === idOrTag || item.tags.indexOf(idOrTag) > -1) {
        pen = item;
        return;
      }
    });

    return pen[attr];
  }

  setValue(idOrTag: string, val: any, attr = 'text') {
    this.data.pens.forEach((item) => {
      if (item.id === idOrTag || item.tags.indexOf(idOrTag) > -1) {
        item[attr] = val;
      }
    });
  }

  setLineName(name: 'curve' | 'line' | 'polyline' | 'mind', render = true) {
    this.data.pens.forEach((pen: Pen) => {
      if (pen.type) {
        (pen as Line).name = name;
        (pen as Line).calcControlPoints();
      }
    });

    render && this.render();
  }

  setColor(color: string) {
    this.options.color = color;
    Store.set(this.generateStoreKey('LT:color'), color);

    this.options.font.color = color;
    Store.set(this.generateStoreKey('LT:fontColor'), color);
  }

  setFontColor(color: string) {
    this.options.font.color = color;
    Store.set(this.generateStoreKey('LT:fontColor'), color);
  }

  setIconColor(color: string) {
    Store.set(this.generateStoreKey('LT:iconColor'), color);
  }

  pureData() {
    const data = JSON.parse(JSON.stringify(this.data));
    data.pens.forEach((pen: any) => {
      for (const key in pen) {
        if (pen[key] === null || pen[key] === undefined || pen[key] === '') {
          delete pen[key];
        }
      }

      delete pen.TID;
      delete pen.animateCycleIndex;
      delete pen.img;
      delete pen.lastImage;
      delete pen.imgNaturalWidth;
      delete pen.imgNaturalHeight;
      delete pen.anchors;
      delete pen.rotatedAnchors;
      delete pen.dockWatchers;
      delete pen.elementLoaded;
      delete pen.elementRendered;

      this.pureDataChildren(pen);
    });

    return data;
  }

  pureDataChildren(data: any) {
    if (!data.children) {
      return;
    }

    data.children.forEach((pen: any) => {
      for (const key in pen) {
        if (pen[key] === null || pen[key] === undefined || pen[key] === '') {
          delete pen[key];
        }
      }

      delete pen.TID;
      delete pen.animateCycleIndex;
      delete pen.img;
      delete pen.lastImage;
      delete pen.imgNaturalWidth;
      delete pen.imgNaturalHeight;
      delete pen.anchors;
      delete pen.rotatedAnchors;
      delete pen.dockWatchers;
      delete pen.elementLoaded;
      delete pen.elementRendered;

      this.pureDataChildren(pen);
    });
  }

  destroy() {
    this.subcribe.unsubscribe();
    this.subcribeRender.unsubscribe();
    this.subcribeImage.unsubscribe();
    this.subcribeAnimateEnd.unsubscribe();
    this.subcribeAnimateMoved.unsubscribe();
    this.subcribeMediaEnd.unsubscribe();
    this.animateLayer.destroy();
    this.divLayer.destroy();
    document.body.removeChild(this.tipMarkdown);
    window.removeEventListener('resize', this.winResize);
    this.parentElem.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('gesturestart', this.preventDefault);

    switch (this.options.keydown) {
      case KeydownType.Document:
        document.removeEventListener('keydown', this.onkeydown);
        break;
      case KeydownType.Canvas:
        this.divLayer.canvas.removeEventListener('keydown', this.onkeydown);
        break;
    }
    this.closeSocket();
    this.closeMqtt();
    (window as any).topology = null;
  }
}
