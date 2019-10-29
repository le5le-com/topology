import { Options } from './options';
import { Node } from './models/node';
import { Point } from './models/point';
import { Line } from './models/line';
import { drawNodeFns, drawLineFns } from './middles/index';
import { Canvas } from './canvas';
import { Store, Observer } from 'le5le-store';
import { HoverLayer } from './hoverLayer';
import { ActiveLayer } from './activeLayer';
import { AnimateLayer } from './animateLayer';
import { Rect } from './models/rect';
import { s8 } from './uuid/uuid';
import { getBezierPoint } from './middles/lines/curve';
import { pointInRect } from './middles/utils';

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

interface ICanvasData {
  nodes: Node[];
  lines: Line[];
  lineName?: string;
  fromArrowType?: string;
  toArrowType?: string;
  scaleState?: number;
}

interface ICanvasCache {
  index: number;
  list: ICanvasData[];
}

const dockOffset = 10;

export class Topology {
  parentElem: HTMLElement;
  canvas = document.createElement('canvas');
  offscreen: Canvas;
  hoverLayer: HoverLayer;
  activeLayer: ActiveLayer;
  animateLayer: AnimateLayer;
  nodes: Node[] = [];
  lines: Line[] = [];
  scaleState = 1;
  options: Options;
  private subcribe: Observer;
  private subcribeAnimateEnd: Observer;
  private subcribeAnimateMoved: Observer;

  touchedNode: any;
  lastHoverNode: Node;
  input = document.createElement('textarea');
  inputNode: Node;
  mouseDown: { x: number; y: number };
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
  nodesMoved = false;

  fromArrowType = '';
  toArrowType = 'triangleSolid';
  lineName = 'curve';

  clipboard: ICanvasData;

  locked = 0;

  private scheduledAnimationFrame = false;

  private caches: ICanvasCache = {
    index: 0,
    list: []
  };

