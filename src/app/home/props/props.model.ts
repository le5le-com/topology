import { Rect } from 'libs/topology/models/rect';
import { Point } from 'libs/topology/models/point';
import { Node } from 'libs/topology/models/node';

export interface Props {
  type: string;
  data?: {
    id?: string;
    name?: string;
    dash: number;
    lineWidth: number;
    strokeStyle: string;
    fillStyle: string;
    globalAlpha: number;
    rotate: number;
    font: {
      color: string;
      fontFamily: string;
      fontSize: number;
      fontStyle: string;
      fontWeight: string;
      lineHeight: number;
      textAlign: CanvasTextAlign;
      textBaseline: CanvasTextBaseline;
    };
    animateStart?: number;
    animateCycle: number;
    animateColor: string;
    animateSpan: number;
    animateType?: string;
    animateDuration?: number;
    animateFrames?: {
      duration: number;
      linear: boolean;
      state: Node;
    }[];
    nextAnimate?: string;
    tags: string[];
    data?: any;

    // Node
    rect?: Rect;
    is3D?: boolean;
    z?: number;
    zRotate?: number;
    borderRadius?: number;
    icon?: string;
    iconFamily?: string;
    iconSize?: number;
    iconColor?: string;
    image?: string;
    imgNaturalWidth?: number;
    imgNaturalHeight?: number;
    imageWidth?: number;
    imageHeight?: number;
    imageRatio?: boolean;
    text?: string;
    textMaxLine?: number;
    // End

    // Line
    from?: Point;
    to?: Point;
    fromArrow?: string;
    toArrow?: string;
    // End

    dirty?: boolean;
  };
}
