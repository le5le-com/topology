import { Node } from '../../models/node';
import { Point } from '../../models/point';

export function graffiti(ctx: CanvasRenderingContext2D, node: Node) {
  if (!node.rect) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(node.rect.x, node.rect.y);
  node.points.forEach((pt: Point) => {
    ctx.lineTo(pt.x, pt.y);
  });
  node['closePath'] && !node['doing'] && ctx.closePath();
  (node.fillStyle || node.bkType) && ctx.fill();
  ctx.stroke();
}

