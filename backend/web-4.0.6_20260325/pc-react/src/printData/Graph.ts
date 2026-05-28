const offsetX: number = 0;
const offsetY: number = 0;
const width: number = 40;
const height: number = 20;
const rotate: number = 0;
const marginX: number = 2.0;
const marginY: number = 2.0;
const lineWidth: number = 0.5;
//图形打印数据
interface InitDrawingBoardParamType {
  width: number;
  height: number;
  rotate: number;
  path: string;
  verticalShift: number;
  HorizontalShift: number;
}

interface GraphElementType {
  type: 'graph';
  json: {
    x: number;
    y: number;
    height: number;
    width: number;
    rotate: number;
    graphType: number;
    cornerRadius: number;
    lineWidth: number;
    lineType: number;
    dashwidth: number[];
  };
}

interface GraphPrintDataType {
  InitDrawingBoardParam: InitDrawingBoardParamType;
  elements: GraphElementType[];
}

export const graphPrintData: GraphPrintDataType = {
  InitDrawingBoardParam: {
    width: width,
    height: height,
    rotate: rotate,
    path: "ZT001.ttf",
    verticalShift: 0,
    HorizontalShift: 0,
  },

  elements: [
    {
      type: "graph",
      json: {
        x: marginX + offsetX,
        y: marginY + offsetY,
        height: height - marginX * 2,
        width: width - marginY * 2,
        rotate: 0,
        graphType: 3,
        cornerRadius: 0,
        lineWidth: lineWidth,
        lineType: 1,
        dashwidth: [1, 1],
      },
    },
  ],
};
