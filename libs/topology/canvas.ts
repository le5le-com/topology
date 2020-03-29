import { Store } from 'le5le-store';

import { TopologyData } from './models/data';
import { Options } from './options';

export class Canvas {
  static dpiRatio = 0;

  protected data: TopologyData = Store.get('topology-data');
  canvas = document.createElement('canvas');
  width = 0;
  height = 0;
  constructor(public parentElem: HTMLElement, public options: Options = {}) {
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.outline = 'none';

    if (!Canvas.dpiRatio) {
      const ctx = this.canvas.getContext('2d');
      const bsr =
        ctx['webkitBackingStorePixelRatio'] ||
        ctx['mozBackingStorePixelRatio'] ||
        ctx['msBackingStorePixelRatio'] ||
        ctx['oBackingStorePixelRatio'] ||
        ctx['backingStorePixelRatio'] ||
        1;

      if (!options.extDpiRatio && options.extDpiRatio !== 0) {
        options.extDpiRatio = 0.25;
      }

      Canvas.dpiRatio = window.devicePixelRatio / bsr + options.extDpiRatio;
    }
  }

  resize(size?: { width: number; height: number }) {
    if (size) {
      this.width = size.width | 0;
      this.height = size.height | 0;
    } else {
      if (this.options.width && this.options.width !== 'auto') {
        this.width = +this.options.width;
      } else {
        this.width = this.parentElem.clientWidth;
      }
      if (this.options.height && this.options.height !== 'auto') {
        this.height = +this.options.height;
      } else {
        //fix canvas height
        this.height = this.parentElem.clientHeight;
      }
    }

    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = (this.width * Canvas.dpiRatio) | 0;
    this.canvas.height = (this.height * Canvas.dpiRatio) | 0;
    this.canvas.getContext('2d').scale(Canvas.dpiRatio, Canvas.dpiRatio);

    Store.set('LT:size', { width: this.canvas.width, height: this.canvas.height });
  }

  render() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getDpiRatio() {
    return Canvas.dpiRatio;
  }
}
