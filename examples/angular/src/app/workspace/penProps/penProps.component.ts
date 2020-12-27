import { Component, OnInit, OnChanges, Input, SimpleChanges, HostListener } from '@angular/core';

import { Topology, Pen, Node, EventType, EventAction, getRect } from '@topology/core';
import { alignNodes, spaceBetween, layout } from '@topology/layout';

import { PenPropsService } from './penProps.service';

@Component({
  selector: 'app-pen-props',
  templateUrl: './penProps.component.html',
  styleUrls: ['./penProps.component.scss'],
  providers: [PenPropsService]
})
export class PenPropsComponent implements OnInit, OnChanges {
  @Input() canvas: Topology;
  @Input() selection: {
    pen?: Pen;
    pens?: Pen[];
  };
  @Input() readonly = false;

  tab = 1;

  pen: any;
  icon: any;
  drowdown = 0;

  tag = '';
  data = '';
  tree: any[] = [];

  fontStyleOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'normal',
        name: '正常'
      },
      {
        id: 'italic',
        name: '倾斜'
      }
    ],
    noDefaultOption: true
  };

  fontWeightOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'normal',
        name: '正常'
      },
      {
        id: 'bold',
        name: '加粗'
      }
    ],
    noDefaultOption: true
  };

  textAlignOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'left',
        name: '左对齐'
      },
      {
        id: 'center',
        name: '居中'
      },
      {
        id: 'right',
        name: '右对齐'
      }
    ],
    noDefaultOption: true
  };

  textBaselineOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'top',
        name: '顶部对齐'
      },
      {
        id: 'middle',
        name: '居中'
      },
      {
        id: 'bottom',
        name: '底部对齐'
      }
    ],
    noDefaultOption: true
  };

  bkTypeOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 0,
        name: '纯色背景'
      },
      {
        id: 1,
        name: '线性渐变'
      },
      {
        id: 2,
        name: '径向渐变'
      }
    ],
    noDefaultOption: true
  };

  playOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 1,
        name: '自动播放'
      },
      {
        id: 2,
        name: '跟随动画播放'
      }
    ]
  };

  cpPresetColors = [
    '#1890ff',
    '#096dd9',
    '#bae7ff',
    '#52c41a',
    '#3fad09',
    '#c6ebb4',
    '#faad14',
    '#d9a116',
    '#fff6dd',
    '#f50000',
    '#ff0000',
    '#ffc2c5',
    '#fa541c',
    '#531dab',
    '#314659',
    '#777777'
  ];

  animateOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'upDown',
        name: '上下跳动'
      },
      {
        id: 'leftRight',
        name: '左右跳动'
      },
      {
        id: 'heart',
        name: '心跳'
      },
      {
        id: 'success',
        name: '成功'
      },
      {
        id: 'warning',
        name: '警告'
      },
      {
        id: 'error',
        name: '错误'
      },
      {
        id: 'show',
        name: '炫耀'
      },
      {
        id: 'custom',
        name: '自定义'
      }
    ]
  };

  lineAnimateOptions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'beads',
        name: '水珠流动'
      },
      {
        id: 'dot',
        name: '圆点'
      },
      {
        id: 'comet',
        name: '彗星'
      }
    ]
  };

  iconAligns = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 'center',
        name: '居中'
      },
      {
        id: 'top',
        name: '上'
      },
      {
        id: 'bottom',
        name: '下'
      },
      {
        id: 'left',
        name: '左'
      },
      {
        id: 'right',
        name: '右'
      },
      {
        id: 'left-top',
        name: '左上'
      },
      {
        id: 'right-top',
        name: '右上'
      },
      {
        id: 'left-bottom',
        name: '左下'
      },
      {
        id: 'right-bottom',
        name: '右下'
      }
    ],
    noDefaultOption: true
  };

  eventTypes = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 0,
        name: '单击'
      },
      {
        id: 1,
        name: '双击'
      },
      {
        id: 2,
        name: 'Websocket事件'
      }
    ],
    noDefaultOption: true
  };

  eventActions = {
    id: 'id',
    name: 'name',
    list: [
      {
        id: 0,
        name: '打开链接'
      },
      {
        id: 1,
        name: '执行动画'
      },
      {
        id: 2,
        name: '执行自定义函数'
      },
      {
        id: 3,
        name: '执行window函数'
      }
    ],
    noDefaultOption: true
  };

  nodesAlgin = [{
    value: 'left',
    desc: '左对齐'
  }, {
    value: 'right',
    desc: '右对齐'
  }, {
    value: 'top',
    desc: '顶部对齐'
  }, {
    value: 'bottom',
    desc: '底部对齐'
  }, {
    value: 'center',
    desc: '垂直居中'
  }, {
    value: 'middle',
    desc: '水平居中'
  }];
  icons: any[] = [];

  layout = {
    maxWidth: 1000,
    nodeWidth: 0,
    nodeHeight: 0,
    maxCount: 0,
    spaceWidth: 30,
    spaceHeight: 30
  };

  customInput: boolean;
  canProps = true;

  objectKeys = Object.keys;

  show: any = {};
  constructor(private service: PenPropsService) {
  }

  ngOnInit() {
    this.show = {};
    if (this.selection.pen) {
      this.pen = this.selection.pen;
      if (typeof this.pen.data === 'object') {
        this.data = JSON.stringify(this.pen.data, null, 2);
      } else {
        this.data = this.pen.data + '';
      }
    } else {
      this.pen = {};
    }

    if (!this.pen.font) {
      this.pen.font = {
        color: '#222',
        fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
        fontSize: 12,
        lineHeight: 1.5,
        fontStyle: 'normal',
        fontWeight: 'normal',
        textAlign: 'center',
        textBaseline: 'middle'
      };
    }
    if (!this.pen.font.fontStyle) {
      this.pen.font.fontStyle = 'normal';
    }
    if (!this.pen.font.fontWeight) {
      this.pen.font.fontWeight = 'normal';
    }

    if (this.pen.icon) {
      if (this.icon) {
        this.icon.checked = false;
      }
      for (const item of this.icons) {
        if (String.fromCharCode(+item.unicode) === this.pen.icon) {
          item.checked = true;
          this.icon = item;
          break;
        }
      }
    } else {
      this.icon = null;
    }

    if (!this.pen.bkType) {
      this.pen.bkType = 0;
    }

    if (!this.pen.imageAlign) {
      this.pen.imageAlign = 'center';
    }

    if (this.pen.data) {
      if (typeof this.pen.data === 'string') {
        try {
          this.data = JSON.parse(JSON.stringify(this.pen.data));
        } catch {
          this.customInput = true;
        }
      }

      if (!Array.isArray(this.pen.data)) {
        this.customInput = true;
        this.canProps = false;
      }
    }

    this.icons = this.service.GetIcons();

    const rect = getRect(this.canvas.activeLayer.pens);
    this.layout.maxWidth = rect.width;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.selection) {
      this.ngOnInit();
    }
  }

  getBackground(color: string) {
    return {
      'background-color': color
    };
  }

  onChangeProp() {
    if (this.selection.pens) {
      for (const item of this.selection.pens) {
        item.dash = this.pen.dash;
        item.strokeStyle = this.pen.strokeStyle;
        item.lineWidth = this.pen.lineWidth;
        item.globalAlpha = this.pen.globalAlpha;
        item.font = Object.assign({}, this.pen.font);
        item.textMaxLine = this.pen.textMaxLine;
        item.textOffsetX = this.pen.textOffsetX;
        item.textOffsetY = this.pen.textOffsetY;
      }
    }

    if (this.selection.pen && this.data) {
      let obj: any;
      try {
        obj = JSON.parse(this.data);
      } catch (e) { }
      if (obj) {
        this.pen.data = obj;
      }
    }
    this.canvas.updateProps();
  }

  onClickName(name: string) {
    this.pen.name = name;
    this.drowdown = 0;
    this.onChangeProp();
  }

  onClickDash(dash: number) {
    this.pen.dash = dash;
    this.drowdown = 0;
    this.onChangeProp();
  }

  onClickFromArrow(arrow: string) {
    this.pen.fromArrow = arrow;
    this.drowdown = 0;
    this.onChangeProp();
  }

  onClickToArrow(arrow: string) {
    this.pen.toArrow = arrow;
    this.drowdown = 0;
    this.onChangeProp();
  }

  @HostListener('document:click', ['$event'])
  onClickDocument() {
    this.drowdown = 0;
  }

  onClickIcon(item?: any) {
    if (this.icon) {
      this.icon.checked = false;
    }

    if (item) {
      item.checked = true;
      this.pen.iconFamily = 'topology';
      this.pen.icon = String.fromCharCode(+item.unicode);
    } else {
      this.pen.icon = '';
    }

    this.icon = item;
    this.onChangeProp();
  }

  onChangeImgWidth() {
    if (this.pen.imageRatio && this.pen.imageWidth > 0) {
      this.pen.imageHeight =
        (this.pen.imgNaturalHeight / this.pen.imgNaturalWidth) * this.pen.imageWidth;
    }

    this.onChangeProp();
  }

  onChangeImgHeight() {
    if (this.pen.imageRatio && this.pen.imageHeight > 0) {
      this.pen.imageWidth =
        (this.pen.imgNaturalWidth / this.pen.imgNaturalHeight) * this.pen.imageHeight;
    }

    this.onChangeProp();
  }

  onChangeImgRatio() {
    if (this.pen.imageRatio && (this.pen.imageWidth || this.pen.imageHeight)) {
      if (this.pen.imageWidth) {
        this.pen.imageHeight =
          (this.pen.imgNaturalHeight / this.pen.imgNaturalWidth) * this.pen.imageWidth;
      } else {
        this.pen.imageWidth =
          (this.pen.imgNaturalWidth / this.pen.imgNaturalHeight) * this.pen.imageHeight;
      }
    }

    this.onChangeProp();
  }

  onAnimate() {
    this.pen.animateStart = this.pen.animateStart ? Date.now() : 0;
    this.canvas.animate();
  }

  onAddFrame() {
    if (!this.pen.animateFrames) {
      this.pen.animateFrames = [];
    }

    this.pen.animateFrames.push({
      duration: 200,
      linear: true,
      state: Node.cloneState(this.pen)
    });

    this.onAnimateDuration();
  }

  onRemoveFrame(i: number) {
    this.pen.animateFrames.splice(i, 1);
    this.onAnimateDuration();
  }

  onFrameUp(i: number) {
    if (i < 1) {
      return;
    }
    const item = this.pen.animateFrames.splice(i, 1);
    this.pen.animateFrames.splice(i - 1, 0, item[0]);
  }

  onFrameDown(i: number) {
    if (i > this.pen.animateFrames.length - 2) {
      return;
    }
    const item = this.pen.animateFrames.splice(i, 1);
    this.pen.animateFrames.splice(i + 1, 0, item[0]);
  }

  onClickAnimateDash(node: Node, dash: number) {
    node.dash = dash;
    this.drowdown = 0;
    this.onAnimate();
  }

  onAnimateDuration() {
    this.pen.animateDuration = 0;
    for (const item of this.pen.animateFrames) {
      this.pen.animateDuration += item.duration;
    }
  }

  onChangeLineAnimate() {
    const animateStart = this.pen.animateStart;
    this.pen.animateStart = 0;
    this.canvas.animate();
    setTimeout(() => {
      if (animateStart) {
        this.pen.animateStart = animateStart;
        this.canvas.animate();
      }
    }, 0);
  }

  onChangeAnimate() {
    if (this.pen.animateType === 'custom') {
      return;
    }

    this.pen.animateFrames = [];
    const state = Node.cloneState(this.pen);
    switch (this.pen.animateType) {
      case 'upDown':
        state.rect.y -= 10;
        state.rect.ey -= 10;
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state
        });
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(this.pen)
        });
        this.pen.animateFrames.push({
          duration: 200,
          linear: true,
          state: Node.cloneState(state)
        });
        break;
      case 'leftRight':
        state.rect.x -= 10;
        state.rect.ex -= 10;
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(state)
        });
        state.rect.x += 20;
        state.rect.ex += 20;
        this.pen.animateFrames.push({
          duration: 80,
          linear: true,
          state: Node.cloneState(state)
        });
        state.rect.x -= 20;
        state.rect.ex -= 20;
        this.pen.animateFrames.push({
          duration: 50,
          linear: true,
          state: Node.cloneState(state)
        });
        state.rect.x += 20;
        state.rect.ex += 20;
        this.pen.animateFrames.push({
          duration: 30,
          linear: true,
          state: Node.cloneState(state)
        });
        this.pen.animateFrames.push({
          duration: 300,
          linear: true,
          state: Node.cloneState(this.pen)
        });
        break;
      case 'heart':
        state.rect.x -= 5;
        state.rect.ex += 5;
        state.rect.y -= 5;
        state.rect.ey += 5;
        state.rect.width += 5;
        state.rect.height += 10;
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state
        });
        this.pen.animateFrames.push({
          duration: 400,
          linear: true,
          state: Node.cloneState(this.pen)
        });
        break;
      case 'success':
        state.strokeStyle = '#237804';
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state
        });
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(this.pen)
        });
        state.strokeStyle = '#237804';
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state
        });
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(this.pen)
        });
        state.strokeStyle = '#237804';
        state.fillStyle = '#389e0d22';
        this.pen.animateFrames.push({
          duration: 3000,
          linear: true,
          state
        });
        break;
      case 'warning':
        state.strokeStyle = '#fa8c16';
        state.dash = 2;
        this.pen.animateFrames.push({
          duration: 300,
          linear: true,
          state
        });
        state.strokeStyle = '#fa8c16';
        state.dash = 0;
        this.pen.animateFrames.push({
          duration: 500,
          linear: true,
          state: Node.cloneState(state)
        });
        state.strokeStyle = '#fa8c16';
        state.dash = 2;
        this.pen.animateFrames.push({
          duration: 300,
          linear: true,
          state: Node.cloneState(state)
        });
        break;
      case 'error':
        state.strokeStyle = '#cf1322';
        state.fillStyle = '#cf132222';
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state
        });
        break;
      case 'show':
        state.strokeStyle = '#fa541c';
        state.rotate = -10;
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(state)
        });
        state.rotate = 10;
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(state)
        });
        state.rotate = 0;
        this.pen.animateFrames.push({
          duration: 100,
          linear: true,
          state: Node.cloneState(state)
        });
        break;
    }

    this.onAnimateDuration();
  }

  onChangeBkType() {
    if (this.pen.bkType === 1) {
      this.pen.strokeStyle = '#52c41aff';
      this.pen.gradientFromColor = this.pen.gradientFromColor || '#c6ebb463';
      this.pen.gradientToColor = this.pen.gradientToColor || '#bae7ff0f';
      this.pen.gradientAngle = this.pen.gradientAngle || 0;
    } else if (this.pen.bkType === 2) {
      this.pen.strokeStyle = '#52c41aff';
      this.pen.gradientFromColor = this.pen.gradientFromColor || '#ffffff00';
      this.pen.gradientToColor = this.pen.gradientToColor || '#c6ebb463';
      this.pen.gradientRadius = this.pen.gradientRadius || 0.01;
    }

    this.onChangeProp();
  }

  onNodesAlign(align: string) {
    alignNodes(this.canvas.activeLayer.pens, this.canvas.activeLayer.rect, align);
    this.canvas.updateProps();
  }

  onSpaceBetween() {
    spaceBetween(this.canvas.activeLayer.pens, this.canvas.activeLayer.rect.width);
    this.canvas.updateProps();
  }

  onLayout() {
    layout(this.canvas.activeLayer.pens, this.layout);
    this.canvas.updateProps();
  }

  onAddEvent() {
    this.pen.events.push({
      type: EventType.Click,
      action: EventAction.Link,
      value: ''
    });
  }

  onSelect(pen: Pen) {
    this.canvas.activeLayer.pens = [pen];
    this.canvas.render();
  }

  onAddProps() {
    if (!this.pen.data) {
      this.pen.data = [];
    }

    this.pen.data.push({
      key: '',
      value: ''
    });
  }

  onCustomInput() {
    if (this.customInput) {
      this.data = JSON.stringify(this.pen.data, null, 2);
    } else {
      try {
        this.data = JSON.parse(JSON.stringify(this.pen.data));
      } catch {
        this.customInput = true;
      }
    }
  }
}
