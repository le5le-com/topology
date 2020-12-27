import { Component, Input, OnInit } from '@angular/core';

import { Clipboard } from 'ts-clipboard';
import { NoticeService } from 'le5le-components/notice';

import { Topology, Lock, Pen } from '@topology/core';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss']
})
export class ContextMenuComponent implements OnInit {
  @Input() canvas: Topology;
  @Input() selection: {
    pen?: any;
    pens?: Pen[];
  };
  @Input() locked = false;
  @Input() contextmenu: any;

  constructor() { }

  ngOnInit() {
  }

  onUp() {
    if (!this.selection) {
      return;
    }
    if (this.selection.pen) {
      this.canvas.up(this.selection.pen);
    }
    if (this.selection.pens) {
      for (const item of this.selection.pens) {
        this.canvas.up(item);
      }
    }

    this.canvas.render();
  }

  onTop() {
    if (!this.selection) {
      return;
    }
    if (this.selection.pen) {
      this.canvas.top(this.selection.pen);
    }
    if (this.selection.pens) {
      for (const item of this.selection.pens) {
        this.canvas.top(item);
      }
    }

    this.canvas.render();
  }

  onDown() {
    if (!this.selection) {
      return;
    }
    if (this.selection.pen) {
      this.canvas.down(this.selection.pen);
    }
    if (this.selection.pens) {
      for (const item of this.selection.pens) {
        this.canvas.down(item);
      }
    }

    this.canvas.render();
  }

  onBottom() {
    if (!this.selection) {
      return;
    }
    if (this.selection.pen) {
      this.canvas.bottom(this.selection.pen);
    }
    if (this.selection.pens) {
      for (const item of this.selection.pens) {
        this.canvas.bottom(item);
      }
    }
    this.canvas.render();
  }

  onCombine(stand: boolean = false) {
    if (!this.selection || !this.selection.pens || this.selection.pens.length < 2) {
      return;
    }

    this.canvas.combine(this.selection.pens, stand);
  }

  onUncombine() {
    if (!this.selection || !this.selection.pen || this.selection.pen.type) {
      return;
    }
    this.canvas.uncombine(this.selection.pen);
    this.canvas.render();
  }

  onLock() {
    this.locked = !this.locked;
    if (this.selection.pen) {
      this.canvas.lockPens([this.selection.pen], this.locked ? Lock.Readonly : Lock.None);
    }
    if (this.selection.pens) {
      this.canvas.lockPens(this.selection.pens, this.locked ? Lock.Readonly : Lock.None);
    }

    this.canvas.render(true);
  }

  onDel() {
    this.canvas.delete();
  }

  onCopyImage() {
    if (!this.selection.pen || !this.selection.pen.image) {
      return;
    }

    Clipboard.copy(this.selection.pen.image);
    const _noticeService: NoticeService = new NoticeService();
    _noticeService.notice({
      body: `图片地址已复制：${this.selection.pen.image}`,
      theme: 'success'
    });
  }
}
