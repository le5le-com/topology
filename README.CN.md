[English](./README.md) | 简体中文

# Le5le-topology

Le5le-topology 是一个可视化在线绘图工具，使用 Canvas + Typescript。支持 topology, UML、微服务架构、动态流量、SCADA 场景等。

- [→ 在线使用](http://topology.le5le.com) ，网站可能比较慢，个人申请的云服务器带宽仅仅 1M。
- [→ 开发文档](https://le5le-com.github.io/topology/)
- [→ 压缩包下载](https://github.com/le5le-com/topology/releases)

- [→ Vue 入门教程](https://juejin.im/post/5dd73e85518825731c34b2ca)
- [→ React 入门教程](https://juejin.im/post/5dcc074151882559c8061905)
- [→ Es5 ](https://github.com/johnnyhhj/topolofy-es5)

![topology](https://img2018.cnblogs.com/blog/328506/201909/328506-20190904144733715-530893726.png)

# 特性

- 极易扩展 - 程序员可以以中间件方式编写自己的图表。框架实现了拖曳、缩放、旋转、自定义属性等基础操作，开发者只用关心图表绘画实现即可。
- 流畅、高性能 - 使用 canvas 和多个场景离屏，操作过程流畅；完全不用担心 SVG 方式 dom 元素过多，性能高效。
- 动画
- TypeScript

# 源码结构

```
- libs
  |- topology  // topogoly-core库源码
- src  // 官网源码.
- bundle // es5的压缩包和demo
- demo // demo
```

# 快速上手

## typescrypt/es6

```
import { Topology } from 'topology-core';

var canvas = new Topology('topo-dom', options);
canvas.open(data);

```

# es5

```
<script src="/bundle/topology.bundle.js"></script>

var canvas = new Le5leTopology.Topology('topo-canvas', {});
canvas.open(data);

```

# 文档

[Todo]

[→ 中文文档](https://www.yuque.com/alsmile/topology/about)

# 开发

## 编译[在线绘图官网](https://topology.le5le.com) 前端源码

```
$ yarn
$ npm start

# build
$ npm run build

```

## 调试本地开发环境

```
$ yarn

//【注意】 修改host文件，把local.dev.le5le.com代理到127.0.0.1
$ npm run dev
```

## 调试生产环境

```
$ yarn

//【注意】 修改host文件，把local.le5le.com代理到127.0.0.1
$ npm run prod
```

## 编译核心库源码 Topology-core lib

```
[libs/topology#] yarn

# build
[libs/topology#] npm run build

```

## 编译流程图源码 Topology-flow-diagram lib

```
[libs/topology-flow-diagram#] yarn

# build
[libs/topology-flow-diagram#] npm run build

```

# 贡献者

- [Nickbing Lao](https://github.com/giscafer)
- [ivanZzzz](https://github.com/ivan135)
- [johnnyhhj](https://github.com/johnnyhhj)
- [sunnyguohua](https://github.com/sunnyguohua)

# 如何贡献

- PR
- Docs
- Translate
- Share
- Writing (articles, demos, videos and so on)
- Social networks

微信：alsmile123  
邮箱：alsmile123@qq.com

# 核心维护者

- [Alsmile](https://github.com/Alsmile)

# License

MIT © le5le.com
