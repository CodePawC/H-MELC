var offsetX = 0;
var offsetY = 0;
var width = 30;
var height = 30;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var qrCodeHeight = height - marginY * 2;
var qrCodeWidth = qrCodeHeight;

//二维码打印数据
export const qrCodePrintData = {
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
      type: "qrCode",
      json: {
        x: marginX + offsetX,
        y: marginY + offsetY,
        height: qrCodeHeight,
        width: qrCodeWidth,
        value: "12345678",
        codeType: 31,
        rotate: 0,
      },
    },
  ],
};

// export default textPrintData;
