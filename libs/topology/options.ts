export interface Options {
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
  hideControlPoints?: boolean;
  disableEmptyLine?: boolean;
  playIcon?: string;
  pauseIcon?: string;
  fullScreenIcon?: string;
  loopIcon?: string;
  on?: (event: string, data: any) => void;
}
