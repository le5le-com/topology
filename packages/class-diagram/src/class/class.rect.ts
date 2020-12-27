import { Node, Rect } from '@topology/core';

export function simpleClassIconRect(node: Node) {
  node.iconRect = new Rect(0, 0, 0, 0);
}

export function simpleClassTextRect(node: Node) {
  node.textRect = new Rect(node.rect.x, node.rect.y, node.rect.width, 40);
  node.fullTextRect = node.textRect;
}

export function interfaceClassIconRect(node: Node) {
  node.iconRect = new Rect(0, 0, 0, 0);
}

export function interfaceClassTextRect(node: Node) {
  node.textRect = new Rect(node.rect.x, node.rect.y, node.rect.width, 40);
  node.fullTextRect = node.textRect;
}
