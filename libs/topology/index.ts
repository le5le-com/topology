import { Store, Observer } from 'le5le-store';

import { Options, KeyType, KeydownType, DefalutOptions } from './options';
import { Pen, PenType } from './models/pen';
import { Node, images } from './models/node';
import { Point } from './models/point';
import { Line } from './models/line';
import { TopologyData } from './models/data';
import { Lock, AnchorMode } from './models/status';
import { drawNodeFns, drawLineFns } from './middles/index';
import { Offscreen } from './offscreen';
import { RenderLayer } from './renderLayer';
import { HoverLayer } from './hoverLayer';
import { ActiveLayer } from './activeLayer';
import { AnimateLayer } from './animateLayer';
import { DivLayer } from './divLayer';
import { Rect } from './models/rect';
import { s8 } from './uuid/uuid';
import { getBezierPoint } from './middles/lines/curve';
import { pointInRect } from './utils';
import { diffData } from './diff';

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
  Rotate
}

interface ICaches {
  index: number;
  list: TopologyData[];
}

const dockOffset = 10;

export class Topology {
  data: TopologyData = new TopologyData();
  clipboard: TopologyData;
  caches: ICaches = {
    index: 0,
    list: []
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
  private subcribeImage: Observer;
  private imageTimer: any;
  private subcribeAnimateEnd: Observer;
  private subcribeAnimateMoved: Observer;
  private subcribeMediaEnd: Observer;

  touchedNode: any;
  lastHoverNode: Node;
  lastHoverLine: Line;
  input = document.createElement('textarea');
  inputObj: Pen;
  mouseDown: { x: number; y: number; };
  lastTranlated = { x: 0, y: 0 };
  moveIn: {
    type: MoveInType;
    activeAnchorIndex: number;
    hoverAnchorIndex: number;
    hoverNode: Node;
    hoverLine: Line;
    lineControlPoint: Point;
  } = {
      type: MoveInType.None,
      activeAnchorIndex: 0,
      hoverAnchorIndex: 0,
      hoverNode: null,
      hoverLine: null,
      lineControlPoint: null
    };
  needCache = false;

  private tip = '';
  tipMarkdown: HTMLElement;
  tipElem: HTMLElement;

  private scheduledAnimationFrame = false;

  private scrolling = false;
  constructor(parent: string | HTMLElement, options?: Options) {
    Store.set('topology-data', this.data);

    if (!options) {
      options = {};
    }
    const font = Object.assign({}, DefalutOptions.font, options.font);
    options.font = font;
    this.options = Object.assign({}, DefalutOptions, options);

    if (typeof parent === 'string') {
      this.parentElem = document.getElementById(parent);
    } else {
      this.parentElem = parent;
    }
    this.parentElem.style.position = 'relative';

    this.activeLayer = new ActiveLayer(this.options);
    this.hoverLayer = new HoverLayer(this.options);
    this.animateLayer = new AnimateLayer(this.options);
    this.offscreen = new Offscreen(this.parentElem, this.options);
    this.canvas = new RenderLayer(this.parentElem, this.options);
    this.divLayer = new DivLayer(this.parentElem, this.options);

    this.resize();

    this.divLayer.canvas.ondragover = event => event.preventDefault();
    this.divLayer.canvas.ondrop = event => {
      this.ondrop(event);
    };

    this.subcribe = Store.subscribe('LT:render', () => {
      this.render();
    });
    this.subcribeImage = Store.subscribe('LT:imageLoaded', () => {
      if (this.imageTimer) {
        clearTimeout(this.imageTimer);
      }
      this.imageTimer = setTimeout(() => {
        this.render();
      }, 100);
    });
    this.subcribeAnimateMoved = Store.subscribe('nodeRectChanged', (e: any) => {
      this.activeLayer.updateLines(this.data.pens);
    });
    this.subcribeMediaEnd = Store.subscribe('mediaEnd', (node: Node) => {
      if (node.nextPlay) {
        this.animateLayer.pens.push.apply(this.animateLayer.pens, this.animateLayer.readyPlay(node.nextPlay));
        this.animateLayer.animate();
      }
      this.dispatch('mediaEnd', node);
    });
    this.subcribeAnimateEnd = Store.subscribe('animateEnd', (e: any) => {
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

    this.divLayer.canvas.onmousemove = this.onMouseMove;
    this.divLayer.canvas.onmousedown = this.onmousedown;
    this.divLayer.canvas.onmouseup = this.onmouseup;
    this.divLayer.canvas.ondblclick = this.ondblclick;
    this.divLayer.canvas.tabIndex = 0;
    this.divLayer.canvas.onblur = () => {
      this.mouseDown = null;
    };
    this.divLayer.canvas.onwheel = event => {
      if (this.options.disableScale) {
        return;
      }
      switch (this.options.scaleKey) {
        case KeyType.None:
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
        default:
          if (!event.ctrlKey && !event.altKey) {
            return;
          }
      }
      event.preventDefault();

      if (event.deltaY < 0) {
        this.scale(1.1);
      } else {
        this.scale(0.9);
      }

      this.divLayer.canvas.focus();

      return false;
    };

    this.divLayer.canvas.ontouchend = event => {
      this.ontouched(event);
    };

    switch (this.options.keydown) {
      case KeydownType.Document:
        document.onkeydown = this.onkeydown;
        break;
      case KeydownType.Canvas:
        this.divLayer.canvas.onkeydown = this.onkeydown;
        break;
    }

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

    this.cache();
  }

  resize(size?: { width: number; height: number; }) {
    this.canvas.resize(size);
    this.offscreen.resize(size);
    this.divLayer.resize(size);

    this.render();
    this.dispatch('resize', size);
  }

  private ondrop(event: DragEvent) {
    event.preventDefault();
    try {
      const json = JSON.parse(event.dataTransfer.getData('Text'));
      json.rect.x = (event.offsetX - json.rect.width / 2) << 0;
      json.rect.y = (event.offsetY - json.rect.height / 2) << 0;

      if (json.name === 'lineAlone') {
        this.addLineByPt(
          this.data.lineName,
          new Point(json.rect.x, json.rect.y),
          this.data.fromArrowType,
          new Point(json.rect.x + json.rect.width, json.rect.y + json.rect.height),
          this.data.toArrowType,
          this.options.color,
          true
        );
      } else {
        const node = new Node(json);
        this.addNode(node, true);
        if (node.name === 'div') {
          this.dispatch('LT:addDiv', node);
        }
      }

      this.divLayer.canvas.focus();
    } catch (e) {
    }
  }

  getTouchOffset(touch: Touch) {
    let currentTarget: any = this.parentElem;
    let x = 0;
    let y = 0;
    while (currentTarget) {
      x += currentTarget.offsetLeft;
      y += currentTarget.offsetTop;
      currentTarget = currentTarget.offsetParent;
    }
    return { offsetX: touch.pageX - x, offsetY: touch.pageY - y };
  }

  private ontouched(event: TouchEvent) {
    if (!this.touchedNode) {
      return;
    }

    const pos = this.getTouchOffset(event.changedTouches[0]);
    this.touchedNode.rect.x = pos.offsetX - this.touchedNode.rect.width / 2;
    this.touchedNode.rect.y = pos.offsetY - this.touchedNode.rect.height / 2;

    this.addNode(new Node(this.touchedNode), true);
    this.touchedNode = undefined;
  }

  addNode(node: Node | any, focus = false): boolean {
    if (this.data.locked || !drawNodeFns[node.name]) {
      return false;
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

    this.data.pens.push(node);
    // New active.
    if (focus) {
      this.activeLayer.setPens([node]);
    }

    this.render();
    this.cache();
    this.dispatch('addNode', node);
    return true;
  }

  addLine(line: Line, focus = false) {
    if (this.data.locked) {
      return false;
    }

    // New active.
    if (focus) {
      this.activeLayer.setPens([line]);
    }

    this.data.pens.push(line);
    this.render();

    this.cache();
    this.dispatch('addLine', line);
  }

  addLineByPt(name: string, from: Point, fromArrow: string, to: Point, toArrow: string, strokeStyle = this.options.color, focus = false) {
    const line = new Line({
      name,
      from,
      fromArrow,
      to,
      toArrow,
      strokeStyle
    });
    line.calcControlPoints(true);
    this.addLine(line, focus);

    return line;
  }

  // Render or redraw
  render(noFocus = false) {
    if (noFocus) {
      this.activeLayer.pens = [];
      this.hoverLayer.node = null;
      this.hoverLayer.line = null;
    }

    this.offscreen.render();
    this.canvas.render();
  }

  // open - redraw by the data
  open(data: any) {
    this.divLayer.clear();
    // tslint:disable-next-line:forin
    for (const key in images) {
      delete images[key];
    }

    this.animateLayer.stop();
    this.lock(data.locked || Lock.None);

    if (data.lineName) {
      this.data.lineName = data.lineName;
    }

    this.data.scale = data.scale || 1;
    Store.set('LT:scale', this.data.scale);
    this.dispatch('scale', this.data.scale);

    this.data.bkColor = data.bkColor;
    this.data.bkImage = data.bkImage;
    this.data.pens = [];

    // for old data.
    if (data.nodes) {
      for (const item of data.nodes) {
        this.data.pens.push(new Node(item));
      }
      for (const item of data.lines) {
        this.data.pens.push(new Line(item));
      }
    }
    // end.

    if (data.pens) {
      for (const item of data.pens) {
        if (!item.from) {
          this.data.pens.push(new Node(item));
        } else {
          this.data.pens.push(new Line(item));
        }
      }
    }

    this.data.grid = data.grid;
    if (typeof data.data === 'object') {
      this.data.data = JSON.parse(JSON.stringify(data.data));
    } else {
      this.data.data = data.data || '';
    }

    this.caches.list = [];
    this.cache();

    this.overflow();
    this.render(true);

    this.animate();
  }

  overflow() {
    const rect = this.getRect();
    let { width, height } = this.canvas;
    const { ex, ey } = rect;
    if (ex > width) {
      width = ex + 200;
    }
    if (ey > height) {
      height = ey + 200;
    }
    this.resize({ width, height });
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

  private onMouseMove = (e: MouseEvent) => {
    if (this.scheduledAnimationFrame || this.data.locked === Lock.NoEvent) {
      return;
    }

    if (this.mouseDown && this.moveIn.type === MoveInType.None) {
      let b = false;
      switch (this.options.translateKey) {
        case KeyType.None:
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
      if (b) {
        this.translate(e.offsetX - this.mouseDown.x, e.offsetY - this.mouseDown.y, true);
        return false;
      }
    }

    if (this.data.locked && this.mouseDown && this.moveIn.type !== MoveInType.None) {
      return;
    }

    this.scheduledAnimationFrame = true;
    const pos = new Point(e.offsetX, e.offsetY);
    requestAnimationFrame(() => {
      if (!this.mouseDown) {
        this.getMoveIn(pos);

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

            this.showTip(this.moveIn.hoverNode, pos);
          }
        }

        if (this.moveIn.hoverLine !== this.lastHoverLine) {
          if (this.lastHoverLine) {
            this.dispatch('moveOutLine', this.lastHoverLine);

            this.hideTip();
          }

          if (this.moveIn.hoverLine) {
            this.dispatch('moveInLine', this.moveIn.hoverLine);

            this.showTip(this.moveIn.hoverLine, pos);
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
      const moveOutX =
        pos.x + 50 > this.parentElem.clientWidth + this.parentElem.scrollLeft;
      const moveOutY = pos.y + 50 > this.parentElem.clientHeight + this.parentElem.scrollTop;
      if (moveOutX || moveOutY) {
        this.dispatch('moveOutParent', pos);

        let resize = false;
        if (pos.x + 50 > this.divLayer.canvas.clientWidth) {
          this.canvas.width += 200;
          resize = true;
        }
        if (pos.y + 50 > this.divLayer.canvas.clientHeight) {
          this.canvas.height += 200;
          resize = true;
        }
        if (resize) {
          this.resize({ width: this.canvas.width, height: this.canvas.height });
        }

        this.scroll(moveOutX ? 100 : 0, moveOutY ? 100 : 0);
      }

      const moveLeft = pos.x - 100 < this.parentElem.scrollLeft;
      const moveTop = pos.y - 100 < this.parentElem.scrollTop;
      if (moveLeft || moveTop) {
        this.scroll(moveLeft ? -100 : 0, moveTop ? -100 : 0);
      }

      switch (this.moveIn.type) {
        case MoveInType.None:
          this.hoverLayer.dragRect = new Rect(
            this.mouseDown.x,
            this.mouseDown.y,
            pos.x - this.mouseDown.x,
            pos.y - this.mouseDown.y
          );
          break;
        case MoveInType.Nodes:
          if (this.activeLayer.locked()) {
            break;
          }

          const x = pos.x - this.mouseDown.x;
          const y = pos.y - this.mouseDown.y;
          if (x || y) {
            const offset = this.getDockPos(x, y);
            this.activeLayer.move(offset.x ? offset.x : x, offset.y ? offset.y : y);
            this.needCache = true;
          }
          break;
        case MoveInType.ResizeCP:
          this.activeLayer.resize(this.moveIn.activeAnchorIndex, this.mouseDown, pos);
          this.dispatch('resizePens', this.activeLayer.pens);
          this.needCache = true;
          break;
        case MoveInType.LineTo:
        case MoveInType.HoverAnchors:
          let arrow = this.data.toArrowType;
          if (this.moveIn.hoverLine) {
            arrow = this.moveIn.hoverLine.toArrow;
          }
          if (this.hoverLayer.line) {
            this.activeLayer.pens = [this.hoverLayer.line];
          }
          this.hoverLayer.lineTo(this.getLineDock(pos), arrow);
          this.needCache = true;
          break;
        case MoveInType.LineFrom:
          this.hoverLayer.lineFrom(this.getLineDock(pos));
          this.needCache = true;
          break;
        case MoveInType.LineMove:
          this.hoverLayer.lineMove(pos, this.mouseDown);
          this.needCache = true;
          break;
        case MoveInType.LineControlPoint:
          this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id].x = pos.x;
          this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id].y = pos.y;
          this.moveIn.hoverLine.textRect = null;
          if (drawLineFns[this.moveIn.hoverLine.name] && drawLineFns[this.moveIn.hoverLine.name].dockControlPointFn) {
            drawLineFns[this.moveIn.hoverLine.name].dockControlPointFn(
              this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id],
              this.moveIn.hoverLine
            );
          }
          this.needCache = true;
          Store.set('LT:updateLines', [this.moveIn.hoverLine]);
          break;
        case MoveInType.Rotate:
          if (this.activeLayer.pens.length) {
            this.activeLayer.offsetRotate(this.getAngle(pos));
            this.activeLayer.updateLines();
          }
          this.needCache = true;
          break;
      }

      this.render();
      this.scheduledAnimationFrame = false;
    });
  };

  private onmousedown = (e: MouseEvent) => {
    this.mouseDown = { x: e.offsetX, y: e.offsetY };

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
        if (e.ctrlKey) {
          this.activeLayer.add(this.moveIn.hoverLine);
          this.dispatch('multi', this.activeLayer.pens);
        } else {
          this.activeLayer.pens = [this.moveIn.hoverLine];
          this.dispatch('line', this.moveIn.hoverLine);
        }

        if (this.data.locked) {
          this.moveIn.hoverLine.click();
        }

        break;
      case MoveInType.LineMove:
        this.hoverLayer.initLine = new Line(this.moveIn.hoverLine);
      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.LineFrom:
      case MoveInType.LineTo:
        this.activeLayer.pens = [this.moveIn.hoverLine];
        this.dispatch('line', this.moveIn.hoverLine);

        this.hoverLayer.line = this.moveIn.hoverLine;

        break;
      case MoveInType.HoverAnchors:
        this.hoverLayer.line = this.addLineByPt(
          this.data.lineName,
          new Point(
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].x,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].y,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].direction,
            this.moveIn.hoverAnchorIndex,
            this.moveIn.hoverNode.id
          ),
          this.data.fromArrowType,
          new Point(
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].x,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].y,
          ),
          this.data.toArrowType
        );

      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.Nodes:
        if (!this.moveIn.hoverNode) {
          break;
        }