  constructor(parent: string | HTMLElement, options?: Options) {
    this.options = options || {};

    if (!this.options.font) {
      this.options.font = {
        color: '#333',
        fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
        fontSize: 12,
        lineHeight: 1.5,
        textAlign: 'center',
        textBaseline: 'middle'
      };
    }

    if (!this.options.color) {
      this.options.color = '#000';
    }

    if (!this.options.rotateCursor) {
      this.options.rotateCursor = '/assets/img/rotate.cur';
    }

    if (!this.options.font.fontFamily) {
      this.options.font.fontFamily = '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial';
    }

    if (!this.options.font.color) {
      this.options.font.color = '#333';
    }
    if (!this.options.font.fontSize) {
      // px
      this.options.font.fontSize = 12;
    }
    if (!this.options.font.lineHeight) {
      // number
      this.options.font.lineHeight = 1.5;
    }
    if (!this.options.font.textAlign) {
      this.options.font.textAlign = 'center';
    }
    if (!this.options.font.textBaseline) {
      this.options.font.textBaseline = 'middle';
    }

    Store.set('nodes', this.nodes);
    Store.set('lines', this.lines);

    if (typeof parent === 'string') {
      this.parentElem = document.getElementById(parent);
    } else {
      this.parentElem = parent;
    }

    this.offscreen = new Canvas(this.options);
    Store.set('offscreen', this.offscreen.canvas);
    this.parentElem.appendChild(this.canvas);
    this.activeLayer = new ActiveLayer(this.parentElem, this.options);
    this.animateLayer = new AnimateLayer(this.parentElem, this.options);
    this.hoverLayer = new HoverLayer(this.parentElem, this.options);

    this.resize();

    this.hoverLayer.canvas.ondragover = event => event.preventDefault();
    this.hoverLayer.canvas.ondrop = event => {
      this.ondrop(event);
    };

    this.subcribe = Store.subcribe('render', () => {
      this.renderOffscreen();
    });
    this.subcribeAnimateMoved = Store.subcribe('nodeMovedInAnimate', (e: any) => {
      this.activeLayer.updateLines(this.nodes);
      this.activeLayer.render();
      this.offscreen.render();

      if (this.options.on) {
        this.options.on('nodeMovedInAnimate', e);
      }
    });
    this.subcribeAnimateEnd = Store.subcribe('animateEnd', (e: any) => {
      if (!e) {
        return;
      }
      switch (e.type) {
        case 'node':
          this.offscreen.render();
          break;
      }
      if (this.options.on) {
        this.options.on('animateEnd', e);
      }
    });

    this.hoverLayer.canvas.onmousemove = this.onMouseMove;
    this.hoverLayer.canvas.onmousedown = this.onmousedown;
    this.hoverLayer.canvas.onmouseup = this.onmouseup;
    this.hoverLayer.canvas.ondblclick = this.ondblclick;
    this.hoverLayer.canvas.tabIndex = 0;
    this.hoverLayer.canvas.onkeydown = this.onkeydown;
    this.hoverLayer.canvas.onwheel = event => {
      if (!event.altKey) {
        return;
      }
      event.preventDefault();

      if (event.deltaY < 0) {
        this.scale(1.1);
      } else {
        this.scale(0.9);
      }

      this.hoverLayer.canvas.focus();
    };

    this.hoverLayer.canvas.ontouchend = event => {
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

    this.canvas.style.outline = 'none';

    this.cache();
  }

  resize(size?: { width: number; height: number }) {
    if (size) {
      this.canvas.width = size.width;
      this.canvas.height = size.height;
    } else {
      if (this.options.width && this.options.width !== 'auto') {
        this.canvas.width = +this.options.width;
      } else {
        this.canvas.width = this.parentElem.clientWidth;
      }
      if (this.options.height && this.options.height !== 'auto') {
        this.canvas.height = +this.options.height;
      } else {
        this.canvas.height = this.parentElem.clientHeight - 8;
      }
    }

    this.offscreen.resize(this.canvas.width, this.canvas.height);
    this.hoverLayer.resize(this.canvas.width, this.canvas.height);
    this.activeLayer.resize(this.canvas.width, this.canvas.height);
    this.animateLayer.resize(this.canvas.width, this.canvas.height);
    this.render();

    if (this.options.on) {
      this.options.on('resize', {
        width: this.canvas.width,
        height: this.canvas.height
      });
    }
  }

  private ondrop(event: DragEvent) {
    event.preventDefault();
    const node = JSON.parse(event.dataTransfer.getData('Text'));
    node.rect.x = (event.offsetX - node.rect.width / 2) << 0;
    node.rect.y = (event.offsetY - node.rect.height / 2) << 0;
    this.addNode(new Node(node), true);
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

  addNode(node: Node, focus = false): boolean {
    if (!drawNodeFns[node.name]) {
      return false;
    }

    if (this.scaleState !== 1) {
      node.scale(this.scaleState);
    }

    // New active.
    if (focus) {
      this.activeLayer.setNodes([node]);
      this.activeLayer.render();
    }

    this.hoverLayer.canvas.focus();

    this.nodes.push(node);
    this.offscreen.render();

    this.cache();

    if (this.options.on) {
      this.options.on('node', node);
    }

    return true;
  }

  addLine(line: Line, focus = false) {
    // New active.
    if (focus) {
      this.activeLayer.setLines([line]);
      this.activeLayer.render();
    }

    this.hoverLayer.canvas.focus();

    this.lines.push(line);
    this.offscreen.render();

    this.cache();

    if (this.options.on) {
      this.options.on('line', line);
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
  render() {
    this.activeLayer.nodes = [];
    this.activeLayer.lines = [];
    this.hoverLayer.node = null;
    this.hoverLayer.line = null;
    Store.set('activeLine', null);

    this.hoverLayer.render();
    this.activeLayer.render();
    this.animateLayer.render();
    this.offscreen.render();
  }

  // open - redraw by the data
  open(data: any) {
    this.animateLayer.nodes = [];
    this.animateLayer.lines = [];
    this.lock(data.locked || 0);

    if (data.lineName) {
      this.lineName = data.lineName;
    }

    this.scaleState = data.scaleState || 1;
    Store.set('scale', this.scaleState);
    if (this.options.on) {
      this.options.on('scale', this.scaleState);
    }

    this.nodes = [];
    this.lines = [];
    Store.set('nodes', this.nodes);
    Store.set('lines', this.lines);
    this.offscreen.init();

    for (const item of data.nodes) {
      this.nodes.push(new Node(item));
    }
    for (const item of data.lines) {
      this.lines.push(new Line(item));
    }
    this.caches.list = [];
    this.cache();

    this.overflow();
    this.render();
  }

  private overflow() {
    const rect = this.getRect();
    if (rect.width > this.canvas.width || rect.height > this.canvas.height) {
      this.resize({ width: rect.ex + 200, height: rect.ey + 200 });
    }
  }

  private renderOffscreen() {
    this.canvas.height = this.canvas.height;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.offscreen.canvas, 0, 0);
  }

  private onMouseMove = (e: MouseEvent) => {
    if (this.scheduledAnimationFrame) {
      return;
    }

    if (e.altKey && this.mouseDown) {
      this.translate(e.offsetX - this.mouseDown.x, e.offsetY - this.mouseDown.y);
      return;
    }

    if (this.locked < 0) {
      return;
    }
    this.scheduledAnimationFrame = true;
    const pos = new Point(e.offsetX, e.offsetY);
    requestAnimationFrame(() => {
      this.scheduledAnimationFrame = false;

      if (!this.mouseDown) {
        this.getMoveIn(pos);

        // Render hover anchors.
        if (this.moveIn.hoverNode) {
          this.hoverLayer.node = this.moveIn.hoverNode;
          this.hoverLayer.render();

          // Send a move event.
          if (!this.lastHoverNode && this.options.on) {
            this.options.on('moveInNode', this.moveIn.hoverNode);
          }
        } else if (this.lastHoverNode) {
          // Clear hover anchors.
          this.hoverLayer.node = null;
          this.hoverLayer.canvas.height = this.hoverLayer.canvas.height;

          // Send a move event.
          if (this.options.on) {
            this.options.on('moveOutNode', null);
          }
        }

        if (this.moveIn.type === MoveInType.LineControlPoint) {
          this.hoverLayer.hoverLineCP = this.moveIn.lineControlPoint;
          this.hoverLayer.render();
        } else if (this.hoverLayer.hoverLineCP) {
          this.hoverLayer.hoverLineCP = null;
          this.hoverLayer.render();
        }

        return;
      }

      // Move out parent element.
      const moveOut =
        pos.x + 50 > this.parentElem.clientWidth + this.parentElem.scrollLeft ||
        pos.y + 50 > this.parentElem.clientHeight + this.parentElem.scrollTop;
      if (moveOut) {
        if (this.options.on) {
          this.options.on('moveOutParent', pos);
        }
      }

      // Send a resize event.
      const out = pos.x + 50 > this.hoverLayer.canvas.width || pos.y + 50 > this.hoverLayer.canvas.height;
      if (out) {
        if (pos.x + 50 > this.hoverLayer.canvas.width) {
          this.canvas.width += 200;
        }
        if (pos.y + 50 > this.hoverLayer.canvas.height) {
          this.canvas.height += 200;
        }

        this.offscreen.canvas.width = this.canvas.width;
        this.offscreen.canvas.height = this.canvas.height;
        this.hoverLayer.canvas.width = this.canvas.width;
        this.hoverLayer.canvas.height = this.canvas.height;
        this.activeLayer.canvas.width = this.canvas.width;
        this.activeLayer.canvas.height = this.canvas.height;

        // Send a resize event.
        if (this.options.on) {
          this.options.on('resize', {
            width: this.canvas.width,
            height: this.canvas.height
          });
        }
      }

      switch (this.moveIn.type) {
        case MoveInType.None:
          this.hoverLayer.dragRect = new Rect(
            this.mouseDown.x,
            this.mouseDown.y,
            pos.x - this.mouseDown.x,
            pos.y - this.mouseDown.y
          );
          if (!out) {
            this.hoverLayer.render();
            return;
          }
          break;
        case MoveInType.Nodes:
          this.nodesMoved = true;
          const x = pos.x - this.mouseDown.x;
          const y = pos.y - this.mouseDown.y;
          if (x || y) {
            const offset = this.getDockPos(x, y);
            this.activeLayer.moveNodes(offset.x ? offset.x : x, offset.y ? offset.y : y);
            if (this.options.on) {
              this.options.on('moveNodes', this.activeLayer.nodes);
            }
          }
          break;
        case MoveInType.ResizeCP:
          this.activeLayer.resizeNodes(this.moveIn.activeAnchorIndex, pos);

          if (this.options.on) {
            this.options.on('resizeNodes', this.activeLayer.nodes);
          }
          break;
        case MoveInType.LineTo:
        case MoveInType.HoverAnchors:
          let arrow = this.toArrowType;
          if (this.moveIn.hoverLine) {
            arrow = this.moveIn.hoverLine.toArrow;
          }
          this.hoverLayer.lineTo(this.getLineDock(pos), arrow);
          break;
        case MoveInType.LineFrom:
          this.hoverLayer.lineFrom(this.getLineDock(pos));
          break;
        case MoveInType.LineMove:
          this.hoverLayer.lineMove(pos, this.mouseDown);
          break;
        case MoveInType.LineControlPoint:
          this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id].x = pos.x;
          this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id].y = pos.y;
          if (drawLineFns[this.moveIn.hoverLine.name] && drawLineFns[this.moveIn.hoverLine.name].dockControlPointFn) {
            drawLineFns[this.moveIn.hoverLine.name].dockControlPointFn(
              this.moveIn.hoverLine.controlPoints[this.moveIn.lineControlPoint.id],
              this.moveIn.hoverLine
            );
          }
          break;
        case MoveInType.Rotate:
          if (this.activeLayer.nodes.length) {
            this.activeLayer.offsetRotate(this.getAngle(pos));
            this.activeLayer.updateLines();
          }

          if (this.options.on) {
            this.options.on('rotateNodes', this.activeLayer.nodes);
          }
          break;
      }

      this.hoverLayer.render();
      this.activeLayer.render();
      this.animateLayer.render();
      this.offscreen.render();
    });
  };

  private setNodeText() {
    this.inputNode.text = this.input.value;
    this.input.style.zIndex = '-1';
    this.input.style.left = '-1000px';
    this.input.style.width = '0';
    this.inputNode = null;
    this.cache();
    this.offscreen.render();
  }

  private onmousedown = (e: MouseEvent) => {
    this.mouseDown = { x: e.offsetX, y: e.offsetY };
    Store.set('activeLine', null);

    if (e.altKey) {
      this.hoverLayer.canvas.style.cursor = 'move';
    }

    if (this.inputNode) {
      this.setNodeText();
    }

    switch (this.moveIn.type) {
      // Click the space.
      case MoveInType.None:
        this.activeLayer.nodes = [];
        this.activeLayer.lines = [];
        this.activeLayer.canvas.height = this.activeLayer.canvas.height;

        this.hoverLayer.node = null;
        this.hoverLayer.line = null;
        this.hoverLayer.canvas.height = this.hoverLayer.canvas.height;

        if (this.options.on) {
          this.options.on('space', null);
        }

        return;

      // Click a line.
      case MoveInType.Line:
      case MoveInType.LineControlPoint:
        if (e.ctrlKey) {
          this.activeLayer.lines.push(this.moveIn.hoverLine);
          if (this.options.on) {
            if (this.lines.length > 1 || this.nodes.length) {
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
        }

        Store.set('activeLine', this.moveIn.hoverLine);
        this.hoverLayer.render();
        this.activeLayer.render();

        return;
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
        Store.set('activeLine', this.moveIn.hoverLine);

        this.hoverLayer.line = this.moveIn.hoverLine;

        this.hoverLayer.render();
        this.activeLayer.render();
        this.animateLayer.render();
        return;
      case MoveInType.HoverAnchors:
        this.hoverLayer.setLine(
          new Point(
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].x,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].y,
            this.moveIn.hoverNode.rotatedAnchors[this.moveIn.hoverAnchorIndex].direction,
            this.moveIn.hoverAnchorIndex,
            this.moveIn.hoverNode.id
          ),
          this.fromArrowType,
          this.lineName
        );
      // tslint:disable-next-line:no-switch-case-fall-through
      case MoveInType.Nodes:
        if (!this.moveIn.hoverNode || this.activeLayer.hasNode(this.moveIn.hoverNode)) {
          break;
        }

        if (e.ctrlKey) {
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
    this.activeLayer.saveNodeRects();
    this.activeLayer.render();
    this.animateLayer.render();
  };

  private onmouseup = (e: MouseEvent) => {
    this.mouseDown = null;
    if (this.lastTranlated.x) {
      this.cache();
    }
    this.lastTranlated.x = 0;
    this.lastTranlated.y = 0;
    this.hoverLayer.dockAnchor = null;
    this.hoverLayer.dockLineX = 0;
    this.hoverLayer.dockLineY = 0;
    this.hoverLayer.canvas.style.cursor = 'default';

    if (this.hoverLayer.dragRect) {
      this.getRectNodes(this.nodes, this.hoverLayer.dragRect);
      this.getRectLines(this.lines, this.hoverLayer.dragRect);
      this.activeLayer.render();

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
            // Deactive nodes.
            this.activeLayer.nodes = [];

            if (this.hoverLayer.line.to.id || !this.options.disableEmptyLine) {
              this.activeLayer.lines = [this.hoverLayer.line];
              Store.set('activeLine', this.hoverLayer.line);
              this.options.on('line', this.hoverLayer.line);
            } else {
              this.lines.pop();
            }

            this.activeLayer.render();
          }

          this.offscreen.render();

          this.hoverLayer.line = null;
          break;
        case MoveInType.Rotate:
          this.activeLayer.updateRotate();
          this.activeLayer.render();
          this.animateLayer.render();
          break;

        case MoveInType.LineControlPoint:
          Store.set('pts-' + this.moveIn.hoverLine.id, null);
          break;
      }
    }

    this.hoverLayer.dragRect = null;
    this.hoverLayer.render();

    if (this.nodesMoved || this.moveIn.type !== MoveInType.None) {
      this.cache();
    }
    this.nodesMoved = false;
  };

  private ondblclick = (e: MouseEvent) => {
    switch (this.moveIn.type) {
      case MoveInType.Nodes:
        if (this.moveIn.hoverNode) {
          const textObj = this.clickText(this.moveIn.hoverNode, new Point(e.offsetX, e.offsetY));
          if (textObj) {
            this.showInput(textObj.node, textObj.textRect);
          }
          if (this.options.on) {
            this.options.on('dblclick', this.moveIn.hoverNode);
          }
        }
        break;
    }
  };

  private clickText(node: Node, pos: Point): { node: Node; textRect: Rect } {
    const textRect = node.getTextRect();
    if (textRect.hitRotate(pos, node.rotate, node.rect.center)) {
      return {
        node,
        textRect
      };
    }

    if (!node.children) {
      return null;
    }

    for (const item of node.children) {
      const rect = this.clickText(item, pos);
      if (rect) {
        return rect;
      }
    }

    return null;
  }

  private onkeydown = (key: KeyboardEvent) => {
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
    }

    this.activeLayer.render();
    this.animateLayer.render();
    this.hoverLayer.render();
    this.offscreen.render();
    this.cache();
  };

