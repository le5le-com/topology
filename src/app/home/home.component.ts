import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Topology } from 'topology-core';
import { Options } from 'topology-core/options';


import * as FileSaver from 'file-saver';
import { Store } from 'le5le-store';
import { NoticeService } from 'le5le-components/notice';

import { HomeService } from './home.service';
import { Props } from './props/props.model';
import { environment } from 'src/environments/environment';
import { CoreService } from '../core/core.service';
import { TopologyService } from './topology.service';
import { Tools } from './tools/config';

declare var C2S: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['./home.component.scss'],
  providers: [HomeService],
  // tslint:disable-next-line:use-host-property-decorator
  host: {
    '(document:keydown)': 'onkeyDocument($event)',
    '(document:click)': 'onClickDocument($event)'
  }
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('workspace', { static: true }) workspace: ElementRef;
  tools: any[] = Tools;
  canvas: Topology;
  canvasOptions: Options = {};
  selected: Props;
  subMenu: any;

  data = {
    id: '',
    fileId: '',
    data: { nodes: [], lines: [] },
    name: '',
    desc: '',
    image: '',
    userId: '',
    shared: false
  };
  icons: { icon: string; iconFamily: string }[] = [];
  readonly = false;

  user: any;
  subUser: any;

  mouseMoving = false;

  contextmenu: any;
  selNodes: any;
  locked = false;

  divNode: any;

  subRoute: any;
  constructor(
    private service: HomeService,
    private topologySrv: TopologyService,
    private coreService: CoreService,
    private router: Router,
    private activateRoute: ActivatedRoute
  ) { }

  ngOnInit() {
    this.user = Store.get('user');
    this.subUser = Store.subscribe('user', (user: any) => {
      this.user = user;
      if (this.data && user && this.data.userId !== this.user.id) {
        this.data.shared = false;
        this.data.id = '';
      }
    });

    this.canvasOptions.on = this.onMessage;
    this.subMenu = Store.subscribe('clickMenu', (menu: { event: string; data: any }) => {
      switch (menu.event) {
        case 'new':
          this.onNew();
          break;
        case 'open':
          setTimeout(() => {
            this.selected = null;
          });
          if (!this.data.id) {
            this.onNew();
          }
          this.onOpenLocal();
          break;
        case 'save':
          this.save();
          break;
        case 'saveAs':
          this.data.id = '';
          this.save();
          break;
        case 'down':
          this.onSaveLocal();
          break;
        case 'downPng':
          this.onSavePng(menu.data);
          break;
        case 'downSvg':
          this.toSVG();
          break;
        case 'undo':
          this.canvas.undo();
          break;
        case 'redo':
          this.canvas.redo();
          break;
        case 'cut':
          this.canvas.cut();
          break;
        case 'copy':
          this.canvas.copy();
          break;
        case 'parse':
          this.canvas.parse();
          break;
        case 'filename':
          this.onSaveFilename(menu.data);
          break;
        case 'share':
          this.onShare();
          break;
        case 'lock':
          this.readonly = menu.data;
          this.canvas.lock(menu.data);
          break;
        case 'lineName':
          this.canvas.data.lineName = menu.data;
          break;
        case 'fromArrowType':
          this.canvas.data.fromArrowType = menu.data;
          break;
        case 'toArrowType':
          this.canvas.data.toArrowType = menu.data;
          break;
        case 'scale':
          this.canvas.scaleTo(menu.data);
          break;
        case 'fullscreen':
          this.workspace.nativeElement.requestFullscreen();
          setTimeout(() => {
            this.canvas.resize();
            this.canvas.overflow();
          }, 500);
          break;
      }
    });

    // Wait for parent dom render.
    setTimeout(() => {
      this.canvas = new Topology(this.workspace.nativeElement, this.canvasOptions);
      this.subRoute = this.activateRoute.queryParamMap.subscribe(params => {
        if (params.get('id')) {
          this.onOpen({ id: params.get('id'), fileId: params.get('fileId') });
        } else {
          this.data = {
            id: '',
            fileId: '',
            data: { nodes: [], lines: [] },
            name: '',
            desc: '',
            image: '',
            userId: '',
            shared: false
          };
        }
      });
      // For debug
      (window as any).canvas = this.canvas;
      // End
    });

    this.topologySrv.canvasRegister();
  }

  onDrag(event: DragEvent, node: any) {
    event.dataTransfer.setData('Text', JSON.stringify(node.data));
  }

  onTouchstart(item: any) {
    this.canvas.touchedNode = item.data;
  }

  onkeyDocument(key: KeyboardEvent) {
    switch (key.keyCode) {
      case 79:
        if (key.ctrlKey) {
          setTimeout(() => {
            this.selected = null;
          });
          if (!this.data.id) {
            this.onNew();
          }
          this.onOpenLocal();
        }
        break;
      case 73:
        if (key.ctrlKey) {
          setTimeout(() => {
            this.selected = null;
          });
          this.onOpenLocal();
        }
        break;
      case 83:
        if (key.ctrlKey) {
          if (key.shiftKey) {
            this.data.id = '';
            this.save();
          } else if (key.altKey) {
            this.onSaveLocal();
          } else {
            this.save();
          }
        }
        break;
      case 88:
        if (key.ctrlKey && key.target === this.canvas.divLayer.canvas) {
          this.onCut();
        }
        break;
      case 67:
        if (key.ctrlKey && key.target === this.canvas.divLayer.canvas) {
          this.onCopy();
        }
        break;
      case 86:
        if (key.ctrlKey && key.target === this.canvas.divLayer.canvas) {
          this.onParse();
        }
        break;
      case 89:
        if (key.ctrlKey && key.target === this.canvas.divLayer.canvas) {
          this.canvas.redo();
        }
        break;
      case 90:
        if (key.ctrlKey && key.target === this.canvas.divLayer.canvas) {
          if (key.shiftKey) {
            this.canvas.redo();
          } else {
            this.canvas.undo();
          }
        }
        break;
    }

    if (key.ctrlKey && key.keyCode === 83) {
      key.preventDefault();
      key.returnValue = false;
      return false;
    }
  }

  onNew() {
    this.data = {
      id: '',
      fileId: '',
      data: { nodes: [], lines: [] },
      name: '',
      desc: '',
      image: '',
      userId: '',
      shared: false
    };
    Store.set('file', this.data);
    this.canvas.open(this.data.data);
  }

  async onOpen(data: { id: string; fileId?: string }) {
    const ret = await this.service.Get(data);
    if (!ret) {
      this.router.navigateByUrl('/workspace');
      return;
    }
    Store.set('recently', {
      id: ret.id,
      fileId: ret.fileId || '',
      image: ret.image,
      name: ret.name,
      desc: ret.desc
    });

    if (this.user && ret.userId !== this.user.id) {
      ret.shared = false;
      ret.id = '';
    }
    this.data = ret;
    Store.set('lineName', ret.data.lineName);
    Store.set('fromArrowType', ret.data.fromArrowType);
    Store.set('toArrowType', ret.data.toArrowType);
    Store.set('scale', ret.data.scale);
    Store.set('locked', ret.data.locked);
    this.canvas.open(ret.data);

    Store.set('file', this.data);

    this.animate();
  }

  animate() {
    const n = Date.now();
    for (const item of this.canvas.data.nodes) {
      if (item.animatePlay) {
        item.animateStart = n;
      }
    }
    this.canvas.animate();
  }

  onOpenLocal() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = event => {
      const elem: any = event.srcElement || event.target;
      if (elem.files && elem.files[0]) {
        const name = elem.files[0].name.replace('.json', '');
        this.data.name = name;
        Store.set('file', this.data);
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const text = e.target.result + '';
          try {
            const data = JSON.parse(text);
            if (data && Array.isArray(data.nodes) && Array.isArray(data.lines)) {
              Store.set('lineName', data.lineName);
              Store.set('fromArrowType', data.fromArrowType);
              Store.set('toArrowType', data.toArrowType);
              this.data = {
                id: '',
                fileId: '',
                data,
                name: name,
                desc: '',
                image: '',
                userId: '',
                shared: false
              };
              this.canvas.open(data);
            }
          } catch (e) {
            return false;
          }
        };
        reader.readAsText(elem.files[0]);
      }
    };
    input.click();
  }

  save() {
    this.data.data = this.canvas.data;
    this.canvas.toImage(null, null, async blob => {
      if (this.data.id && !this.coreService.isVip(this.user)) {
        if (!(await this.service.DelImage(this.data.image))) {
          return;
        }
      }

      const file = await this.service.Upload(blob, this.data.shared);
      if (!file) {
        return;
      }
      this.data.image = file.url;
      const ret = await this.service.Save(this.data);
      if (ret) {
        this.data.id = ret.id;
        Store.set('file', this.data);
        const _noticeService: NoticeService = new NoticeService();
        _noticeService.notice({
          body: '保存成功！',
          theme: 'success'
        });

        Store.set('recently', {
          id: this.data.id,
          image: this.data.image,
          name: this.data.name,
          desc: this.data.desc
        });

        this.router.navigate(['/workspace'], { queryParams: { id: this.data.id } });
      }
    });
  }

  async onSaveFilename(filename: string) {
    this.data.name = filename;
    Store.set('file', this.data);

    if (this.data.id) {
      if (
        !(await this.service.Patch({
          id: this.data.id,
          name: filename
        }))
      ) {
        return;
      }

      Store.set('recently', {
        id: this.data.id,
        fileId: this.data.fileId || '',
        image: this.data.image,
        name: filename
      });
    }
  }

  onSaveLocal() {
    const data = this.canvas.data;
    FileSaver.saveAs(
      new Blob([JSON.stringify(data)], { type: 'text/plain;charset=utf-8' }),
      `${this.data.name || 'le5le.topology'}.json`
    );
  }

  onSavePng(options?: { type?: string; quality?: any; ext?: string }) {
    if (!options) {
      options = {};
    }
    const name = this.data.name + (options.ext || '.png');
    this.canvas.saveAsImage(name, options.type, options.quality);
  }

  async onShare() {
    if (!this.data.id) {
      return;
    }

    if (
      !(await this.service.Patch({
        id: this.data.id,
        image: this.data.image,
        shared: !this.data.shared
      }))
    ) {
      return;
    }

    this.data.shared = !this.data.shared;
    Store.set('file', this.data);
  }

  onCut() {
    this.canvas.cut();
  }
  onCopy() {
    this.canvas.copy();
  }
  onParse() {
    this.canvas.parse();
  }

  onMessage = (event: string, data: any) => {
    switch (event) {
      case 'node':
      case 'addNode':
        this.selNodes = [data];
        this.selected = {
          type: 'node',
          data
        };
        this.locked = data.locked;
        this.readonly = this.locked;
        break;
      case 'line':
      case 'addLine':
        this.selected = {
          type: 'line',
          data
        };
        this.locked = data.locked;
        this.readonly = this.locked;
        break;
      case 'multi':
        this.locked = true;
        if (data.nodes && data.nodes.length) {
          this.selNodes = data.nodes;
          for (const item of data.nodes) {
            if (!item.locked) {
              this.locked = false;
              break;
            }
          }
        }
        if (this.locked && data.lines) {
          for (const item of data.lines) {
            if (!item.locked) {
              this.locked = false;
              break;
            }
          }
        }
        this.selected = {
          type: event,
          data
        };
        break;
      case 'space':
        setTimeout(() => {
          this.selected = null;
          this.selNodes = null;
        });
        break;
      case 'moveOut':
        this.workspace.nativeElement.scrollLeft += 10;
        this.workspace.nativeElement.scrollTop += 10;
        break;
      case 'resize':
        if (!this.mouseMoving) {
          this.mouseMoving = true;
          this.workspace.nativeElement.scrollLeft = this.workspace.nativeElement.scrollWidth;
          this.workspace.nativeElement.scrollTop = this.workspace.nativeElement.scrollHeight;
          setTimeout(() => {
            this.mouseMoving = false;
          }, 2000);
        }

        break;
      case 'scale':
        Store.set('scale', data);
        break;
      case 'locked':
        Store.set('locked', data);
        break;
    }
    // console.log('onMessage:', event, data, this.selected);
  }

  onChangeProps(props: any) {
    if (this.canvas.data.locked) {
      return;
    }
    switch (props.type) {
      case 'node':
      case 'addNode':
        this.canvas.updateProps(props.data);
        break;
      case 'line':
      case 'addLine':
        this.canvas.updateProps();
        break;
      case 'multi':
        this.canvas.alignNodes(props.align);
        break;
    }
  }

  onAnimateChange() {
    this.canvas.animate();
  }

  onSignup() {
    location.href = `${environment.urls.account}?signup=true`;
  }

  onLogin() {
    location.href = environment.urls.account;
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.clientY + 360 < document.body.clientHeight) {
      this.contextmenu = {
        left: event.clientX + 'px',
        top: event.clientY + 'px'
      };
    } else {
      this.contextmenu = {
        left: event.clientX + 'px',
        bottom: document.body.clientHeight - event.clientY + 'px'
      };
    }
  }

  onClickDocument(event: MouseEvent) {
    this.contextmenu = null;
  }

  toSVG() {
    const ctx = new C2S(this.canvas.canvas.width + 200, this.canvas.canvas.height + 200);
    for (const item of this.canvas.data.nodes) {
      item.render(ctx);
    }

    for (const item of this.canvas.data.lines) {
      item.render(ctx);
    }

    let mySerializedSVG = ctx.getSerializedSvg();
    mySerializedSVG = mySerializedSVG.replace(
      '<defs/>',
      `<defs>
    <style type="text/css">
      @font-face {
        font-family: 'topology';
        src: url('http://at.alicdn.com/t/font_1331132_h688rvffmbc.ttf?t=1569311680797') format('truetype');
      }
    </style>
  </defs>`
    );

    mySerializedSVG = mySerializedSVG.replace(/--le5le--/g, '&#x');

    const urlObject: any = window.URL || window;
    const export_blob = new Blob([mySerializedSVG]);
    const url = urlObject.createObjectURL(export_blob);

    const a = document.createElement('a');
    a.setAttribute('download', this.data.name + '.svg');
    a.setAttribute('href', url);
    const evt = document.createEvent('MouseEvents');
    evt.initEvent('click', true, true);
    a.dispatchEvent(evt);
  }

  ngOnDestroy() {
    (window as any).canvas = null;
    this.subMenu.unsubscribe();
    this.subUser.unsubscribe();
    this.subRoute.unsubscribe();
    this.canvas.destroy();
  }
}
