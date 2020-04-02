export enum KeyType {
  CtrlOrAlt,
  None,
  Ctrl,
  Shift,
  Alt
}

export interface Options {
  locked ?: number;
  extDpiRatio?: number;
  width?: string | number;
  height?: string | number;
  color?: string;
  activeColor?: string;
  hoverColor?: string;
  dragColor?: string;
  animateColor?: string;
  font?: {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    textAlign?: string;
    textBaseline?: string;
  };
  rotateCursor?: string;
  hideInput?: boolean;
  hideRotateCP?: boolean;
  hideSizeCP?: boolean;
  disableEmptyLine?: boolean;
  disableScale?: boolean;
  playIcon?: string;
  pauseIcon?: string;
  fullScreenIcon?: string;
  loopIcon?: string;
  translateKey?: KeyType;
  scaleKey?: KeyType;
  on?: (event: string, data: any) => void;
}