  private getHoverNode(pt: Point) {
    for (let i = this.activeLayer.nodes.length - 1; i > -1; --i) {
      if (this.activeLayer.nodes[i].hit(pt, 2)) {
        this.moveIn.hoverNode = this.activeLayer.nodes[i];
        this.moveIn.type = MoveInType.Nodes;
        return;
      }
    }

    for (let i = this.nodes.length - 1; i > -1; --i) {
      if (this.nodes[i].hit(pt, 2)) {
        this.moveIn.hoverNode = this.nodes[i];
        this.moveIn.type = MoveInType.Nodes;
        break;
      }
    }
  }

  private getMoveIn(pt: Point) {
    this.lastHoverNode = this.moveIn.hoverNode;
    this.moveIn.type = MoveInType.None;
    this.moveIn.hoverNode = null;
    this.moveIn.lineControlPoint = null;
    this.moveIn.hoverLine = null;
    this.hoverLayer.hoverAnchorIndex = -1;

    // In active line.
    if (this.locked !== 1) {
      for (const item of this.activeLayer.lines) {
        if (this.isInLine(pt, item)) {
          return;
        }
      }
    }

    // In nodes
    this.getHoverNode(pt);
    if (this.moveIn.hoverNode) {
      this.hoverLayer.canvas.style.cursor = 'move';
    } else {
      this.hoverLayer.canvas.style.cursor = 'default';
    }
    // In activeLayer
    if (this.activeLayer.nodes.length) {
      if (this.activeLayer.rotateCPs[0].hit(pt, 15)) {
        this.moveIn.type = MoveInType.Rotate;
        this.hoverLayer.canvas.style.cursor = `url("${this.options.rotateCursor}"), auto`;
      } else {
        if (pointInRect(pt, this.activeLayer.sizeCPs)) {
          this.moveIn.type = MoveInType.Nodes;
          this.hoverLayer.canvas.style.cursor = 'move';
        }

        if (!this.locked) {
          for (let i = 0; i < this.activeLayer.sizeCPs.length; ++i) {
            if (this.activeLayer.sizeCPs[i].hit(pt, 10)) {
              this.moveIn.type = MoveInType.ResizeCP;
              this.moveIn.activeAnchorIndex = i;
              this.hoverLayer.canvas.style.cursor = resizeCursors[i];
              break;
            }
          }
        }
      }
    }

    if (this.moveIn.type === MoveInType.ResizeCP || this.moveIn.type === MoveInType.Rotate) {
      return;
    }

    // In anchors of hoverNode
    if (this.moveIn.hoverNode && !this.locked) {
      for (let i = 0; i < this.moveIn.hoverNode.rotatedAnchors.length; ++i) {
        if (this.moveIn.hoverNode.rotatedAnchors[i].hit(pt, 8)) {
          this.moveIn.type = MoveInType.HoverAnchors;
          this.moveIn.hoverAnchorIndex = i;
          this.hoverLayer.hoverAnchorIndex = i;
          this.hoverLayer.canvas.style.cursor = 'crosshair';
          return;
        }
      }
    }

    // In line
    if (this.locked === 1) {
      return;
    }
    let index = 0;
    for (const item of this.lines) {
      ++index;
      if (!item.to) {
        this.lines.splice(index - 1, 1);
        continue;
      }

      if (this.isInLine(pt, item)) {
        return;
      }
    }
  }

