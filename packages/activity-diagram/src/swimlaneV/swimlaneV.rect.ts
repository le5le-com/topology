import { Node, Rect } from '@topology/core';

export function swimlaneVIconRect(node: Node) {
  node.iconRect = new Rect(0, 0, 0, 0);
}

export function swimlaneVTextRect(node: Node) {
  node.textRect = new Rect(node.rect.x, node.rect.y, node.rect.width, 40);
  node.fullTextRect = node.textRect;
}
