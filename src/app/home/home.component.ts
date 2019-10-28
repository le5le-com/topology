import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Clipboard } from 'ts-clipboard';

import { Topology } from 'libs/topology';
import { Options } from 'libs/topology/options';
import { registerNode } from 'libs/topology/middles';
import {
  flowData,
  flowDataAnchors,
  flowDataIconRect,
  flowDataTextRect,
  flowSubprocess,
  flowSubprocessIconRect,
  flowSubprocessTextRect,
  flowDb,
  flowDbIconRect,
  flowDbTextRect,
  flowDocument,
  flowDocumentAnchors,
  flowDocumentIconRect,
  flowDocumentTextRect,
  flowInternalStorage,
  flowInternalStorageIconRect,
  flowInternalStorageTextRect,
  flowExternStorage,
  flowExternStorageAnchors,
  flowExternStorageIconRect,
  flowExternStorageTextRect,
  flowQueue,
  flowQueueIconRect,
  flowQueueTextRect,
  flowManually,
  flowManuallyAnchors,
  flowManuallyIconRect,
  flowManuallyTextRect,
  flowDisplay,
  flowDisplayAnchors,
  flowDisplayIconRect,
  flowDisplayTextRect,
  flowParallel,
  flowParallelAnchors,
  flowComment,
  flowCommentAnchors
} from 'libs/topology-flow-diagram';

import {
  activityFinal,
  activityFinalIconRect,
  activityFinalTextRect,
  swimlaneV,
  swimlaneVIconRect,
  swimlaneVTextRect,
  swimlaneH,
  swimlaneHIconRect,
  swimlaneHTextRect,
  fork,
  forkHAnchors,
  forkIconRect,
  forkTextRect,
  forkVAnchors
} from 'libs/topology-activity-diagram';
import {
  simpleClass,
  simpleClassIconRect,
  simpleClassTextRect,
  interfaceClass,
  interfaceClassIconRect,
  interfaceClassTextRect
} from 'libs/topology-class-diagram';
import {
  lifeline,
  lifelineAnchors,
  lifelineIconRect,
  lifelineTextRect,
  sequenceFocus,
  sequenceFocusAnchors,
  sequenceFocusIconRect,
  sequenceFocusTextRect
} from 'libs/topology-sequence-diagram';

import * as FileSaver from 'file-saver';
import { Store } from 'le5le-store';
import { NoticeService } from 'le5le-components/notice';

