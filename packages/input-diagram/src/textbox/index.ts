import { s8, Node, createInput, rectangle } from '@topology/core';

// 用来存储 input dom 元素
export const inputObjs: any = {};

export function textbox(ctx: CanvasRenderingContext2D, node: Node) {
  if (node.elementId === undefined || node.elementId === null) {
    node.elementId = s8();
  }

  if (!node.elementLoaded) {
    // 对应 id 配置一个 input 框
    inputObjs[node.id] = {
      input: createInput(node),
    };
    node.elementLoaded = true;

    if (!document.getElementById(node.elementId))
      document.body.appendChild(inputObjs[node.id].input);
    // 添加当前节点到div层
    node.addToDiv();

    node.elementRendered = false;
  }

  if (!node.elementRendered) {
    // 初始化时，等待父div先渲染完成，避免初始图表控件太大。
    setTimeout(() => {
      inputObjs[node.id].input.value = node.text || '';
      inputObjs[node.id].input.oninput = (e: any) => {
        node.text = e.target.value;
      };

      node.elementRendered = true;
    });

    // 节点样式改变时，修改对应值
    if (inputObjs[node.id].input) changeStyle(node.elementId, node);
  }
}
function changeStyle(id: string, node: Node) {
  const input = document.getElementById(id);
  if (input) {
    input.style.backgroundColor = node.fillStyle;
    input.style.fontSize = node.fontSize + 'px';
    input.style.color = node.fontColor;
    input.style.fontFamily = node.fontFamily;
  }
}
