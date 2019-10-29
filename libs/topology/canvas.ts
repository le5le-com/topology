import { Node } from './models/node';
import { Line } from './models/line';
import { Store } from 'le5le-store';
import { Options } from './options';

export class Canvas {
  canvas = document.createElement('canvas');
  private nodes: Node[] = Store.get('nodes');
  private lines: Line[] = Store.get('lines');
  rendering = false;
  constructor(public options: Options = {}) {
    this.canvas.style.outline = 'none';
  }

  init() {
    this.nodes = Store.get('nodes');
    this.lines = Store.get('lines');
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render() {
    if (this.rendering) {
      return;
    }

    this.rendering = true;
    // Clear the canvas.
    this.canvas.height = this.canvas.height;

    const ctx = this.canvas.getContext('2d');
    ctx.strokeStyle = this.options.color;
    ctx.fillStyle = '#fff';

    this.renderNodes();
    this.renderLines();
    Store.set('render', 1);
    this.rendering = false;
  }

  renderNodes() {
    if (!this.nodes.length) {
      return;
    }

    const ctx = this.canvas.getContext('2d');
    for (const item of this.nodes) {
      if (item.animateStart && item.animateDuration) {
        continue;
      }
      item.render(ctx);
    }
  }

  renderLines() {
    if (!this.lines.length) {
      return;
    }

    const ctx = this.canvas.getContext('2d');
    let i = 0;
    for (const item of this.lines) {
      if (!item.to) {
        this.lines.splice(i++, 1);
        continue;
      }
      item.render(ctx);
      ++i;
    }
  }
}
