喜欢，请到这里给我们投一票：https://www.oschina.net/project/top_cn_2019?utm_source=projectdetail 。（开发工具栏，或下滑网页搜索：Topology）

English | [简体中文](./README.CN.md)

# Le5le-topology

Le5le-topology is a diagram visualization framework uses canvas and typescript. Developers are able to build diagram (topology, UML), micro-services architecture, SCADA and so on.

- [→ Online](http://topology.le5le.com) . It is very slow while open the site for my network speed is 1Mb/s.
- [→ Docs](https://le5le-com.github.io/topology/)
- [→ Download](https://github.com/le5le-com/topology/releases)

* [→ Vue Guide](https://juejin.im/post/5dd73e85518825731c34b2ca)
* [→ React Guide](https://juejin.im/post/5dcc074151882559c8061905)
* [→ Es5](https://github.com/johnnyhhj/topolofy-es5)

![topology](https://img2018.cnblogs.com/blog/328506/201909/328506-20190904144733715-530893726.png)

# Why le5le-topology

- Extensible - Developers are able to make own diagrams easily. You just have to focus on your core logic in the framework.
- Fast rendering
- Animate
- TypeScript

# Source

```
- libs
  |- topology  // The topogoly-core lib source.
- src  // The topology.le5le.com source that uses angular.
- bundle
- demo // The demo uses js.
```

# Getting Started

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

# Docs

[Todo]

[→ Chinese docs](https://www.yuque.com/alsmile/topology/about)

# Development

```
$ yarn
$ npm start

# build
$ npm run build

```

## http proxy on localhost

```
# First, set your host: 127.0.0.1 local.dev.le5le.com
$ npm run dev
```

## http proxy on topology.le5le.com

```
# First, set your host: 127.0.0.1 local.le5le.com
$ npm run prod
```

## Topology-core lib

```
[libs/topology#] yarn

# build
[libs/topology#] npm run build

```

## Topology-flow-diagram lib

```
[libs/topology-flow-diagram#] yarn

# build
[libs/topology-flow-diagram#] npm run build

```

## Make your diagrams

[→ Reference](https://github.com/le5le-com/topology/tree/master/libs/topology-flow-diagram/display)

# Contributors

- [Nickbing Lao](https://github.com/giscafer)
- [ivanZzzz](https://github.com/ivan135)
- [johnnyhhj](https://github.com/johnnyhhj)
- [sunnyguohua](https://github.com/sunnyguohua)

# Contributing

- PR
- Docs
- Translate
- Share
- Writing (articles, demos, videos and so on)
- Social networks

Wechat: alsmile123  
Email: alsmile123@qq.com

# Core Maintainers

- [Alsmile](https://github.com/Alsmile)

# License

MIT © le5le.com
