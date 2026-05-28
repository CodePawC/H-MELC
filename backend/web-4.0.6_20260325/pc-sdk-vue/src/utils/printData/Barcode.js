var offsetX = 0;
var offsetY = 0;
var width = 40;
var height = 20;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var barCodeWidth = width - marginX * 2;
var barCodeHeight = height - marginY * 2;
var fontSize = 3.2;

//文本打印数据
export const barcodePrintData = {
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
      type: "barCode",
      json: {
        x: marginX + offsetX,
        y: marginY + offsetY,
        height: barCodeHeight,
        width: barCodeWidth,
        value: "12345678",
        codeType: 20,
        rotate: 0,
        fontSize: fontSize,
        textHeight: fontSize,
        textPosition: 0,
      },
    },
  ],
};