  isInLine(point: Point, line: Line) {
    // In LineControlPoint
    if (this.activeLayer.lines.length) {
      let i = 0;
      for (const pt of line.controlPoints) {
        if (pt.hit(point)) {
          pt.id = i;
          this.moveIn.type = MoveInType.LineControlPoint;
          this.moveIn.lineControlPoint = pt;
          this.moveIn.hoverLine = line;
          this.hoverLayer.canvas.style.cursor = 'pointer';
          return true;
        }
        ++i;
      }
    }

    if (line.from.hit(point, 10)) {
      this.moveIn.type = MoveInType.LineFrom;
      this.moveIn.hoverLine = line;
      this.hoverLayer.canvas.style.cursor = 'move';
      return true;
    }

    if (line.to.hit(point, 10)) {
      this.moveIn.type = MoveInType.LineTo;
      this.moveIn.hoverLine = line;
      this.hoverLayer.canvas.style.cursor = 'move';
      return true;
    }

    if (line.pointIn(point)) {
      this.moveIn.type = MoveInType.LineMove;
      this.moveIn.hoverLine = line;
      this.hoverLayer.canvas.style.cursor = 'move';
      if (line.from.id || line.to.id) {
        this.moveIn.type = MoveInType.Line;
        this.hoverLayer.canvas.style.cursor = 'pointer';
      }
      return true;
    }

    return false;
  }

