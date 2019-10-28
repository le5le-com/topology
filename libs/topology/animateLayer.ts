import { Node } from './models/node';
import { Line } from './models/line';
import { Store } from 'le5le-store';

export class AnimateLayer {
  canvas = document.createElement('canvas');
  nodes: Node[] = [];
  lines: Line[] = [];

  private last = Date.now();
  private timer: any;
  constructor(parent: HTMLElement, public options: any) {
    if (!this.options.animateColor) {
      this.options.animateColor = '#ff6600';
    }

    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.outline = 'none';
    parent.appendChild(this.canvas);
  }

  render(force = true) {
    if (this.timer) {
      cancelAnimationFrame(this.timer);
    }

    if (force) {
      this.nodes = [];
      this.lines = [];
    }

    this.getNodes(Store.get('nodes'));
    this.getLines();

    this.animate();
  }

  getNodes(nodes: Node[], tag = '') {
    if (!nodes) {
      return;
    }
    for (const item of nodes) {
      let found = false;
      if (tag && item.tags.indexOf(tag) > -1) {
        item.animateStart = Date.now();
      }
      for (let i = 0; i < this.nodes.length; ++i) {
        if (this.nodes[i].id === item.id) {
          item.animateCycleIndex = 1;
          found = true;
          if (!item.animateStart) {
            this.nodes.splice(i, 1);
          }
        }
      }

      if (!found && item.animateStart) {
        item.updateAnimateProps();
        this.nodes.push(item);
        this.getNodes(item.children);
      }
    }
  }

  getLines(tag = '') {
    const lines = Store.get('lines');
    for (const item of lines) {
      let found = false;
      if (tag && item.tags.indexOf(tag) > -1) {
        item.animateStart = Date.now();
      }
      for (let i = 0; i < this.lines.length; ++i) {
        if (this.lines[i].id === item.id) {
          this.lines[i].animateCycle = item.animateCycle;
          this.lines[i].animateCycleIndex = 1;
          this.lines[i].animateColor = item.animateColor || this.options.animateColor;
          this.lines[i].strokeStyle = item.animateColor || this.options.animateColor;
          this.lines[i].animateSpan = item.animateSpan;
          found = true;

          if (item.animateStart) {
            this.lines[i].animateStart = item.animateStart;
          } else {
            this.lines.splice(i, 1);
          }
        }
      }

      if (!found && item.animateStart) {
        const l = new Line(item);
        l.animateStart = item.animateStart;
        l.fromArrow = '';
        l.toArrow = '';
        l.lineWidth += 1;
        l.strokeStyle = l.animateColor || this.options.animateColor;
        l.length = l.getLen();
        this.lines.push(l);
      }
    }
  }

  animate() {
    if (!this.lines.length && !this.nodes.length) {
      // clear
      this.canvas.height = this.canvas.height;
      this.timer = null;
      return;
    }

    this.timer = requestAnimationFrame(() => {
      const now = Date.now();
      const interval = now - this.last;
      this.last = now;

      // Not too fast.
      if (interval > 15) {
        // clear
        this.canvas.height = this.canvas.height;

        const ctx = this.canvas.getContext('2d');
        for (let i = 0; i < this.lines.length; ++i) {
          const next = this.lines[i].animate(ctx);
          if (!this.lines[i].animateStart) {
            for (const item of Store.get('lines')) {
              if (this.lines[i].id === item.id) {
                item.animateStart = 0;
                break;
              }
            }
          }
          if (next) {
            this.lines.splice(i, 1);
            this.getNodes(Store.get('nodes'), next);
            this.getLines(next);
          }

          if (this.lines[i] && !this.lines[i].animateStart) {
            this.lines.splice(i, 1);
          }
        }
        for (let i = 0; i < this.nodes.length; ++i) {
          if (this.nodes[i].animateDuration && this.nodes[i].animateStart) {
            const next = this.nodes[i].animate(ctx, now);
            // console.log(123123, next);
            if (next) {
              this.getNodes(Store.get('nodes'), next);
              this.getLines(next);
            }
          } else {
            this.nodes.splice(i, 1);
          }
        }
      }
      this.animate();
    });
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
