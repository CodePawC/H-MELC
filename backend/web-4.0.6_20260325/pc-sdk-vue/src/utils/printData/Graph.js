var offsetX = 0;
var offsetY = 0;
var width = 40;
var height = 20;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var lineWidth = 0.5;
//图形打印数据
export const graphPrintData = {
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
