import { Store } from 'le5le-store';

import { Node } from '../models/node';

export function createDiv(node: Node) {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.outline = 'none';
  div.style.left = '-9999px';
  div.style.bottom = '-9999px';
  div.style.width = node.rect.width + 'px';
  div.style.height = node.rect.height + 'px';
  if (node.elementId) {
    div.id = node.elementId;
  }

  return div;
}

export function loadJS(url: string, callback?: () => void, render?: boolean) {
  const loaderScript = document.createElement('script');
  loaderScript.type = 'text/javascript';
  loaderScript.src = url;
  loaderScript.addEventListener('load', () => {
    if (callback) {
      callback();
    }
    // how to do
    if (render) {
      Store.set('LT:render', true);
    }
  });

  document.body.appendChild(loaderScript);
}
