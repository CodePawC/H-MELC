const offsetX = 0;
const offsetY = 0;
const width = 30;
const height = 30;
const rotate = 0;
const marginX = 2.0;
const marginY = 2.0;
const qrCodeHeight = height - marginY * 2;
const qrCodeWidth = qrCodeHeight;

interface QrCodeElementType {
  type: 'qrCode';
  json: {
    x: number;
    y: number;
    height: number;
    width: number;
    value: string;
    codeType: number;
    rotate: number;
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

interface QrCodePrintDataType {
  InitDrawingBoardParam: InitDrawingBoardParamType;
  elements: QrCodeElementType[];
}



//二维码打印数据
export const qrCodePrintData: QrCodePrintDataType = {
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
