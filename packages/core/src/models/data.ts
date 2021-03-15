import { Pen } from './pen';
import { Node } from './node';
import { Line } from './line';
import { Lock } from './status';
import { s8 } from '../utils';
import { Store } from 'le5le-store';

export interface TopologyData {
  pens: Pen[];
  lineName: string;
  fromArrow: string;
  toArrow: string;
  lineWidth?: number;
  scale: number;
  locked: Lock;
  bkImage?: string;
  bkColor?: string;
  grid?: boolean;
  gridColor?: string;
  gridSize?: number;
  rule?: boolean;
  ruleColor?: string;
  websocket?: string;
  mqttUrl?: string;
  mqttOptions?: {
    clientId?: string;
    username?: string;
    password?: string;
  };
  mqttTopics?: string;
  manualCps?: boolean;
  tooltip?: boolean | number;
  socketEvent?: boolean | number;
}

export function createData(json?: any, tid?: string) {
  let data: TopologyData = {
    pens: [],
    lineName: 'curve',
    fromArrow: '',
    toArrow: 'triangleSolid',
    scale: 1,
    locked: Lock.None
  };

  if (typeof json === 'string') {
    json = JSON.parse(json);
  }

  data = Object.assign(data, json);
  data.pens = [];

  if (json) {
    // for old data.
    if (json.nodes) {
      for (const item of json.nodes) {
        item.TID = tid;
        data.pens.push(new Node(item));
      }
      for (const item of json.lines) {
        item.TID = tid;
        data.pens.push(new Line(item));
      }
    }
    // end.

    json.pens && json.pens.forEach((item: any) => {
      tid && (item.TID = tid);
      if (!item.type) {
        data.pens.push(new Node(item));
      } else {
        data.pens.push(new Line(item));
      }
    });
  }

  if (data.mqttOptions) {
    let opts = '';
    if (typeof data.mqttOptions === 'object') {
      opts = JSON.stringify(data.mqttOptions);
    } else {
      opts = data.mqttOptions + '';
    }
    data.mqttOptions = JSON.parse(opts);
  } else {
    data.mqttOptions = { clientId: s8() };
  }

  tid && Store.set(tid + '-topology-data', data);

  return data;
}

export function deepClone(o?: any) {
  if (Array.isArray(o)) {
    const arr = [];
    o.forEach(item => { arr.push(deepClone(item)); });
    return arr;
  } else if (typeof o === 'object') {
    const _o = {};
    for (let key in o) {
      _o[key] = deepClone(o[key]);
    }
    return _o;
  }

  return o;
}
