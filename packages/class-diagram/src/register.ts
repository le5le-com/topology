import { registerNode } from '@topology/core';
import {
  simpleClass, simpleClassIconRect, simpleClassTextRect,
  interfaceClass, interfaceClassIconRect, interfaceClassTextRect
} from './class';

export function register() {
  registerNode('simpleClass', simpleClass, null, simpleClassIconRect, simpleClassTextRect);
  registerNode('interfaceClass', interfaceClass, null, interfaceClassIconRect, interfaceClassTextRect);
}
