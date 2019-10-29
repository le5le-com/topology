import { Node } from '../../models/node';
import { Rect } from '../../models/rect';
import { getLines, getWords } from './text';
import { Store } from 'le5le-store';

const txtMarginTop = 5;
const minSize = 30;

export function imageIconRect(node: Node) {
  let x = node.rect.x;
  let y = node.rect.y;
  let width = node.rect.width;
  if (node.imageWidth) {
    width = node.imageWidth;
    x += (node.rect.width - width) / 2;
  }

  let height = node.rect.height - node.textRect.height - txtMarginTop;
  if (height < minSize) {
    height = minSize;
  }
  const imgHeight = getImgHeight(node);
  if (imgHeight !== minSize) {
    height = imgHeight;
    let txtHeight = node.rect.ey - node.textRect.y;
    if (txtHeight < 0) {
      txtHeight = 0;
    }
    y += (node.rect.height - txtHeight - height) / 2;
  }
  node.iconRect = new Rect(x, y, width, height);
  node.textRect.y = node.iconRect.ey + txtMarginTop;
  node.textRect.ey = node.textRect.y + node.textRect.height;
  node.fullIconRect = node.rect;
}

export function imageTextRect(node: Node) {
  let height = 0;
  const lineHeight = node.font.fontSize * node.font.lineHeight;
  if (node.textMaxLine) {
    height = lineHeight * node.textMaxLine;
  } else {
    const canvas = Store.get('offscreen');
    const lines = getLines(canvas.getContext('2d'), getWords(node.text), node.rect.width);
    height = lineHeight * lines.length;
  }

  let top = node.rect.ey - height;
  const imgHeight = getImgHeight(node);
  if (top - imgHeight - txtMarginTop < node.rect.y) {
    top = node.rect.y + imgHeight + txtMarginTop;
  }
  node.textRect = new Rect(node.rect.x, top, node.rect.width, height);
  node.fullTextRect = node.rect;
}

function getImgHeight(node: Node) {
  let imgHeight = minSize;
  if (node.image) {
    if (node.imageHeight > 0) {
      imgHeight = node.imageHeight;
    }
  } else if (node.icon) {
    if (node.iconSize > 0) {
      imgHeight = node.iconSize;
    }
  }

  return imgHeight;
}