  private getLineDock(point: Point) {
    this.hoverLayer.dockAnchor = null;
    for (const item of this.nodes) {
      if (item.rect.hit(point, 10)) {
        this.hoverLayer.node = item;
      }
      for (let i = 0; i < item.rotatedAnchors.length; ++i) {
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
        this.activeLayer.lines.push(item);
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

  private showInput(node: Node, textRect: Rect) {
    if (this.locked || this.options.hideInput) {
      return;
    }
    this.inputNode = node;
    this.input.value = node.text;
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
    for (const item of this.nodes) {
      const pts = item.rect.toPoints();
      if (item.rotate) {
        for (const pt of pts) {
          pt.rotate(item.rotate, item.rect.center);
        }
      }
      points.push.apply(points, pts);
    }

    for (const l of this.lines) {
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
      for (const item of this.nodes) {
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
            this.hoverLayer.dockLineX = p.x;
          }

          y = Math.abs(p.y - activePt.y - offsetY);
          if (y < disY) {
            disY = -99999;
            offset.y = p.y - activePt.y;
            this.hoverLayer.dockLineY = p.y;
          }
        }
      }
    }

    return offset;
  }

  private cache() {
    const c = {
      nodes: [],
      lines: []
    };
    for (const item of this.nodes) {
      c.nodes.push(new Node(item));
    }
    for (const item of this.lines) {
      c.lines.push(new Line(item));
    }
    if (this.caches.index < this.caches.list.length - 1) {
      this.caches.list.splice(this.caches.index + 1, this.caches.list.length - this.caches.index - 1, c);
    } else {
      this.caches.list.push(c);
    }

    this.caches.index = this.caches.list.length - 1;
  }

  undo() {
    if (this.locked || this.caches.index < 1) {
      return;
    }

    const data = this.caches.list[--this.caches.index];
    this.nodes.splice(0, this.nodes.length);
    this.lines.splice(0, this.lines.length);
    this.nodes.push.apply(this.nodes, data.nodes);
    this.lines.push.apply(this.lines, data.lines);
    this.render();
  }

  redo() {
    if (this.locked || this.caches.index > this.caches.list.length - 2) {
      return;
    }

    const data = this.caches.list[++this.caches.index];
    this.nodes.splice(0, this.nodes.length);
    this.lines.splice(0, this.lines.length);
    this.nodes.push.apply(this.nodes, data.nodes);
    this.lines.push.apply(this.lines, data.lines);
    this.render();
  }

  data() {
    return {
      nodes: this.nodes,
      lines: this.lines,
      lineName: this.lineName,
      fromArrowType: this.fromArrowType,
      toArrowType: this.toArrowType,
      scaleState: this.scaleState,
      locked: this.locked
    };
  }

  toImage(type?: string, quality?: any, callback?: any): string {
    const rect = this.getRect();
    const canvas = document.createElement('canvas');
    canvas.width = rect.width + 20;
    canvas.height = rect.height + 20;

    const ctx = canvas.getContext('2d');
    if (type && type !== 'image/png') {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(
      this.offscreen.canvas,
      rect.x - 10,
      rect.y - 10,
      rect.width + 20,
      rect.height + 20,
      0,
      0,
      rect.width + 20,
      rect.height + 20
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
    let i = 0;
    for (const line of this.activeLayer.lines) {
      i = 0;
      for (const l of this.lines) {
        if (line.id === l.id) {
          this.lines.splice(i, 1);
          break;
        }
        ++i;
      }
    }

    for (const node of this.activeLayer.nodes) {
      i = this.findNode(node);
      if (i > -1) {
        this.nodes.splice(i, 1);
      }
    }

    this.activeLayer.saveNodeRects();
    this.render();
    this.cache();
  }

  cut() {
    if (this.locked) {
      return;
    }

    this.clipboard = {
      nodes: [],
      lines: []
    };
    for (const item of this.activeLayer.nodes) {
      this.clipboard.nodes.push(new Node(item));

      const i = this.findNode(item);
      if (i > -1) {
        this.nodes.splice(i, 1);
      }
    }
    for (const item of this.activeLayer.lines) {
      this.clipboard.lines.push(new Line(item));

      let i = 0;
      for (const line of this.lines) {
        if (item.id === line.id) {
          this.lines.splice(i, 1);
        }
        ++i;
      }
    }

    this.cache();

    this.activeLayer.nodes = [];
    this.activeLayer.lines = [];
    this.activeLayer.render();

    this.animateLayer.render();

    this.hoverLayer.node = null;
    this.hoverLayer.render();

    this.offscreen.render();

    this.moveIn.hoverLine = null;
    this.moveIn.hoverNode = null;
  }

  copy() {
    this.clipboard = {
      nodes: [],
      lines: []
    };
    for (const item of this.activeLayer.nodes) {
      this.clipboard.nodes.push(new Node(item));
    }

    for (const item of this.activeLayer.lines) {
      this.clipboard.lines.push(new Line(item));
    }
  }

  parse() {
    if (!this.clipboard || this.locked) {
      return;
    }

    this.hoverLayer.node = null;
    this.hoverLayer.line = null;
    this.hoverLayer.render();

    this.activeLayer.nodes = [];
    this.activeLayer.lines = [];

    const idMaps: any = {};
    for (const item of this.clipboard.nodes) {
      const old = item.id;
      item.id = s8();
      idMaps[old] = item.id;
      item.rect.x += 20;
      item.rect.ex += 20;
      item.rect.y += 20;
      item.rect.ey += 20;

      const node = new Node(item);
      this.nodes.push(node);
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

      const line = new Line(item);
      this.lines.push(line);
      this.activeLayer.lines.push(line);
      Store.set('activeLine', line);
    }

    this.offscreen.render();
    this.activeLayer.render();
    this.animateLayer.render();

    this.cache();

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
      this.options.on('node', this.activeLayer.nodes[0]);
    } else if (this.clipboard.lines.length) {
      this.options.on('line', this.activeLayer.lines[0]);
    }
  }

  animate() {
    this.offscreen.render();
    this.animateLayer.render(false);
  }

  updateProps(
    nodes: Node[],
    lines: Line[],
    props: {
      dash: number;
      lineWidth: number;
      strokeStyle: string;
      fillStyle: string;
      globalAlpha: number;
      rotate: number;
    }
  ) {
    this.activeLayer.updateProps(nodes, lines, props);
    this.activeLayer.saveNodeRects();
    this.activeLayer.changeLineType();

    this.activeLayer.render();
    this.animateLayer.render();
    this.hoverLayer.render();
    this.offscreen.render();

    this.cache();
  }

  lock(lock: number) {
    this.locked = lock;
    Store.set('locked', lock);
    if (this.options.on) {
      this.options.on('locked', this.locked);
    }
  }

  top(node: Node) {
    const i = this.findNode(node);
    if (i > -1) {
      this.nodes.push(this.nodes[i]);
      this.nodes.splice(i, 1);
    }
  }

  bottom(node: Node) {
    const i = this.findNode(node);
    if (i > -1) {
      this.nodes.unshift(this.nodes[i]);
      this.nodes.splice(i + 1, 1);
    }
  }

  combine(nodes: Node[]) {
    const rect = this.getNodesRect(nodes);
    for (const item of nodes) {
      const i = this.findNode(item);
      if (i > -1) {
        this.nodes.splice(i, 1);
      }
    }

    const node = new Node({
      name: 'combine',
      rect,
      text: '',
      strokeStyle: 'transparent'
    });
    node.children = [];
    for (const item of nodes) {
      item.parentId = node.id;
      item.parentRect = {
        offsetX: 10,
        offsetY: 10,
        x: (item.rect.x - node.rect.x - 10) / (node.rect.width - 10),
        y: (item.rect.y - node.rect.y - 10) / (node.rect.height - 10),
        width: item.rect.width / (node.rect.width - 10),
        height: item.rect.height / (node.rect.height - 10),
        marginX: 0,
        marginY: 0,
        rotate: item.rotate
      };
      node.children.push(item);
    }
    this.nodes.push(node);
    this.cache();
  }

  uncombine(node: Node) {
    if (node.name !== 'combine') {
      return;
    }

    const i = this.findNode(node);
    if (i > -1) {
      this.nodes.splice(i, 1);
    }

    for (const item of node.children) {
      item.parentId = undefined;
      item.parentRect = undefined;
      this.nodes.push(item);
    }

    this.cache();
  }

  private findNode(node: Node) {
    for (let i = 0; i < this.nodes.length; ++i) {
      if (node.id === this.nodes[i].id) {
        return i;
      }
    }

    return -1;
  }

  translate(x: number, y: number) {
    const offsetX = x - this.lastTranlated.x;
    const offsetY = y - this.lastTranlated.y;

    for (const item of this.nodes) {
      item.rect.x += offsetX;
      item.rect.y += offsetY;
      item.rect.ex = item.rect.x + item.rect.width;
      item.rect.ey = item.rect.y + item.rect.height;
      item.rect.calceCenter();
      item.init();
      this.activeLayer.updateChildren(item);
    }

    for (const item of this.lines) {
      item.from.x += offsetX;
      item.from.y += offsetY;
      item.to.x += offsetX;
      item.to.y += offsetY;

      for (const pt of item.controlPoints) {
        pt.x += offsetX;
        pt.y += offsetY;
      }

      Store.set('pts-' + item.id, null);
    }

    this.lastTranlated.x = x;
    this.lastTranlated.y = y;
    this.overflow();
    this.render();
    this.cache();

    if (this.options.on) {
      this.options.on('translate', { x, y });
    }
  }

  // scale for scaled canvas:
  //   > 1, expand
  //   < 1, reduce
  scale(scale: number) {
    this.scaleState *= scale;
    const center = this.getRect().center;

    for (const item of this.nodes) {
      item.scale(scale, center);
    }

    for (const item of this.lines) {
      item.from.x = center.x - (center.x - item.from.x) * scale;
      item.from.y = center.y - (center.y - item.from.y) * scale;
      item.to.x = center.x - (center.x - item.to.x) * scale;
      item.to.y = center.y - (center.y - item.to.y) * scale;

      for (const pt of item.controlPoints) {
        pt.x = center.x - (center.x - pt.x) * scale;
        pt.y = center.y - (center.y - pt.y) * scale;
      }

      Store.set('pts-' + item.id, null);
    }
    Store.set('scale', this.scaleState);

    this.overflow();
    this.render();
    this.cache();

    if (this.options.on) {
      this.options.on('scale', this.scaleState);
    }
  }

  // scale for origin canvas:
  scaleTo(scale: number) {
    this.scale(scale / this.scaleState);
  }

  round() {
    for (const item of this.nodes) {
      item.round();
    }
  }

  destory() {
    this.subcribe.unsubcribe();
    this.subcribeAnimateEnd.unsubcribe();
    this.subcribeAnimateMoved.unsubcribe();
  }
}
