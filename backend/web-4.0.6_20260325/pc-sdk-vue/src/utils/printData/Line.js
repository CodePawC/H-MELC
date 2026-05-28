var offsetX = 0;
var offsetY = 0;
var width = 40;
var height = 20;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var lineWidth = 0.5;

//文本打印数据
export const linePrintData = {
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
