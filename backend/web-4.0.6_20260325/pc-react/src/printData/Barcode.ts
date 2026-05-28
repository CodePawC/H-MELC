const offsetX: number = 0;
const offsetY: number = 0;
const width: number = 40;
const height: number = 20;
const rotate: number = 0;
const marginX: number = 2.0;
const marginY: number = 2.0;
const barCodeWidth: number = width - marginX * 2;
const barCodeHeight: number = height - marginY * 2;
const fontSize: number = 3.2;

//文本打印数据
interface InitDrawingBoardParamType {
  width: number;
  height: number;
  rotate: number;
  path: string;
  verticalShift: number;
  HorizontalShift: number;
}

interface BarcodeElementType {
  type: 'barCode';
  json: {
    x: number;
    y: number;
    height: number;
    width: number;
    value: string;
    codeType: number;
    rotate: number;
    fontSize: number;
    textHeight: number;
    textPosition: number;
  };
}

interface BarcodePrintDataType {
  InitDrawingBoardParam: InitDrawingBoardParamType;
  elements: BarcodeElementType[];
}

export const barcodePrintData: BarcodePrintDataType = {
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
