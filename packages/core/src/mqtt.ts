import * as mqtt from './mqtt.min.js';

import { EventAction, EventType, TopologyData } from './models';
import { Pen, PenType } from './models/pen';
import { Node } from './models/node';
import { Store } from 'le5le-store';
import { find } from './utils/index';

export class MQTT {
  client: any;
  fns: any = {};
  constructor(public url: string, public options: any, public topics: string, public data: TopologyData) {
    this.init();
  }

  init() {
    this.client = mqtt.connect(this.url, this.options);
    this.client.on('message', this.onmessage);

    if (this.topics) {
      this.client.subscribe(this.topics.split(','));
    }
  }

  onmessage = (topic: string, message: any) => {
    if (!this.data.pens.length || !topic) {
      return;
    }

    if (this.data.events) {
      this.data.events.forEach((event, index) => {
        if (event.type === EventType.Mqtt) {
          if (event.name && topic.indexOf(event.name) > -1) {
            this.topologyMqtt(index, event, message.toString(), this.client);
          }
        }
      });
    }

    this.pensMqtt(this.data.pens, topic, message);
  };

  pensMqtt(pens: Pen[], topic: string, message: any) {
    if (!pens) {
      return;
    }
    for (const item of pens) {
      for (const event of item.events) {
        if (event.type === EventType.Mqtt) {
          if (event.name && topic.indexOf(event.name) > -1) {
            item.doSocketMqtt(event, message.toString(), this.client);
          }
        }
      }

      if (item.type === PenType.Node) {
        this.pensMqtt((item as Node).children, topic, message);
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

  publish(topic: string, message: string) {
    this.client.publish(topic, message);
  }

  close() {
    this.client.end();
  }
}
