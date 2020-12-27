import { Injectable } from '@angular/core';

import { HttpService } from 'src/app/http/http.service';
import { CoreService } from '../core/core.service';

@Injectable()
export class HomeService {
  constructor(protected http: HttpService, protected coreService: CoreService) { }

  Configs() {
    const configs = {
      bars: [{
        bkColor: 'linear-gradient(90deg,#2f54eb,#1d39c4)',
        styles: null,
        image: '/assets/img/bar1.png',
        title: '高效的绘图工具',
        desc: '在线制作、云存储、多端分享，丰富功能、舒适体验\n包含流程图、微服务架构图、拓扑图、SCADA、脑图等多场景支持',
        button: '免费使用',
        url: '',
        router: '/workspace',
      }, {
        bkColor: 'linear-gradient(90deg,#1890ff,#2589ff)',
        styles: null,
        image: '/assets/img/bar2.png',
        title: '丰富的资源图形库',
        desc: '在线系统平台资源库、自定义组件库等多场景支持\n多种行业分类，欢迎大家一起共同创建、共享',
        button: '开始设计',
        url: '',
        router: '/workspace',
      }, {
        bkColor: 'linear-gradient(90deg,#ff5870,#FF5722)',
        styles: null,
        image: '/assets/img/bar3.png',
        title: '开源共享',
        desc: '开源精神，互惠共享\n组件式设计，插件式开发，共同创建一个强大、丰富的图库平台',
        button: '开发文档',
        url: 'https://www.yuque.com/alsmile/topology',
        router: '',
      }],
      classes: [{
        name: '架构图',
        img: 'http://topology.le5le.com/image/topology/thumb_f6f5aef54fadb4d3.png'
      }, {
        name: 'UML图',
        img: 'http://topology.le5le.com/image/topology/thumb_80f5ef23b0fc1355.png'
      }, {
        name: '拓扑图',
        img: 'http://topology.le5le.com/image/topology/thumb_0e71694860744023.png'
      }, {
        name: '物联网',
        img: 'http://topology.le5le.com/image/topology/thumb_6049786837119713.png'
      }, {
        name: '电力',
        img: 'http://topology.le5le.com/image/topology/thumb_66264822c5cf4d3b.png'
      }, {
        name: '水利',
        img: 'http://topology.le5le.com/image/topology/thumb_525583ee263a0552.png'
      }, {
        name: '安防',
        img: 'http://topology.le5le.com/image/topology/thumb_b5a7470ec98316cd.png'
      }, {
        name: '标识',
        img: 'http://topology.le5le.com/image/topology/thumb_9235e2d66589fad5.png'
      }],
      vision: [{
        icon: 'iconfont icon-yangguang',
        name: '开源、可扩展',
        desc: '开源，基于MIT协议。\n支持以组件库的方式扩展，丰富产品功能。\n欢迎任何人扩展定制、并共享。'
      }, {
        icon: 'iconfont icon-paobu',
        name: '流畅、高性能',
        desc: '使用 canvas 和多个场景离屏，操作过程流畅；完全不用担心 SVG 方式 dom 元素过多，性能高效。'
      }, {
        icon: 'iconfont icon-huaxue',
        name: '动画特效',
        desc: '基于帧的节点动画，可以方便的以易于理解的方式，制作自己的节点动画；多种连线动画支持。'
      }, {
        icon: 'iconfont icon-app',
        name: '外部组件支持',
        desc: '以插件的方式开发，支持导入第三方图标库、图形库、视频等外部组件，避免重复造轮子。'
      }]
    };

    for (const item of configs.bars) {
      item.styles = {
        background: item.bkColor
      };
    }
    return configs;
  }

}
