import { Pen } from './pen';
import { Node } from './node';
import { Line } from './line';
import { Lock } from './status';
import { s8 } from '../utils';
import { EventAction, EventType } from './event';

export class TopologyData {
  pens: Pen[] = [];
  lineName = 'curve';
  fromArrow = '';
  toArrow = 'triangleSolid';
  lineWidth?: number;
  scale = 1;
  locked = Lock.None;
  bkImage: string;
  bkColor: string;
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
  } = {
    clientId: s8(),
  };
  mqttTopics?: string;
  events?: { type: EventType; action: EventAction; value: string; params: string; name?: string }[];
  manualCps?: boolean;
  tooltip?: boolean | number;
  data?: any;
  constructor(json?: any) {
    if (json) {
      this.pens = [];
      for (const item of json.pens) {
        if (item.from) {
          this.pens.push(new Line(item));
        } else {
          this.pens.push(new Node(item));
        }
      }
      this.lineName = json.lineName || 'curve';
      this.fromArrow = json.fromArrow || '';
      this.toArrow = json.toArrow || 'triangleSolid';
      this.scale = json.scale || 1;
      this.locked = json.locked || Lock.None;
      this.bkImage = json.bkImage;
      this.bkColor = json.bkColor;
      this.grid = json.grid;
      this.manualCps = json.manualCps;

      this.websocket = json.websocket;
      this.mqttUrl = json.mqttUrl;
      if (json.mqttOptions) {
        let opts = '';
        if (typeof json.mqttOptions === 'object') {
          opts = JSON.stringify(json.mqttOptions);
        } else {
          opts = json.mqttOptions + '';
        }
        this.mqttOptions = JSON.parse(opts);
      } else {
        this.mqttOptions = { clientId: s8() };
      }
      this.mqttTopics = json.mqttTopics;

      if (typeof json.data === 'object') {
        this.data = JSON.parse(JSON.stringify(json.data));
      } else {
        this.data = json.data || '';
      }

      if (json.events) {
        this.events = json.events;
      }
    }
    if (!this.mqttOptions) {
      this.mqttOptions = { clientId: s8() };
    }
  }
}
