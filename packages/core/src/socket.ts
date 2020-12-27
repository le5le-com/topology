import { Store } from 'le5le-store';
import { EventAction, EventType, TopologyData } from './models';
import { Pen, PenType } from './models/pen';
import { Node } from './models/node';
import { find } from './utils/canvas';

export class Socket {
  socket: WebSocket;
  fns: any = {};
  constructor(public url: string, public data: TopologyData) {
    this.init();
  }

  init() {
    this.socket = new WebSocket(this.url);
    this.socket.onmessage = this.onmessage;

    this.socket.onclose = () => {
      console.log('Canvas websocket closed and reconneting...');
      this.init();
    };
  }

  onmessage = (e: MessageEvent) => {
    if (!this.data.pens.length || !e || !e.data) {
      return;
    }

    let msg: { event: string; data: any };
    try {
      msg = JSON.parse(e.data);
    } catch (error) {
      msg = e.data;
    }

    if (this.data.events) {
      this.data.events.forEach((event, index) => {
        if (event.type === EventType.WebSocket) {
          if (event.name && event.name === msg.event) {
            this.topologyMqtt(index, event, msg.data, this.socket);
          } else if (!event.name && msg) {
            this.topologyMqtt(index, event, msg, this.socket);
          }
        }
      });
    }

    this.pensMqtt(this.data.pens, msg);
  };

  pensMqtt(pens: Pen[], msg: any) {
    if (!pens) {
      return;
    }

    for (const item of pens) {
      for (const event of item.events) {
        if (event.type === EventType.WebSocket) {
          if (event.name && event.name === msg.event) {
            item.doSocketMqtt(event, msg.data, this.socket);
          } else if (!event.name && msg) {
            item.doSocketMqtt(event, msg, this.socket);
          }
        }
      }

      if (item.type === PenType.Node) {
        this.pensMqtt((item as Node).children, msg);
      }
    }
  }

  topologyMqtt(
    index: number,
    item: { type: EventType; action: EventAction; value: string; params: string; name?: string },
    msg: any,
    client: any
  ) {
    if (item.action === EventAction.Function) {
      this.doFn(index, item.value, msg || item.params, client);
    } else if (item.action === EventAction.WindowFn) {
      (window as any)[item.value](msg || item.params, client);
    } else if (item.action === EventAction.SetProps) {
      let props: any[] = [];
      let data = msg;
      if (typeof msg === 'string') {
        try {
          data = JSON.parse(msg);
        } catch (error) {}
      }
      if (Array.isArray(data)) {
        props = data;
      }

      for (const prop of props) {
        if (prop.id && prop.key) {
          const pen = find(prop.id, this.data.pens);
          if (!pen) {
            continue;
          }

          const keys = prop.key.split('.');

          if (typeof prop.value === 'object') {
            if (keys[1]) {
              pen[keys[0]][keys[1]] = Object.assign(pen[prop.key], prop.value);
            } else {
              pen[keys[0]] = Object.assign(pen[prop.key], prop.value);
            }
          } else {
            if (keys[1]) {
              pen[keys[0]][keys[1]] = prop.value;
            } else {
              pen[keys[0]] = prop.value;
            }
          }
        }
      }

      if (item.params || item.params === undefined) {
        Store.set('LT:render', true);
      }
    }
  }

  private doFn(index: number, fn: string, params: string, client?: any) {
    let func: Function = this.fns[index];
    if (!func) {
      if (client) {
        func = new Function('pen', 'params', 'client', fn);
      } else {
        func = new Function('pen', 'params', fn);
      }

      this.fns[index] = func;
    }

    func(params, client);
  }

  close() {
    this.socket.onclose = null;
    this.socket.close();
  }
}
