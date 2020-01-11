import { Store } from 'le5le-store';

import { Options } from './options';

import { Node } from './models/node';
import { Line } from './models/line';
import { Rect } from './models/rect';
import { Point } from './models/point';
import { TopologyData } from './models/data';
import { Lock } from './models/status';

import { drawLineFns } from './middles';

export class ActiveLayer {
  protected data: TopologyData = Store.get('topology-data');

  rotateCPs: Point[] = [];
  sizeCPs: Point[] = [];
  rect: Rect;

  nodes: Node[] = [];
  lines: Line[] = [];

  rotate = 0;

  // 备份初始位置，方便移动事件处理
  initialSizeCPs: Point[] = [];
  nodeRects: Rect[] = [];
  childrenRects: { [key: string]: Rect; } = {};

  // nodes移动时，停靠点的参考位置
  dockWatchers: Point[] = [];

  rotating = false;

  constructor(public options: Options = {}) {
    Store.set('LT:ActiveLayer', this);
    if (!this.options.activeColor) {
      this.options.activeColor = '#d4380d';
    }
  }

  calcControlPoints() {
    if (this.nodes.length === 1) {
      this.rect = this.nodes[0].rect;
      this.sizeCPs = this.nodes[0].rect.toPoints();
      this.rotateCPs = [
        new Point(this.nodes[0].rect.x + this.nodes[0].rect.width / 2, this.nodes[0].rect.y - 35),
        new Point(this.nodes[0].rect.x + this.nodes[0].rect.width / 2, this.nodes[0].rect.y)
      ];

      if (this.rotate || this.nodes[0].rotate) {
        for (const pt of this.sizeCPs) {
          if (this.nodes[0].rotate) {
            pt.rotate(this.nodes[0].rotate, this.nodes[0].rect.center);
          }
          if (this.rotate) {
            pt.rotate(this.rotate, this.rect.center);
          }
        }
        for (const pt of this.rotateCPs) {
          if (this.nodes[0].rotate) {
            pt.rotate(this.nodes[0].rotate, this.nodes[0].rect.center);
          }
          if (this.rotate) {
            pt.rotate(this.rotate, this.rect.center);
          }
        }
      }

      if (this.options.hideRotateCP) {
        this.rotateCPs = [new Point(-1000, -1000), new Point(-1000, -1000)];
      }
      if (this.options.hideControlPoints) {
        this.sizeCPs = [
          new Point(-1000, -1000),
          new Point(-1000, -1000),
          new Point(-1000, -1000),
          new Point(-1000, -1000)
        ]
      }

      return;
    }

    let x1 = 99999;
    let y1 = 99999;
    let x2 = -99999;
    let y2 = -99999;
    const pts = this.getPoints();
    for (const item of pts) {
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
    this.rect = new Rect(x1, y1, x2 - x1, y2 - y1);
    this.sizeCPs = [new Point(x1, y1), new Point(x2, y1), new Point(x2, y2), new Point(x1, y2)];
    this.rotateCPs = [new Point(x1 + (x2 - x1) / 2, y1 - 35), new Point(x1 + (x2 - x1) / 2, y1)];

    if (this.options.hideRotateCP) {
      this.rotateCPs = [new Point(-1000, -1000), new Point(-1000, -1000)];
    }
  }

  locked() {
    for (const item of this.nodes) {
      if (!item.locked) {
        return false;
      }
    }

    for (const item of this.lines) {
      if (!item.locked) {
        return false;
      }
    }

    return true;
  }

  getPoints() {
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

    return points;
  }

  clear() {
    this.lines = [];
    this.nodes = [];
    this.sizeCPs = [];
    this.rotateCPs = [];
    Store.set('LT:activeNode', null);
  }

  // 即将缩放选中的nodes，备份nodes最初大小，方便缩放比例计算
  saveNodeRects() {
    this.nodeRects = [];
    this.childrenRects = {};
    for (const item of this.nodes) {
      this.nodeRects.push(new Rect(item.rect.x, item.rect.y, item.rect.width, item.rect.height));
      this.saveChildrenRects(item);
    }

    this.initialSizeCPs = [];
    for (const item of this.sizeCPs) {
      const pt = item.clone();
      // Cancel rotate while it is a single node. For yScale will < 0 and error.
      if (this.nodes.length === 1 && this.nodes[0].rotate) {
        pt.rotate(-this.nodes[0].rotate, this.nodes[0].rect.center);
      }
      this.initialSizeCPs.push(pt);
    }

    this.getDockWatchers();
  }

  private saveChildrenRects(node: Node) {
    if (!node.children) {
      return;
    }

    for (const item of node.children) {
      this.childrenRects[item.id] = new Rect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
      this.saveChildrenRects(item);
    }
  }

  resizeNodes(type: number, pt: Point) {
    let i = 0;
    const pos: Point = new Point(0, 0);
    let x;
    let y;
    let w;
    let h;
    for (const item of this.nodes) {
      switch (type) {
        // nw-resize
        case 0:
          x = pt.x;
          y = pt.y;
          w = this.initialSizeCPs[2].x - pt.x;
          h = this.initialSizeCPs[2].y - pt.y;
          pos.x = w > 5 ? x : this.initialSizeCPs[2].x - 5;
          pos.y = h > 5 ? y : this.initialSizeCPs[2].y - 5;
          break;
        // ne-resize
        case 1:
          y = pt.y;
          w = pt.x - this.initialSizeCPs[0].x;
          h = this.initialSizeCPs[2].y - pt.y;
          pos.x = this.initialSizeCPs[0].x;
          pos.y = h > 5 ? y : this.initialSizeCPs[2].y - 5;
          break;
        // se-resize
        case 2:
          w = pt.x - this.initialSizeCPs[0].x;
          h = pt.y - this.initialSizeCPs[0].y;
          pos.x = this.initialSizeCPs[0].x;
          pos.y = this.initialSizeCPs[0].y;
          break;
        // sw-resize
        case 3:
          x = pt.x;
          w = this.initialSizeCPs[2].x - pt.x;
          h = pt.y - this.initialSizeCPs[0].y;
          pos.x = w > 5 ? x : this.initialSizeCPs[2].x - 5;
          pos.y = this.initialSizeCPs[0].y;
          break;
      }

      w = w > 5 ? w : 5;
      h = h > 5 ? h : 5;
      const scaleX = w / (this.initialSizeCPs[2].x - this.initialSizeCPs[0].x);
      const scaleY = h / (this.initialSizeCPs[2].y - this.initialSizeCPs[0].y);
      this.calcResizedPos(
        item.rect,
        this.nodeRects[i],
        pos,
        scaleX,
        scaleY
      );

      const oldCenter = item.rect.center;
      item.rect.floor();
      item.rect.calceCenter();
      item.init();
      item.elementRendered = false;
      this.updateChildren(item);

      const lines = this.getLinesOfNode(item);
      for (const line of lines) {
        for (const p of line.controlPoints) {
          //
        }
      }

      ++i;
    }

    this.updateLines();
  }

  // 当initRect缩放为rect后，计算node在occupy中的新位置
  // initRect - node的原始位置
  // xScale - x坐标缩放比例
  // yScale - y坐标缩放比例
  calcResizedPos(rect: Rect, initRect: Rect, pos: Point, xScale: number, yScale: number) {
    rect.x = pos.x + (initRect.x - this.initialSizeCPs[0].x) * xScale;
    rect.y = pos.y + (initRect.y - this.initialSizeCPs[0].y) * yScale;
    rect.width = initRect.width * xScale;
    rect.height = initRect.height * yScale;
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;
  }

  moveNodes(x: number, y: number) {
    if (this.nodeRects.length !== this.nodes.length) {
      return;
    }
    let i = 0;
    for (const item of this.nodes) {
      if (item.locked) {
        continue;
      }
      const offsetX = this.nodeRects[i].x + x - item.rect.x;
      const offsetY = this.nodeRects[i].y + y - item.rect.y;
      item.translate(offsetX, offsetY);
      const lines = this.getLinesOfNode(item);
      for (const line of lines) {
        line.translate(offsetX, offsetY);
      }
      this.updateChildren(item);

      if (item.parentId && item.stand) {
        let parent: Node;
        for (const n of this.data.nodes) {
          if (n.id === item.parentId) {
            parent = n;
            break;
          }
        }
        item.calcRectInParent(parent);
      }

      ++i;
    }
    this.updateLines();

    if (this.options.on) {
      this.options.on('moveNodes', this.nodes);
    }
  }

  updateChildren(node: Node) {
    if (!node.children) {
      return;
    }
    for (const item of node.children) {
      item.calcChildRect(node);
      item.init();
      this.updateChildren(item);
    }
  }

  getAllChildren(result: Node[], node: Node) {
    if (!node.children) {
      return;
    }

    result.push.apply(result, node.children);

    for (const n of node.children) {
      result.push(n);
      this.getAllChildren(result, n);
    }
  }

  getLinesOfNode(node: Node) {
    const result: Line[] = [];

    const nodes: Node[] = [node];
    this.getAllChildren(nodes, node);

    for (const line of this.data.lines) {
      let fromIn = false;
      let toIn = false;
      for (const item of nodes) {
        if (line.from.id === item.id) {
          fromIn = true;
        }
        if (line.to.id === item.id) {
          toIn = true;
        }
      }

      if (fromIn && toIn) {
        result.push(line);
      }
    }

    return result;
  }

  updateLines(nodes?: Node[]) {
    if (!nodes) {
      nodes = this.nodes;
    }
    for (const line of this.data.lines) {
      for (const item of nodes) {
        if (line.from.id === item.id) {
          line.from.x = item.rotatedAnchors[line.from.anchorIndex].x;
          line.from.y = item.rotatedAnchors[line.from.anchorIndex].y;
        }
        if (line.to.id === item.id) {
          line.to.x = item.rotatedAnchors[line.to.anchorIndex].x;
          line.to.y = item.rotatedAnchors[line.to.anchorIndex].y;
        }
        line.textRect = null;
        Store.set('pts-' + line.id, null);
        if (item.children) {
          this.updateLines(item.children);
        }
      }
    }
  }

  changeLineType() {
    for (const item of this.lines) {
      item.calcControlPoints();
    }
  }

  offsetRotate(angle: number) {
    this.rotating = true;
    let i = 0;
    for (const item of this.nodes) {
      const center = this.nodeRects[i].center.clone();
      if (this.nodes.length > 1) {
        center.rotate(angle, this.rect.center);
      }
      item.rect.x = center.x - item.rect.width / 2;
      item.rect.y = center.y - item.rect.height / 2;
      item.rect.ex = item.rect.x + item.rect.width;
      item.rect.ey = item.rect.y + item.rect.height;
      item.rect.calceCenter();
      item.init();
      item.offsetRotate = angle;
      item.calcRotateAnchors(item.rotate + item.offsetRotate);
      this.updateChildren(item);
      ++i;
    }
    this.rotate = angle;

    if (this.options.on) {
      this.options.on('rotateNodes', this.nodes);
    }
  }

  updateRotate() {
    for (const item of this.nodes) {
      item.rotate += item.offsetRotate;
      item.offsetRotate = 0;
    }
    this.rotate = 0;
    this.rotating = false;
  }

  addNode(node: Node) {
    this.nodes.push(node);
    if (this.nodes.length === 1) {
      Store.set('LT:activeNode', this.nodes[0]);
    }
  }

  setNodes(nodes: Node[]) {
    this.nodes = nodes;
    this.lines = [];
    if (this.nodes.length === 1) {
      Store.set('LT:activeNode', this.nodes[0]);
    }
  }

  hasNode(node: Node) {
    let found = false;
    for (const item of this.nodes) {
      if (item.id === node.id) {
        found = true;
        break;
      }
    }

    return found;
  }

  setLines(lines: Line[]) {
    this.nodes = [];
    this.lines = lines;
  }

  addLine(line: Line) {
    for (const item of this.lines) {
      if (item.id === line.id) {
        return;
      }
    }

    this.lines.push(line);
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.data.locked > Lock.Readonly) {
      return;
    }

    if (!this.nodes.length && !this.lines.length) {
      return;
    }

    if (this.nodes.length === 1 || !this.rotating) {
      this.calcControlPoints();
    }

    ctx.save();

    ctx.strokeStyle = this.options.activeColor;
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 1;

    for (const item of this.nodes) {
      const tmp = new Node(item);
      tmp.data = null;
      tmp.fillStyle = null;
      tmp.bkType = 0;
      tmp.icon = '';
      tmp.image = '';
      tmp.text = '';
      tmp.children = null;
      if (tmp.strokeStyle !== 'transparent') {
        tmp.strokeStyle = '#ffffff';
        tmp.lineWidth += 2;
        tmp.render(ctx);

        tmp.strokeStyle = this.options.activeColor;
        tmp.lineWidth -= 2;
      }
      tmp.render(ctx);
    }

    for (const item of this.lines) {
      if (!item.to) {
        continue;
      }

      const tmp = new Line(item);
      if (tmp.lineWidth < 3) {
        const bk = new Line(item);
        bk.strokeStyle = '#ffffff';
        bk.render(ctx);
      }
      tmp.strokeStyle = this.options.activeColor;
      tmp.fromArrowColor = this.options.activeColor;
      tmp.toArrowColor = this.options.activeColor;
      tmp.render(ctx);

      if (!item.locked) {
        drawLineFns[item.name].drawControlPointsFn(ctx, item);
      }
    }

    // This is diffence between single node and more.
    if (this.rotate && this.nodes.length > 1) {
      ctx.translate(this.rect.center.x, this.rect.center.y);
      ctx.rotate((this.rotate * Math.PI) / 180);
      ctx.translate(-this.rect.center.x, -this.rect.center.y);
    }

    // Occupied territory.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.translate(0.5, 0.5);
    ctx.beginPath();
    ctx.moveTo(this.sizeCPs[0].x, this.sizeCPs[0].y);
    ctx.lineTo(this.sizeCPs[1].x, this.sizeCPs[1].y);
    ctx.lineTo(this.sizeCPs[2].x, this.sizeCPs[2].y);
    ctx.lineTo(this.sizeCPs[3].x, this.sizeCPs[3].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (this.data.locked || this.locked()) {
      ctx.restore();
      return;
    }

    // Draw rotate control point.
    ctx.beginPath();
    ctx.moveTo(this.rotateCPs[0].x, this.rotateCPs[0].y);
    ctx.lineTo(this.rotateCPs[1].x, this.rotateCPs[1].y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.rotateCPs[0].x, this.rotateCPs[0].y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw size control points.
    ctx.lineWidth = 1;
    for (const item of this.sizeCPs) {
      ctx.save();
      ctx.beginPath();
      if (this.nodes.length === 1 && (this.nodes[0].rotate || this.rotate)) {
        ctx.translate(item.x, item.y);
        ctx.rotate(((this.nodes[0].rotate + this.rotate) * Math.PI) / 180);
        ctx.translate(-item.x, -item.y);
      }
      ctx.fillRect(item.x - 4.5, item.y - 4.5, 8, 8);
      ctx.strokeRect(item.x - 5.5, item.y - 5.5, 10, 10);
      ctx.restore();
    }

    ctx.restore();
  }

  getDockWatchers() {
    if (this.nodes.length === 1) {
      this.dockWatchers = this.nodeRects[0].toPoints();
      this.dockWatchers.unshift(this.nodeRects[0].center);
      return;
    }

    if (!this.rect) {
      return;
    }
    this.dockWatchers = this.rect.toPoints();
    this.dockWatchers.unshift(this.rect.center);
  }

  alignNodes(align: string) {
    switch (align) {
      case 'left':
        for (const item of this.nodes) {
          item.rect.x = this.rect.x;
          item.rect.floor();
          item.rect.calceCenter();
          item.init();
          this.updateChildren(item);
        }
        break;
      case 'right':
        for (const item of this.nodes) {
          item.rect.x = this.rect.ex - item.rect.width;
          item.rect.floor();
          item.rect.calceCenter();
          item.init();
          this.updateChildren(item);
        }
        break;
      case 'top':
        for (const item of this.nodes) {
          item.rect.y = this.rect.y;
          item.rect.floor();
          item.rect.calceCenter();
          item.init();
          this.updateChildren(item);
        }
        break;
      case 'bottom':
        for (const item of this.nodes) {
          item.rect.y = this.rect.ey - item.rect.height;
          item.rect.floor();
          item.rect.calceCenter();
          item.init();
          this.updateChildren(item);
        }
        break;
      case 'center':
        for (const item of this.nodes) {
          item.rect.x = this.rect.center.x - item.rect.width / 2;
          item.rect.floor();
          item.rect.calceCenter();
          item.init();
          this.updateChildren(item);
        }
        break;
      case 'middle':
        for (const item of this.nodes) {
          item.rect.y = this.rect.center.y - item.rect.height / 2;
          item.rect.floor();
          item.rect.calceCenter();
          item.init();
          this.updateChildren(item);
        }
        break;
    }

    this.updateLines();
  }
}