import { HomeService, Tools } from './home.service';
import { Props } from './props/props.model';
import { environment } from 'src/environments/environment';
import { CoreService } from '../core/core.service';

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

  subRoute: any;
  constructor(
    private service: HomeService,
    private coreService: CoreService,
    private router: Router,
    private activateRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    this.user = Store.get('user');
    this.subUser = Store.subcribe('user', (user: any) => {
      this.user = user;
      if (this.data && user && this.data.userId !== this.user.id) {
        this.data.shared = false;
        this.data.id = '';
      }
    });

    this.canvasOptions.on = this.onMessage;
    this.subMenu = Store.subcribe('clickMenu', (menu: { event: string; data: any }) => {
      switch (menu.event) {
        case 'new':
          this.onNew();
          break;
        case 'open':
          setTimeout(() => {
            this.selected = null;
          });
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
          this.canvas.lineName = menu.data;
          break;
        case 'fromArrowType':
          this.canvas.fromArrowType = menu.data;
          break;
        case 'toArrowType':
          this.canvas.toArrowType = menu.data;
          break;
        case 'scale':
          this.canvas.scaleTo(menu.data);
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
    });

    this.canvasRegister();
  }

  canvasRegister() {
    registerNode('flowData', flowData, flowDataAnchors, flowDataIconRect, flowDataTextRect);
    registerNode('flowSubprocess', flowSubprocess, null, flowSubprocessIconRect, flowSubprocessTextRect);
    registerNode('flowDb', flowDb, null, flowDbIconRect, flowDbTextRect);
    registerNode('flowDocument', flowDocument, flowDocumentAnchors, flowDocumentIconRect, flowDocumentTextRect);
    registerNode(
      'flowInternalStorage',
      flowInternalStorage,
      null,
      flowInternalStorageIconRect,
      flowInternalStorageTextRect
    );
    registerNode(
      'flowExternStorage',
      flowExternStorage,
      flowExternStorageAnchors,
      flowExternStorageIconRect,
      flowExternStorageTextRect
    );
    registerNode('flowQueue', flowQueue, null, flowQueueIconRect, flowQueueTextRect);
    registerNode('flowManually', flowManually, flowManuallyAnchors, flowManuallyIconRect, flowManuallyTextRect);
    registerNode('flowDisplay', flowDisplay, flowDisplayAnchors, flowDisplayIconRect, flowDisplayTextRect);
    registerNode('flowParallel', flowParallel, flowParallelAnchors, null, null);
    registerNode('flowComment', flowComment, flowCommentAnchors, null, null);

    // activity
    registerNode('activityFinal', activityFinal, null, activityFinalIconRect, activityFinalTextRect);
    registerNode('swimlaneV', swimlaneV, null, swimlaneVIconRect, swimlaneVTextRect);
    registerNode('swimlaneH', swimlaneH, null, swimlaneHIconRect, swimlaneHTextRect);
    registerNode('forkH', fork, forkHAnchors, forkIconRect, forkTextRect);
    registerNode('forkV', fork, forkVAnchors, forkIconRect, forkTextRect);

    // class
    registerNode('simpleClass', simpleClass, null, simpleClassIconRect, simpleClassTextRect);
    registerNode('interfaceClass', interfaceClass, null, interfaceClassIconRect, interfaceClassTextRect);

    // sequence
    registerNode('lifeline', lifeline, lifelineAnchors, lifelineIconRect, lifelineTextRect);
    registerNode('sequenceFocus', sequenceFocus, sequenceFocusAnchors, sequenceFocusIconRect, sequenceFocusTextRect);
  }

  onDrag(event: DragEvent, node: any) {
    event.dataTransfer.setData('Text', JSON.stringify(node.data));
  }

  onTouchstart(item: any) {
    this.canvas.touchedNode = item.data;
  }

  onkeyDocument(key: KeyboardEvent) {
    if (key.target !== this.canvas.hoverLayer.canvas) {
      return;
    }

    switch (key.keyCode) {
      case 88:
        if (key.ctrlKey) {
          this.onCut();
        }
        break;
      case 67:
        if (key.ctrlKey) {
          this.onCopy();
        }
        break;
      case 86:
        if (key.ctrlKey) {
          this.onParse();
        }
        break;
      case 89:
        if (key.ctrlKey) {
          this.canvas.redo();
        }
        break;
      case 90:
        if (key.ctrlKey) {
          if (key.shiftKey) {
            this.canvas.redo();
          } else {
            this.canvas.undo();
          }
        }
        break;
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
    this.canvas.open(ret.data);

    Store.set('file', this.data);

    this.animateDemo();
  }

  animateDemo() {
    if (this.data.name === 'cube-demo') {
      const d = this.canvas.data();
      const n = Date.now();
      for (const item of d.nodes) {
        if (item.tags.indexOf('1') > -1) {
          item.animateStart = n;
        }
      }
      this.canvas.animate();
    }
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
    this.data.data = this.canvas.data();
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
          fileId: this.data.fileId || '',
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
    const data = this.canvas.data();
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
        this.selNodes = [data];
        this.selected = {
          type: event,
          data
        };
        break;
      case 'line':
        this.selected = {
          type: event,
          data
        };
        break;
      case 'multi':
        if (data.nodes && data.nodes.length) {
          this.selNodes = data.nodes;
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
  };

  onChangeProps(props: any) {
    if (this.canvas.locked) {
      return;
    }
    switch (props.type) {
      case 'node':
        this.canvas.updateProps([props.data], null, props.data);
        break;
      case 'line':
        this.canvas.updateProps(null, [props.data], props.data);
        break;
      case 'multi':
        this.canvas.updateProps(props.data.nodes, props.data.lines, props.data);
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

    if (event.clientY + 300 < document.body.clientHeight) {
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

  onTop() {
    if (!this.selNodes) {
      return;
    }
    for (const item of this.selNodes) {
      this.canvas.top(item);
    }
    this.canvas.render();
  }

  onBottom() {
    if (!this.selNodes) {
      return;
    }
    for (const item of this.selNodes) {
      this.canvas.bottom(item);
    }
    this.canvas.render();
  }

  onCombine() {
    if (!this.selNodes || this.selNodes.length < 2) {
      return;
    }

    this.canvas.combine(this.selNodes);
    this.canvas.render();
  }

  onUncombine() {
    if (!this.selNodes || this.selNodes.length > 1) {
      return;
    }
    this.canvas.uncombine(this.selNodes[0]);
    this.canvas.render();
  }

  onDel() {
    this.canvas.delete();
  }

  onCopyImage() {
    if (!this.selNodes || this.selNodes.length > 1 || !this.selNodes[0].image) {
      return;
    }

    Clipboard.copy(this.selNodes[0].image);
    const _noticeService: NoticeService = new NoticeService();
    _noticeService.notice({
      body: `图片地址已复制：
${this.selNodes[0].image}`,
      theme: 'success'
    });
  }

  toSVG() {
    const ctx = new C2S(this.canvas.canvas.width + 200, this.canvas.canvas.height + 200);
    for (const item of this.canvas.nodes) {
      item.render(ctx);
    }

    for (const item of this.canvas.lines) {
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
    this.subMenu.unsubscribe();
    this.subUser.unsubscribe();
    this.subRoute.unsubscribe();
  }
}
