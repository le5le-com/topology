import { Store, Observer } from 'le5le-store';

import { Options, KeyType } from './options';
import { Pen } from './models/pen';
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
import { pointInRect, extend } from './utils';

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

const DEFAULTOPTIONS: Options = {
  font: {
    color: '#222',
    fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'center',
    textBaseline: 'middle'
  },
  color: '#222',
  hoverColor: '#d4380d',
  dragColor: '#d4380d',
  activeColor: '#d4380d',
  rotateCursor: '/assets/img/rotate.cur',
  hideInput: false,
  hideRotateCP: false,
  hideSizeCP: false,
  disableScale: false,
  disableEmptyLine: false,
  autoDrawLine: true
}

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
    this.options = extend({}, DEFAULTOPTIONS, options);
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
      this.activeLayer.updateLines(this.data.nodes);
      this.animateLayer.updateLines(this.data.nodes);
    });
    this.subcribeMediaEnd = Store.subscribe('mediaEnd', (node: Node) => {
      if (node.nextPlay) {
        this.animateLayer.getNodes(this.data.nodes, node.nextPlay);
        this.animateLayer.getLines(node.nextPlay);
        this.animateLayer.animate();
      }

      if (this.options.on) {
        this.options.on('mediaEnd', node);
      }
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
      if (this.options.on) {
        this.options.on('animateEnd', e);
      }
    });

    this.divLayer.canvas.onmousemove = this.onMouseMove;
    this.divLayer.canvas.onmousedown = this.onmousedown;
    this.divLayer.canvas.onmouseup = this.onmouseup;
    this.divLayer.canvas.ondblclick = this.ondblclick;
    this.divLayer.canvas.tabIndex = 0;
    this.divLayer.canvas.onkeydown = this.onkeydown;
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

    if (this.options.on) {
      this.options.on('resize', size);
    }
  }

  private ondrop(event: DragEvent) {
    event.preventDefault();
    const json = JSON.parse(event.dataTransfer.getData('Text'));
    json.rect.x = (event.offsetX - json.rect.width / 2) << 0;
    json.rect.y = (event.offsetY - json.rect.height / 2) << 0;
    const node = new Node(json);
    this.addNode(node, true);
    if (node.name === 'div') {
      if (this.options.on) {
        this.options.on('LT:addDiv', node);
      }
    }
    this.divLayer.canvas.focus();
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
    if (!node.font.color) {
      node.font = Object.assign(node.font, this.options.font);
    }

    if (this.data.scale !== 1) {
      node.scale(this.data.scale);
    }

    this.data.nodes.push(node);
    // New active.
    if (focus) {
      this.activeLayer.setNodes([node]);
    }

    this.render();
    this.cache();

    if (this.options.on) {
      this.options.on('addNode', node);
    }

    return true;
  }

  addLine(line: Line, focus = false) {
    if (this.data.locked) {
      return false;
    }

    // New active.
    if (focus) {
      this.activeLayer.setLines([line]);
    }

    this.data.lines.push(line);
    this.offscreen.render();

    this.cache();

    if (this.options.on) {
      this.options.on('addLine', line);
    }
  }

  addLineByPt(name: string, from: Point, fromArrow: string, to: Point, toArrow: string, focus = false) {
    const line = new Line({
      name,
      from,
      fromArrow,
      to,
      toArrow
    });
    this.addLine(line, focus);
  }

  // Render or redraw
  render(noFocus = false) {
    if (noFocus) {
      this.activeLayer.nodes = [];
      this.activeLayer.lines = [];
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

    this.animateLayer.nodes = [];
    this.animateLayer.lines = [];
    this.lock(data.locked || Lock.None);

    if (data.lineName) {
      this.data.lineName = data.lineName;
    }

    this.data.scale = data.scale || 1;
    Store.set('LT:scale', this.data.scale);
    if (this.options.on) {
      this.options.on('scale', this.data.scale);
    }

    this.data.bkColor = data.bkColor;
    this.data.bkImage = data.bkImage;
    this.data.nodes = [];
    this.data.lines = [];

    for (const item of data.nodes) {
      this.data.nodes.push(new Node(item));
    }
    for (const item of data.lines) {
      this.data.lines.push(new Line(item));
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
    //fix Canvas cannot fill the entire parent node container
    if (ex > width) {
      width = ex + 200;
    }
    if (ey > height) {
      height = ey + 200;
    }
    this.resize({ width, height });
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
      this.scheduledAnimationFrame = false;

      if (!this.mouseDown) {
        this.getMoveIn(pos);

        // Render hover anchors.
        if (this.moveIn.hoverNode !== this.lastHoverNode) {
          if (this.lastHoverNode) {
            // Send a move event.
            if (this.options.on) {
              this.options.on('moveOutNode', this.lastHoverNode);
            }

            this.hideTip();

            // Clear hover anchors.
            this.hoverLayer.node = null;
          }

          if (this.moveIn.hoverNode) {
            this.hoverLayer.node = this.moveIn.hoverNode;

            // Send a move event.
            if (this.options.on) {
              this.options.on('moveInNode', this.moveIn.hoverNode);
            }

            this.showTip(this.moveIn.hoverNode, pos);
          }
        }

        if (this.moveIn.hoverLine !== this.lastHoverLine) {
          if (this.lastHoverLine) {
            if (this.options.on) {
              this.options.on('moveOutLine', this.lastHoverLine);
            }

            this.hideTip();
          }

          if (this.moveIn.hoverLine) {
            if (this.options.on) {
              this.options.on('moveInLine', this.moveIn.hoverLine);
            }

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
        return;
      }

      // Move out parent element.
      const moveOutX =
        pos.x + 50 > this.parentElem.clientWidth + this.parentElem.scrollLeft;
      const moveOutY = pos.y + 50 > this.parentElem.clientHeight + this.parentElem.scrollTop;
      if (moveOutX || moveOutY) {
        if (this.options.on) {
          this.options.on('moveOutParent', pos);
        }

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
            this.activeLayer.moveNodes(offset.x ? offset.x : x, offset.y ? offset.y : y);
            this.animateLayer.start(true);
            this.needCache = true;
          }
          break;
        case MoveInType.ResizeCP:
          this.activeLayer.resizeNodes(this.moveIn.activeAnchorIndex, this.mouseDown, pos);
          this.animateLayer.start(true);
          if (this.options.on) {
            this.options.on('resizeNodes', this.activeLayer.nodes);
          }
          this.needCache = true;
          break;
        case MoveInType.LineTo:
        case MoveInType.HoverAnchors:
          let arrow = this.data.toArrowType;
          if (this.moveIn.hoverLine) {
            arrow = this.moveIn.hoverLine.toArrow;
          }
          if (!this.activeLayer.lines.length && this.hoverLayer.line) {
            this.activeLayer.lines = [this.hoverLayer.line];
          }
          this.hoverLayer.lineTo(this.getLineDock(pos), arrow);
          this.animateLayer.start(true);
          this.needCache = true;
          break;
        case MoveInType.LineFrom:
          this.hoverLayer.lineFrom(this.getLineDock(pos));
          this.needCache = true;
          break;
        case MoveInType.LineMove:
          this.hoverLayer.lineMove(pos, this.mouseDown);
          this.animateLayer.start(true);
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
          this.animateLayer.start(true);
          this.needCache = true;
          break;
        case MoveInType.Rotate:
          if (this.activeLayer.nodes.length) {
            this.activeLayer.offsetRotate(this.getAngle(pos));
            this.activeLayer.updateLines();
          }
          this.animateLayer.start(true);
          this.needCache = true;
          break;
      }

      this.render();
    });
  };

  private setNodeText() {
    this.inputObj.text = this.input.value;
    this.input.style.zIndex = '-1';
    this.input.style.left = '-1000px';
    this.input.style.width = '0';
    this.cache();
    this.offscreen.render();

    if (this.options.on) {
      this.options.on('setText', this.inputObj);
    }

    this.inputObj = null;
  }

  private onmousedown = (e: MouseEvent) => {
    if (e.button) {
      return;
    }
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

        if (this.options.on) {
          this.options.on('space', null);
        }

        break;
      // Click a line.
      case MoveInType.Line:
      case MoveInType.LineControlPoint:
        if (e.ctrlKey) {
          this.activeLayer.addLine(this.moveIn.hoverLine);
          if (this.options.on) {
            if (this.data.lines.length > 1 || this.data.nodes.length) {
              this.options.on('multi', {
                nodes: this.activeLayer.nodes,
                lines: this.activeLayer.lines
              });
            } else {
              this.options.on('line', this.moveIn.hoverLine);
            }
          }
        } else {
          this.activeLayer.nodes = [];
          this.activeLayer.lines = [this.moveIn.hoverLine];
          if (this.options.on) {
            this.options.on('line', this.moveIn.hoverLine);
          }

          this.link(this.moveIn.hoverLine);
        }

        break;
      case MoveInType.LineMove:
        this.hoverLayer.initLine = new Line(this.moveIn.hoverLine);
      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.LineFrom:
      case MoveInType.LineTo:
        this.activeLayer.nodes = [];
        this.activeLayer.lines = [this.moveIn.hoverLine];
        if (this.options.on) {
          this.options.on('line', this.moveIn.hoverLine);
        }

        this.hoverLayer.line = this.moveIn.hoverLine;

        break;
      case MoveInType.HoverAnchors:
        this.hoverLayer.setLine(
          new Point(
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].x,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].y,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].direction,
            this.moveIn.hoverAnchorIndex,
            this.moveIn.hoverNode.id
          ),
          this.data.fromArrowType,
          this.data.lineName
        );
      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.Nodes:
        if (!e.ctrlKey) {
          this.link(this.moveIn.hoverNode);
        }

        if (!this.moveIn.hoverNode) {
          break;
        }

        if (e.ctrlKey) {
          if (this.activeLayer.hasNode(this.moveIn.hoverNode)) {
            break;
          }
          this.activeLayer.addNode(this.moveIn.hoverNode);

          if (this.options.on) {
            if (this.activeLayer.nodes.length > 1 || this.activeLayer.lines.length) {
              this.options.on('multi', {
                nodes: this.activeLayer.nodes,
                lines: this.activeLayer.lines
              });
            } else {
              this.options.on('node', this.moveIn.hoverNode);
            }
          }
        } else {
          this.activeLayer.setNodes([this.moveIn.hoverNode]);
          if (this.options.on) {
            this.options.on('node', this.moveIn.hoverNode);
          }
        }

        break;
    }

    // Save node rects to move.
    if (this.activeLayer.nodes.length) {
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
      this.getRectNodes(this.data.nodes, this.hoverLayer.dragRect);
      this.getRectLines(this.data.lines, this.hoverLayer.dragRect);

      if (this.options.on && this.activeLayer.nodes && this.activeLayer.nodes.length) {
        this.options.on('multi', {
          nodes: this.activeLayer.nodes,
          lines: this.activeLayer.lines
        });
      }
    } else {
      switch (this.moveIn.type) {
        // Add the line.
        case MoveInType.HoverAnchors:
          // New active.
          if (this.hoverLayer.line && this.hoverLayer.line.to) {
            this.data.lines.push(this.hoverLayer.line);
            // Deactive nodes.
            this.activeLayer.nodes = [];

            if (this.hoverLayer.line.to.id || !this.options.disableEmptyLine) {
              this.activeLayer.lines = [this.hoverLayer.line];
              if (this.options.on) {
                this.options.on('addLine', this.hoverLayer.line);
              }
            } else {
              this.data.lines.pop();
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
      if (this.options.on) {
        this.options.on('dblclick', {
          node: this.moveIn.hoverNode
        });
      }

      if (this.moveIn.hoverNode.getTextRect().hit(new Point(e.offsetX, e.offsetY))) {
        this.showInput(this.moveIn.hoverNode);
      }
    } else if (this.moveIn.hoverLine) {
      if (this.options.on) {
        this.options.on('dblclick', {
          line: this.moveIn.hoverLine
        });
      }

      if (!this.moveIn.hoverLine.text || this.moveIn.hoverLine.getTextRect().hit(new Point(e.offsetX, e.offsetY))) {
        this.showInput(this.moveIn.hoverLine);
      }
    }
  };

  private onkeydown = (key: KeyboardEvent) => {
    if (this.data.locked) {
      return;
    }

    key.preventDefault();

    let done = false;
    let moveX = 0;
    let moveY = 0;
    switch (key.keyCode) {
      // Delete
      case 8:
      case 46:
        if (!this.activeLayer.nodes.length && !this.activeLayer.lines.length) {
          return;
        }
        this.delete();
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
    }

    if (!done) {
      return;
    }

    if (moveX || moveY) {
      this.activeLayer.saveNodeRects();
      this.activeLayer.moveNodes(moveX, moveY);
      this.overflow();
      this.animateLayer.start(true);
    }

    this.render();
    this.cache();
  };

  private getMoveIn(pt: Point) {
    this.lastHoverNode = this.moveIn.hoverNode;
    this.lastHoverLine = this.moveIn.hoverLine;
    this.moveIn.type = MoveInType.None;
    this.moveIn.hoverNode = null;
    this.moveIn.lineControlPoint = null;
    this.moveIn.hoverLine = null;
    this.hoverLayer.hoverAnchorIndex = -1;

    if (
      !this.data.locked &&
      !this.activeLayer.locked() &&
      this.activeLayer.rotateCPs[0] &&
      this.activeLayer.rotateCPs[0].hit(pt, 15)
    ) {
      this.moveIn.type = MoveInType.Rotate;
      this.divLayer.canvas.style.cursor = `url("${this.options.rotateCursor}"), auto`;
      return;
    }

    if (this.activeLayer.nodes.length && pointInRect(pt, this.activeLayer.sizeCPs)) {
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
    for (const item of this.activeLayer.lines) {
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

    let node = this.inNodes(pt, this.activeLayer.nodes);
    if (node && !node.childStand) {
      return;
    }

    node = this.inNodes(pt, this.data.nodes);

    if (node && !node.childStand) {
      return;
    }

    let index = 0;
    for (const item of this.data.lines) {
      ++index;
      if (!item.to) {
        this.data.lines.splice(index - 1, 1);
        continue;
      }

      if (this.inLine(pt, item)) {
        return;
      }
    }
  }

  inNodes(pt: Point, nodes: Node[]) {
    for (let i = nodes.length - 1; i > -1; --i) {
      const node = this.inNode(pt, nodes[i]);
      if (node) {
        return node;
      }
    }
  }

  inNode(pt: Point, node: Node) {
    if (node.childStand && node.children && node.children.length) {
      const n = this.inNodes(pt, node.children);
      if (n) {
        return n;
      }
    }
    const autoDrawLine = this.options.autoDrawLine;

    if (node.hit(pt)) {
      this.moveIn.hoverNode = node;
      this.moveIn.type = MoveInType.Nodes;
      if (this.data.locked || node.locked) {
        this.divLayer.canvas.style.cursor = 'pointer';
        return node;
      }
      this.divLayer.canvas.style.cursor = 'move';

      // Too small
      if (node.rect.width < 20 || node.rect.height < 20) {
        return node;
      }
      if (autoDrawLine) {
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

      return node;
    }

    if (node.hit(pt, 5)) {
      if (this.data.locked || node.locked) {
        return node;
      }
      if (autoDrawLine) {
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
    }
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
    for (const item of this.data.nodes) {
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

      if (point.id) {
        break;
      }
    }

    return point;
  }

  private getRectNodes(nodes: Node[], rect: Rect) {
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
    for (const item of nodes) {
      if (rect.hitRect(item.rect)) {
        this.activeLayer.addNode(item);
      }
    }
  }

  private getRectLines(lines: Line[], rect: Rect) {
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
    this.activeLayer.lines = [];
    for (const item of lines) {
      if (rect.hit(item.from) && rect.hit(item.to)) {
        this.activeLayer.addLine(item);
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
    if (this.activeLayer.nodes.length === 1) {
      return angle - this.activeLayer.nodes[0].rotate;
    }

    return angle;
  }

  private showInput(item: Pen) {
    if (this.data.locked || item.locked || this.options.hideInput) {
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

  getRect() {
    let x1 = 99999;
    let y1 = 99999;
    let x2 = -99999;
    let y2 = -99999;

    const points: Point[] = [];
    for (const item of this.data.nodes) {
      const pts = item.rect.toPoints();
      if (item.rotate) {
        for (const pt of pts) {
          pt.rotate(item.rotate, item.rect.center);
        }
      }
      points.push.apply(points, pts);
    }

    for (const l of this.data.lines) {
      points.push(l.from);
      points.push(l.to);
      if (l.name === 'curve') {
        for (let i = 0.01; i < 1; i += 0.02) {
          points.push(getBezierPoint(i, l.from, l.controlPoints[0], l.controlPoints[1], l.to));
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

  getNodesRect(nodes: Node[]) {
    let x1 = 99999;
    let y1 = 99999;
    let x2 = -99999;
    let y2 = -99999;

    const points: Point[] = [];
    for (const item of nodes) {
      const pts = item.rect.toPoints();
      if (item.rotate) {
        for (const pt of pts) {
          pt.rotate(item.rotate, item.rect.center);
        }
      }
      points.push.apply(points, pts);
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
      for (const item of this.data.nodes) {
        if (this.activeLayer.hasNode(item) || item.name === 'text') {
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

    this.caches.index = this.caches.list.length - 1;
  }

  undo() {
    if (this.data.locked || this.caches.index < 1) {
      return;
    }

    this.divLayer.clear();
    const data = new TopologyData(this.caches.list[--this.caches.index]);
    this.data.nodes.splice(0, this.data.nodes.length);
    this.data.lines.splice(0, this.data.lines.length);
    this.data.nodes.push.apply(this.data.nodes, data.nodes);
    this.data.lines.push.apply(this.data.lines, data.lines);
    this.render(true);
    this.divLayer.render();

    this.options.on('undo', this.data);
  }

  redo() {
    if (this.data.locked || this.caches.index > this.caches.list.length - 2) {
      return;
    }
    this.divLayer.clear();
    const data = new TopologyData(this.caches.list[++this.caches.index]);
    this.data.nodes.splice(0, this.data.nodes.length);
    this.data.lines.splice(0, this.data.lines.length);
    this.data.nodes.push.apply(this.data.nodes, data.nodes);
    this.data.lines.push.apply(this.data.lines, data.lines);
    this.render(true);
    this.divLayer.render();

    this.options.on('redo', this.data);
  }

  toImage(type?: string, quality?: any, callback?: any): string {
    const rect = this.getRect();
    rect.x -= 10;
    rect.y -= 10;
    rect.width += 20;
    rect.height += 20;
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
      this.offscreen.canvas,
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

  saveAsImage(name?: string, type?: string, quality?: any) {
    const a = document.createElement('a');
    a.setAttribute('download', name || 'le5le.topology.png');
    a.setAttribute('href', this.toImage(type, quality));
    const evt = document.createEvent('MouseEvents');
    evt.initEvent('click', true, true);
    a.dispatchEvent(evt);
  }

  delete() {
    const nodes: Node[] = [];
    const lines: Line[] = [];
    let i = 0;
    for (const line of this.activeLayer.lines) {
      i = this.findLine(line);
      if (i > -1) {
        lines.push.apply(lines, this.data.lines.splice(i, 1));
      }
    }

    for (const node of this.activeLayer.nodes) {
      i = this.findNode(node);
      if (i > -1) {
        this.divLayer.removeDiv(this.data.nodes[i]);
        nodes.push.apply(nodes, this.data.nodes.splice(i, 1));
      }
    }

    this.animate(false);
    this.render(true);
    this.cache();

    if (this.options.on) {
      this.options.on('delete', {
        nodes,
        lines
      });
    }
  }

  removeNode(node: Node) {
    const i = this.findNode(node);
    if (i > -1) {
      this.divLayer.removeDiv(this.data.nodes[i]);
      const nodes = this.data.nodes.splice(i, 1);
      if (this.options.on) {
        this.options.on('delete', {
          nodes
        });
      }
    }

    this.render(true);
    this.cache();
  }

  removeLine(line: Line) {
    const i = this.findLine(line);
    if (i > -1) {
      const lines = this.data.lines.splice(i, 1);
      if (this.options.on) {
        this.options.on('delete', {
          lines
        });
      }
    }

    this.render(true);
    this.cache();
  }

  cut() {
    if (this.data.locked) {
      return;
    }

    this.clipboard = new TopologyData({
      nodes: [],
      lines: []
    });
    for (const item of this.activeLayer.nodes) {
      this.clipboard.nodes.push(new Node(item));

      const i = this.findNode(item);
      if (i > -1) {
        this.divLayer.removeDiv(this.data.nodes[i]);
        this.data.nodes.splice(i, 1);
      }
    }
    for (const item of this.activeLayer.lines) {
      this.clipboard.lines.push(new Line(item));

      let i = 0;
      for (const line of this.data.lines) {
        if (item.id === line.id) {
          this.data.lines.splice(i, 1);
        }
        ++i;
      }
    }

    this.cache();

    this.activeLayer.clear();
    this.hoverLayer.node = null;
    this.moveIn.hoverLine = null;
    this.moveIn.hoverNode = null;

    this.render();

    if (this.options.on) {
      this.options.on('delete', {
        nodes: this.clipboard.nodes,
        lines: this.clipboard.lines
      });
    }
  }

  copy() {
    this.clipboard = new TopologyData({
      nodes: [],
      lines: []
    });
    for (const item of this.activeLayer.nodes) {
      this.clipboard.nodes.push(new Node(item));
    }

    for (const item of this.activeLayer.lines) {
      this.clipboard.lines.push(new Line(item));
    }
  }

  parse() {
    if (!this.clipboard || this.data.locked) {
      return;
    }

    this.hoverLayer.node = null;
    this.hoverLayer.line = null;

    this.activeLayer.nodes = [];
    this.activeLayer.lines = [];

    const idMaps: any = {};
    for (const item of this.clipboard.nodes) {
      this.newId(item, idMaps);
      item.rect.x += 20;
      item.rect.ex += 20;
      item.rect.y += 20;
      item.rect.ey += 20;

      const node = new Node(item);
      this.data.nodes.push(node);
      this.activeLayer.nodes.push(node);
    }
    for (const item of this.clipboard.lines) {
      item.id = s8();
      item.from = new Point(
        item.from.x + 20,
        item.from.y + 20,
        item.from.direction,
        item.from.anchorIndex,
        idMaps[item.from.id]
      );
      item.to = new Point(item.to.x + 20, item.to.y + 20, item.to.direction, item.to.anchorIndex, idMaps[item.to.id]);
      const controlPoints = [];
      for (const pt of item.controlPoints) {
        controlPoints.push(new Point(pt.x + 20, pt.y + 20));
      }

      const line = new Line(item);
      line.controlPoints = controlPoints;
      this.data.lines.push(line);
      this.activeLayer.addLine(line);
    }

    this.render();
    this.cache();

    if (this.options.on) {
      if (
        this.clipboard.nodes.length > 1 ||
        this.clipboard.lines.length > 1 ||
        (this.clipboard.nodes.length && this.clipboard.lines.length)
      ) {
        this.options.on('multi', {
          nodes: this.clipboard.nodes,
          lines: this.clipboard.lines
        });
      } else if (this.clipboard.nodes.length) {
        this.options.on('addNode', this.activeLayer.nodes[0]);
      } else if (this.clipboard.lines.length) {
        this.options.on('addLine', this.activeLayer.lines[0]);
      }
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

  animate(autoplay = true) {
    const n = Date.now();
    for (const item of this.data.nodes) {
      if (item.animatePlay) {
        item.animateStart = autoplay ? n : 0;
      }
    }
    for (const item of this.data.lines) {
      if (item.animatePlay) {
        item.animateStart = autoplay ? n : 0;
      }
    }
    this.animateLayer.start(!autoplay);
  }

  updateProps(node?: Node) {
    if (node) {
      node.round();
      node.init();
      this.activeLayer.updateChildren(node);
      this.activeLayer.updateLines([node]);
    }
    this.activeLayer.calcControlPoints();
    this.activeLayer.saveNodeRects();
    this.activeLayer.changeLineType();

    this.render();
    this.cache();
  }

  lock(lock: number) {
    this.data.locked = lock;
    if (this.options.on) {
      this.options.on('locked', this.data.locked);
    }
  }

  lockNodes(nodes: Node[], lock: boolean) {
    for (const item of this.data.nodes) {
      for (const node of nodes) {
        if (item.id === node.id) {
          item.locked = lock;
          break;
        }
      }
    }

    if (this.options.on) {
      this.options.on('lockNodes', {
        nodes,
        lock
      });
    }
  }

  lockLines(lines: Line[], lock: boolean) {
    for (const item of this.data.lines) {
      for (const line of lines) {
        if (item.id === line.id) {
          item.locked = lock;
          break;
        }
      }
    }

    if (this.options.on) {
      this.options.on('lockLines', {
        lines,
        lock
      });
    }
  }

  top(node: Node) {
    const i = this.findNode(node);
    if (i > -1) {
      this.data.nodes.push(this.data.nodes[i]);
      this.data.nodes.splice(i, 1);
    }
  }

  bottom(node: Node) {
    const i = this.findNode(node);
    if (i > -1) {
      this.data.nodes.unshift(this.data.nodes[i]);
      this.data.nodes.splice(i + 1, 1);
    }
  }

  combine(nodes?: Node[], stand?: boolean) {
    if (!nodes) {
      nodes = this.activeLayer.nodes;
    }

    const rect = this.getNodesRect(nodes);
    for (const item of nodes) {
      const i = this.findNode(item);
      if (i > -1) {
        this.data.nodes.splice(i, 1);
      }
    }

    const node = new Node({
      name: 'combine',
      rect: new Rect(rect.x, rect.y, rect.width, rect.height),
      text: '',
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      childStand: stand,
      strokeStyle: 'transparent'
    });
    node.children = [];
    for (const item of nodes) {
      item.stand = stand;
      item.parentId = node.id;
      item.calcRectInParent(node);
      node.children.push(item);
    }
    this.data.nodes.push(node);

    this.activeLayer.setNodes([node]);
    if (this.options.on) {
      this.options.on('node', node);
    }

    this.cache();
  }

  uncombine(node?: Node) {
    if (!node) {
      node = this.activeLayer.nodes[0];
    }

    if (node.name !== 'combine') {
      return;
    }

    const i = this.findNode(node);
    if (i > -1) {
      this.data.nodes.splice(i, 1);
    }

    for (const item of node.children) {
      item.parentId = undefined;
      item.rectInParent = undefined;
      item.stand = undefined;
      this.data.nodes.push(item);
    }

    this.cache();

    this.activeLayer.clear();
    this.hoverLayer.clear();
  }

  private findNode(node: Node) {
    for (let i = 0; i < this.data.nodes.length; ++i) {
      if (node.id === this.data.nodes[i].id) {
        return i;
      }
    }

    return -1;
  }

  private findLine(line: Line) {
    for (let i = 0; i < this.data.lines.length; ++i) {
      if (line.id === this.data.lines[i].id) {
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

    for (const item of this.data.nodes) {
      item.translate(offsetX, offsetY);
    }

    for (const item of this.data.lines) {
      item.translate(offsetX, offsetY);
    }

    this.lastTranlated.x = x;
    this.lastTranlated.y = y;
    this.overflow();
    this.render();
    this.animateLayer.start();
    this.cache();

    if (this.options.on) {
      this.options.on('translate', { x, y });
    }
  }

  // scale for scaled canvas:
  //   > 1, expand
  //   < 1, reduce
  scale(scale: number) {
    if (this.data.scale * scale < 0.25) {
      return;
    }

    this.data.scale *= scale;
    const center = this.getRect().center;

    for (const item of this.data.nodes) {
      item.scale(scale, center);
    }

    for (const item of this.data.lines) {
      item.scale(scale, center);
    }
    Store.set('LT:scale', this.data.scale);

    this.overflow();
    this.render();
    this.animateLayer.start();
    this.cache();

    if (this.options.on) {
      this.options.on('scale', this.data.scale);
    }
  }

  // scale for origin canvas:
  scaleTo(scale: number) {
    this.scale(scale / this.data.scale);
  }

  round() {
    for (const item of this.data.nodes) {
      item.round();
    }
  }

  alignNodes(align: string) {
    this.activeLayer.alignNodes(align);
    this.render();
  }

  private link(data: Pen) {
    if (!data || !data.link || !this.data.locked) {
      return;
    }

    window.open(data.link, '_blank');

    this.mouseDown = null;
    setTimeout(() => {
      this.divLayer.canvas.focus();
    }, 1000);
  }

  private createMarkdownTip() {
    this.tipMarkdown = document.createElement('div');
    this.tipMarkdown.style.position = 'absolute';
    this.tipMarkdown.style.zIndex = '-1';
    this.tipMarkdown.style.left = '-9999px';
    this.tipMarkdown.style.width = '500px';
    this.tipMarkdown.style.outline = 'none';
    this.tipMarkdown.style.border = '1px solid #d0d0d0';
    this.tipMarkdown.style.backgroundColor = '#fff';
    this.tipMarkdown.style.padding = '10px 15px';
    this.tipMarkdown.style.overflowY = 'auto';
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

    const parentRect = this.parentElem.getBoundingClientRect();
    const w = data.markdown ? 500 : (this.tipElem ? this.tipElem.getBoundingClientRect().width : 500);
    let x = pos.x + parentRect.left - w / 2;
    let y = pos.y + parentRect.top;
    if (data instanceof Node) {
      x = parentRect.left + (data as Node).rect.center.x - w / 2;
      y = parentRect.top + (data as Node).rect.ey;
    }

    if (x < 0) {
      x = 0;
    }
    if (x + w > document.body.clientWidth) {
      x = document.body.clientWidth - w;
    }
    if (y + 260 > document.body.clientHeight) {
      y = document.body.clientHeight - 260;
    }

    if (data.markdown) {
      this.tipMarkdown.style.height = '30px';
      const marked = (window as any).marked;
      if (marked) {
        this.tipMarkdown.innerHTML = marked(data.markdown);
      } else {
        this.tipMarkdown.innerHTML = data.markdown;
      }

      if (this.tipMarkdown.scrollHeight < 260) {
        this.tipMarkdown.style.height = this.tipMarkdown.scrollHeight + 10 + 'px';
      } else {
        this.tipMarkdown.style.height = '260px';
      }
      const a = this.tipMarkdown.getElementsByTagName('A');
      for (let i = 0; i < a.length; ++i) {
        a[i].setAttribute('target', '_blank');
      }

      this.tipMarkdown.style.left = x + 'px';
      this.tipMarkdown.style.top = y + 'px';
      this.tipMarkdown.style.zIndex = '100';
    } else if (this.tipElem) {
      this.tipElem.style.left = x + 'px';
      this.tipElem.style.top = y + 'px';
      this.tipElem.style.zIndex = '100';
    }

    this.tip = data.id;
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
}