        if ((e.button || e.ctrlKey) && this.activeLayer.has(this.moveIn.hoverNode)) {
          break;
        }

        if (e.ctrlKey) {
          this.activeLayer.add(this.moveIn.hoverNode);


          if (this.activeLayer.pens.length > 1) {
            this.dispatch('multi', this.activeLayer.pens);
          } else {
            this.dispatch('node', this.moveIn.hoverNode);
          }

        } else {
          this.activeLayer.setPens([this.moveIn.hoverNode]);
          this.dispatch('node', this.moveIn.hoverNode);
        }

        if (this.data.locked) {
          this.moveIn.hoverNode.click();
        }

        break;
    }

    // Save node rects to move.
    if (this.activeLayer.pens.length) {
      this.activeLayer.saveNodeRects();
    }

    this.render();
  };

  private onmouseup = (e: MouseEvent) => {
    this.mouseDown = null;
    this.lastTranlated.x = 0;
    this.lastTranlated.y = 0;
    this.hoverLayer.dockAnchor = null;
    this.hoverLayer.dockLineX = 0;
    this.hoverLayer.dockLineY = 0;
    this.divLayer.canvas.style.cursor = 'default';

    if (this.hoverLayer.dragRect) {
      this.getPensInRect(this.hoverLayer.dragRect);

      if (this.activeLayer.pens && this.activeLayer.pens.length) {
        this.dispatch('multi', this.activeLayer.pens);
      }
    } else {
      switch (this.moveIn.type) {
        // Add the line.
        case MoveInType.HoverAnchors:
          // New active.
          if (this.hoverLayer.line) {
            if (this.hoverLayer.line.to.id || !this.options.disableEmptyLine) {
              this.activeLayer.pens = [this.hoverLayer.line];
              this.dispatch('addLine', this.hoverLayer.line);

            } else {
              this.data.pens.pop();
            }
          }

          this.offscreen.render();

          this.hoverLayer.line = null;
          break;
        case MoveInType.Rotate:
          this.activeLayer.updateRotate();
          break;

        case MoveInType.LineControlPoint:
          Store.set('pts-' + this.moveIn.hoverLine.id, null);
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
      this.dispatch('dblclick', {
        node: this.moveIn.hoverNode
      });


      if (this.moveIn.hoverNode.getTextRect().hit(new Point(e.offsetX, e.offsetY))) {
        this.showInput(this.moveIn.hoverNode);
      }

      if (this.data.locked) {
        this.moveIn.hoverNode.dblclick();
      }
    } else if (this.moveIn.hoverLine) {
      this.dispatch('dblclick', {
        line: this.moveIn.hoverLine
      });

      if (!this.moveIn.hoverLine.text || this.moveIn.hoverLine.getTextRect().hit(new Point(e.offsetX, e.offsetY))) {
        this.showInput(this.moveIn.hoverLine);
      }

      if (this.data.locked) {
        this.moveIn.hoverNode.dblclick();
      }
    }
  };

  private onkeydown = (key: KeyboardEvent) => {
    if (this.data.locked) {
      return;
    }

    let done = false;
    let moveX = 0;
    let moveY = 0;
    switch (key.keyCode) {
      // Delete
      case 8:
      case 46:
        if (
          (key.target as HTMLElement).tagName !== 'INPUT' && (key.target as HTMLElement).tagName !== 'TEXTAREA'
          && (this.activeLayer.pens.length)
        ) {
          this.delete();
        }
        break;
      // Left
      case 37:
        moveX = -5;
        if (key.ctrlKey) {
          moveX = -1;
        }
        done = true;
        break;
      // Top
      case 38:
        moveY = -5;
        if (key.ctrlKey) {
          moveY = -1;
        }
        done = true;
        break;
      // Right
      case 39:
        moveX = 5;
        if (key.ctrlKey) {
          moveX = 1;
        }
        done = true;
        break;
      // Down
      case 40:
        moveY = 5;
        if (key.ctrlKey) {
          moveY = 1;
        }
        done = true;
        break;
      case 88:
        if (key.ctrlKey && (key.target as HTMLElement).tagName !== 'INPUT' && (key.target as HTMLElement).tagName !== 'TEXTAREA') {
          this.cut();
        }
        break;
      case 67:
        if (key.ctrlKey && (key.target as HTMLElement).tagName !== 'INPUT' && (key.target as HTMLElement).tagName !== 'TEXTAREA') {
          this.copy();
        }
        break;
      case 86:
        if (key.ctrlKey && (key.target as HTMLElement).tagName !== 'INPUT' && (key.target as HTMLElement).tagName !== 'TEXTAREA') {
          this.paste();
        }
        break;
      case 89: // Y
        if (key.ctrlKey) {
          this.redo();
        }
        break;
      case 90: // Z
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

    if (moveX || moveY) {
      this.activeLayer.saveNodeRects();
      this.activeLayer.move(moveX, moveY);
      this.overflow();
      this.animateLayer.animate();
    }

    this.render();
    this.cache();
  };

  private getMoveIn(pt: Point) {
    this.lastHoverNode = this.moveIn.hoverNode; this.lastHoverLine = this.moveIn.hoverLine;
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
      this.divLayer.canvas.style.cursor = `url("${this.options.rotateCursor}"), auto`;
      return;
    }

    if (this.activeLayer.pens.length && pointInRect(pt, this.activeLayer.sizeCPs)) {
      this.moveIn.type = MoveInType.Nodes;
    }

    if (!this.data.locked && !this.activeLayer.locked() && !this.options.hideSizeCP) {
      for (let i = 0; i < this.activeLayer.sizeCPs.length; ++i) {
        if (this.activeLayer.sizeCPs[i].hit(pt, 10)) {
          this.moveIn.type = MoveInType.ResizeCP;
          this.moveIn.activeAnchorIndex = i;
          this.divLayer.canvas.style.cursor = resizeCursors[i];
          return;
        }
      }
    }

    // In active line.
    for (const item of this.activeLayer.pens) {
      if (!(item instanceof Line)) {
        continue;
      }
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

    this.divLayer.canvas.style.cursor = 'default';
    for (const item of this.data.pens) {
      if (item.locked) {
        continue;
      }

      if (item instanceof Node) {
        this.inNode(pt, item);
      }
    }

    if ((this.moveIn.type as any) === MoveInType.HoverAnchors) {
      return;
    }

    for (const item of this.data.pens) {
      if (item.locked) {
        continue;
      }

      if (item instanceof Line) {
        this.inLine(pt, item);
      }
    }
  }

  inChildNode(pt: Point, children: Node[]) {
    if (!children) {
      return null;
    }

    for (const item of children) {
      let node = this.inChildNode(pt, item.children);
      if (node) {
        return node;
      }

      node = this.inNode(pt, item);
      if (node) {
        return node;
      }
    }

    return null;
  }

  inNode(pt: Point, node: Node) {
    if (this.data.locked && node.locked) {
      return null;
    }

    const child = this.inChildNode(pt, node.children);
    if (child) {
      return child;
    }

    if (node.hit(pt)) {
      this.moveIn.hoverNode = node;
      this.moveIn.type = MoveInType.Nodes;
      this.divLayer.canvas.style.cursor = 'move';

      // Too small
      if (this.options.hideAnchor || node.rect.width < 20 || node.rect.height < 20) {
        return node;
      }

      for (let j = 0; j < node.rotatedAnchors.length; ++j) {
        if (node.rotatedAnchors[j].hit(pt, 5)) {
          if (!this.mouseDown && node.rotatedAnchors[j].mode === AnchorMode.In) {
            continue;
          }
          this.moveIn.hoverNode = node;
          this.moveIn.type = MoveInType.HoverAnchors;
          this.moveIn.hoverAnchorIndex = j;
          this.hoverLayer.hoverAnchorIndex = j;
          this.divLayer.canvas.style.cursor = 'crosshair';
          return node;
        }
      }

      return node;
    }

    if (this.options.hideAnchor || this.data.locked || node.locked) {
      return null;
    }

    if (node.hit(pt, 5)) {
      for (let j = 0; j < node.rotatedAnchors.length; ++j) {
        if (node.rotatedAnchors[j].hit(pt, 5)) {
          if (!this.mouseDown && node.rotatedAnchors[j].mode === AnchorMode.In) {
            continue;
          }
          this.moveIn.hoverNode = node;
          this.moveIn.type = MoveInType.HoverAnchors;
          this.moveIn.hoverAnchorIndex = j;
          this.hoverLayer.hoverAnchorIndex = j;
          this.divLayer.canvas.style.cursor = 'crosshair';
          return node;
        }
      }
    }

    return null;
  }

  inLine(point: Point, line: Line) {
    if (line.from.hit(point, 10)) {
      this.moveIn.type = MoveInType.LineFrom;
      this.moveIn.hoverLine = line;
      if (this.data.locked || line.locked) {
        this.divLayer.canvas.style.cursor = 'pointer';
      } else {
        this.divLayer.canvas.style.cursor = 'move';
      }
      return true;
    }

    if (line.to.hit(point, 10)) {
      this.moveIn.type = MoveInType.LineTo;
      this.moveIn.hoverLine = line;
      if (this.data.locked || line.locked) {
        this.divLayer.canvas.style.cursor = 'pointer';
      } else {
        this.divLayer.canvas.style.cursor = 'move';
      }
      return true;
    }

    if (line.pointIn(point)) {
      this.moveIn.type = MoveInType.LineMove;
      this.moveIn.hoverLine = line;
      this.divLayer.canvas.style.cursor = 'pointer';
      if (line.from.id || line.to.id) {
        this.moveIn.type = MoveInType.Line;
      }
      return true;
    }

    return false;
  }

  private getLineDock(point: Point) {
    this.hoverLayer.dockAnchor = null;
    for (const item of this.data.pens) {
      if (item instanceof Node) {
        if (item.rect.hit(point, 10)) {
          this.hoverLayer.node = item;
        }
        for (let i = 0; i < item.rotatedAnchors.length; ++i) {
          if (item.rotatedAnchors[i].mode && item.rotatedAnchors[i].mode !== AnchorMode.In) {
            continue;
          }
          if (item.rotatedAnchors[i].hit(point, 10)) {
            point.id = item.id;
            point.anchorIndex = i;
            point.direction = item.rotatedAnchors[point.anchorIndex].direction;
            point.x = item.rotatedAnchors[point.anchorIndex].x;
            point.y = item.rotatedAnchors[point.anchorIndex].y;
            this.hoverLayer.dockAnchor = item.rotatedAnchors[i];
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

  private getAngle(pt: Point) {
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

  private showInput(item: Pen) {
    if (this.data.locked || item.locked || item.hideInput || this.options.hideInput) {
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
    this.input.focus();
  }

  getRect(pens?: Pen[]) {
    if (!pens) {
      pens = this.data.pens;
    }

    let x1 = 99999;
    let y1 = 99999;
    let x2 = -99999;
    let y2 = -99999;

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
        points.push(item.from);
        points.push(item.to);
        if (item.name === 'curve') {
          for (let i = 0.01; i < 1; i += 0.02) {
            points.push(getBezierPoint(i, item.from, item.controlPoints[0], item.controlPoints[1], item.to));
          }
        }
      }

    }

    for (const item of points) {
      if (x1 > item.x) {
        x1 = item.x;
      }
      if (y1 > item.y) {
        y1 = item.y;
      }
      if (x2 < item.x) {
        x2 = item.x;
      }
      if (y2 < item.y) {
        y2 = item.y;
      }
    }

    return new Rect(x1, y1, x2 - x1, y2 - y1);
  }

  // Get a dock rect for moving nodes.
  getDockPos(offsetX: number, offsetY: number) {
    this.hoverLayer.dockLineX = 0;
    this.hoverLayer.dockLineY = 0;

    const offset = {
      x: 0,
      y: 0
    };

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
    if (this.caches.list.length === 0) {
      const data = new TopologyData(this.data);
      this.caches.list.push(data);
    } else {
      const len = this.caches.list.length;
      const data = diffData(this.caches.list[len - 1], this.data);
      this.caches.list.push(data);
    }
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

  undo(noRedo = false) {
    if (this.data.locked || this.caches.index < 1) {
      return;
    }

    this.divLayer.clear();
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

  redo() {
    if (this.data.locked || this.caches.index > this.caches.list.length - 2) {
      return;
    }
    this.divLayer.clear();
    const data = new TopologyData(this.caches.list[++this.caches.index]);
    this.data.pens.splice(0, this.data.pens.length);
    this.data.pens.push.apply(this.data.pens, data.pens);
    this.render(true);
    this.divLayer.render();

    this.dispatch('redo', this.data);
  }

  toImage(
    type?: string,
    quality?: any,
    callback?: any,
    padding?: { left: number; top: number; right: number; bottom: number; },
    thumbnail = true
  ): string {
    let rect = new Rect(0, 0, this.canvas.width, this.canvas.height);
    if (thumbnail) {
      rect = this.getRect();
    }
    if (!padding) {
      padding = {
        left: 10,
        top: 10,
        right: 10,
        bottom: 10
      };
    }
    rect.x -= padding.left;
    rect.y -= padding.top;
    rect.width += padding.left + padding.right;
    rect.height += padding.top + padding.bottom;
    rect.round();
    const srcRect = rect.clone();
    srcRect.scale(this.offscreen.getDpiRatio(), new Point(0, 0));
    srcRect.round();

    const canvas = document.createElement('canvas');
    canvas.width = srcRect.width;
    canvas.height = srcRect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    if (type && type !== 'image/png') {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(
      this.canvas.canvas,
      srcRect.x,
      srcRect.y,
      srcRect.width,
      srcRect.height,
      0,
      0,
      srcRect.width,
      srcRect.height
    );

    if (callback) {
      canvas.toBlob(callback);
      return '';
    }

    return canvas.toDataURL(type, quality);
  }

  saveAsImage(
    name?: string,
    type?: string,
    quality?: any,
    padding?: { left: number; top: number; right: number; bottom: number; },
    thumbnail = true
  ) {
    const a = document.createElement('a');
    a.setAttribute('download', name || 'le5le.topology.png');
    a.setAttribute('href', this.toImage(type, quality, null, padding, thumbnail));
    const evt = document.createEvent('MouseEvents');
    evt.initEvent('click', true, true);
    a.dispatchEvent(evt);
  }

  delete() {
    const pens: Pen[] = [];
    let i = 0;
    for (const line of this.activeLayer.pens) {
      i = this.find(line);
      if (i > -1) {
        if (this.data.pens[i].type === PenType.Node) {
          this.divLayer.removeDiv(this.data.pens[i] as Node);
        }
        pens.push.apply(pens, this.data.pens.splice(i, 1));
      }
    }

    this.animate(false);
    this.render(true);
    this.cache();


    this.dispatch('delete', pens);

  }

  removeNode(node: Node) {
    const i = this.find(node);
    if (i > -1) {
      this.divLayer.removeDiv(this.data.pens[i] as Node);
      const nodes = this.data.pens.splice(i, 1);
      this.dispatch('delete', {
        nodes
      });

    }

    this.render(true);
    this.cache();
  }

  removeLine(line: Line) {
    const i = this.find(line);
    if (i > -1) {
      const lines = this.data.pens.splice(i, 1);
      this.dispatch('delete', {
        lines
      });
    }

    this.render(true);
    this.cache();
  }

  cut() {
    if (this.data.locked) {
      return;
    }

    this.clipboard = new TopologyData({
      pens: []
    });
    for (const pen of this.activeLayer.pens) {
      this.clipboard.pens.push(pen.clone());
      const i = this.find(pen);
      if (i > -1) {
        if (pen.type === PenType.Node) {
          this.divLayer.removeDiv(this.data.pens[i] as Node);
        }
        this.data.pens.splice(i, 1);
      }
    }

    this.cache();

    this.activeLayer.clear();
    this.hoverLayer.node = null;
    this.moveIn.hoverLine = null;
    this.moveIn.hoverNode = null;

    this.render();

    this.dispatch('delete', {
      pens: this.clipboard.pens
    });

  }

  copy() {
    this.clipboard = new TopologyData({
      pens: []
    });
    for (const pen of this.activeLayer.pens) {
      this.clipboard.pens.push(pen.clone());
    }
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
    this.cache();
    this.copy();

    if (this.clipboard.pens.length > 1) {
      this.dispatch('multi', {
        pens: this.clipboard.pens
      });
    } else if (this.activeLayer.pens[0].type === PenType.Node) {
      this.dispatch('addNode', this.activeLayer.pens[0]);
    } else if (this.activeLayer.pens[0].type === PenType.Line) {
      this.dispatch('addLine', this.activeLayer.pens[0]);
    }
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
        pen.init();
        pen.initRect();
      }
    }

    this.activeLayer.updateLines(pens);
    this.activeLayer.calcControlPoints();
    this.activeLayer.saveNodeRects();
    this.activeLayer.changeLineType();

    this.render();
    // tslint:disable-next-line: no-unused-expression
    cache && this.cache();
  }

  lock(lock: number) {
    this.data.locked = lock;

    this.dispatch('locked', this.data.locked);

  }

  lockPens(pens: Pen[], lock: boolean) {
    for (const item of this.data.pens) {
      for (const node of pens) {
        if (item.id === node.id) {
          item.locked = lock;
          break;
        }
      }
    }


    this.dispatch('lockPens', {
      pens,
      lock
    });

  }

  top(pen: Pen) {
    const i = this.find(pen);
    if (i > -1) {
      this.data.pens.push(this.data.pens[i]);
      this.data.pens.splice(i, 1);
    }
  }

  bottom(pen: Pen) {
    const i = this.find(pen);
    if (i > -1) {
      this.data.pens.unshift(this.data.pens[i]);
      this.data.pens.splice(i + 1, 1);
    }
  }

  combine(pens?: Pen[], lockChildren = false) {
    if (!pens) {
      pens = this.activeLayer.pens;
    }

    const rect = this.getRect(pens);
    for (const item of pens) {
      const i = this.find(item);
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
      children: []
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
      item.locked = lockChildren;
      if (item instanceof Node) {
        item.parentId = node.id;
        item.calcRectInParent(node);

        node.children.push(item);
      }
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
      item.locked = false;
      this.data.pens.push(item);
    }

    const i = this.find(node);
    if (i > -1 && node.name === 'combine') {
      this.data.pens.splice(i, 1);
    } else {
      node.children = null;
    }

    this.cache();

    this.activeLayer.clear();
    this.hoverLayer.clear();
  }

  private find(pen: Pen) {
    for (let i = 0; i < this.data.pens.length; ++i) {
      if (pen.id === this.data.pens[i].id) {
        return i;
      }
    }

    return -1;
  }

  translate(x: number, y: number, process?: boolean) {
    if (!process) {
      this.lastTranlated.x = 0;
      this.lastTranlated.y = 0;
    }
    const offsetX = x - this.lastTranlated.x;
    const offsetY = y - this.lastTranlated.y;

    for (const item of this.data.pens) {
      item.translate(offsetX, offsetY);
    }

    this.lastTranlated.x = x;
    this.lastTranlated.y = y;
    this.overflow();
    this.render();
    this.cache();

    this.dispatch('translate', { x, y });

  }

  // scale for scaled canvas:
  //   > 1, expand
  //   < 1, reduce
  scale(scale: number) {
    if (this.data.scale * scale < this.options.minScale || this.data.scale * scale > this.options.maxScale) {
      return;
    }

    this.data.scale *= scale;
    const center = this.getRect().center;

    for (const item of this.data.pens) {
      item.scale(scale, center);
    }
    Store.set('LT:scale', this.data.scale);

    this.overflow();
    this.render();
    this.cache();


    this.dispatch('scale', this.data.scale);

  }

  // scale for origin canvas:
  scaleTo(scale: number) {
    this.scale(scale / this.data.scale);
  }

  round() {
    for (const item of this.data.pens) {
      if (item instanceof Node) {
        item.round();
      }
    }
  }

  private createMarkdownTip() {
    this.tipMarkdown = document.createElement('div');
    this.tipMarkdown.style.position = 'fixed';
    this.tipMarkdown.style.zIndex = '-1';
    this.tipMarkdown.style.left = '-9999px';
    this.tipMarkdown.style.width = '500px';
    this.tipMarkdown.style.outline = 'none';
    this.tipMarkdown.style.border = '1px solid #d0d0d0';
    this.tipMarkdown.style.backgroundColor = '#fff';
    this.tipMarkdown.style.padding = '10px 15px';
    this.tipMarkdown.style.overflowY = 'auto';
    this.tipMarkdown.style.minHeight = '30px';
    this.tipMarkdown.style.maxHeight = '260px';
    document.body.appendChild(this.tipMarkdown);
  }



  private showTip(data: Pen, pos: { x: number, y: number; }) {
    if (!this.data.locked || !data || (!data.markdown && !data.tipId && !data.title) || data.id === this.tip) {
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

    const parentRect = this.parentElem.getBoundingClientRect();
    const elemRect = elem.getBoundingClientRect();
    let x = pos.x + parentRect.left - elemRect.width / 2;
    let y = pos.y + parentRect.top;
    if (data instanceof Node) {
      x = parentRect.left + (data as Node).rect.center.x - elemRect.width / 2;
      y = parentRect.top + (data as Node).rect.ey;
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

  clearBkImg() {
    this.canvas.clearBkImg();
  }

  destroy() {
    this.subcribe.unsubscribe();
    this.subcribeImage.unsubscribe();
    this.subcribeAnimateEnd.unsubscribe();
    this.subcribeAnimateMoved.unsubscribe();
    this.subcribeMediaEnd.unsubscribe();
    this.animateLayer.destroy();
    this.divLayer.destroy();
    document.body.removeChild(this.tipMarkdown);
  }

  dispatch(event: string, data: any) {
    if (this.options.on) {
      this.options.on(event, data);
    }
  }
}
