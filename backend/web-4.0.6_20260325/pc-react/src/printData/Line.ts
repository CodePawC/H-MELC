const offsetX = 0;
const offsetY = 0;
const width = 40;
const height = 20;
const rotate = 0;
const marginX = 2.0;
const marginY = 2.0;
const lineWidth = 0.5;


interface LineElementType {
  type: 'line';
  json: {
    x: number;
    y: number;
    height: number;
    width: number;
    rotate: number;
    lineType: number;
    dashwidth: [number, number];
  };
}

interface InitDrawingBoardParamType {
  width: number;
  height: number;
  rotate: number;
  path: string;
  verticalShift: number;
  HorizontalShift: number;
}

interface LinePrintDataType {
  InitDrawingBoardParam: InitDrawingBoardParamType;
  elements: LineElementType[];
}


//线条打印数据
export const linePrintData: LinePrintDataType = {
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
      type: "line",
      json: {
        x: marginX + offsetX,
        y: marginY + offsetY,
        height: lineWidth,
        width: width - marginX * 2,
        rotate: 0,
        lineType: 1,
        dashwidth: [1, 1],
      },
    },
    {
      type: "line",
      json: {
        x: marginX + offsetX,
        y: height - marginY + offsetX,
        height: lineWidth,
        width: width - marginX * 2,
        rotate: 0,
        lineType: 1,
        dashwidth: [1, 1],
      },
    },
    {
      type: "line",
      json: {
        x: marginX + offsetX,
        y: marginY + offsetX,
        height: height - marginY * 2,
        width: lineWidth,
        rotate: 0,
        lineType: 1,
        dashwidth: [1, 1],
      },
    },
    {
      type: "line",
      json: {
        x: width - marginX + offsetX,
        y: marginY + offsetX,
        height: height - marginY * 2,
        width: lineWidth,
        rotate: 0,
        lineType: 1,
        dashwidth: [1, 1],
      },
    },
  ],
};
