const offsetX: number = 0;
const offsetY: number = 0;
const width: number = 50;
const height: number = 20;
const rotate: number = 0;
const marginX: number = 2.0;
const marginY: number = 2.0;
const contentWidth: number = width - marginX * 2;
const qrCodeHeight: number = height - marginY * 2;
const qrCodeWidth: number = qrCodeHeight;
const fontSize: number = 3.2;

//组合打印数据
interface InitDrawingBoardParamType {
  width: number;
  height: number;
  rotate: number;
  path: string;
  verticalShift: number;
  HorizontalShift: number;
}

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

interface TextElementType {
  type: 'text';
  json: {
    x: number;
    y: number;
    height: number;
    width: number;
    value: string;
    fontFamily: string;
    rotate: number;
    fontSize: number;
    textAlignHorizonral: number;
    textAlignVertical: number;
    letterSpacing: number;
    lineSpacing: number;
    lineMode: number;
    fontStyle: boolean[];
  };
}

type ElementType = QrCodeElementType | TextElementType;

interface CombinationPrintDataType {
  InitDrawingBoardParam: InitDrawingBoardParamType;
  elements: ElementType[];
}

export const combinationPrintData: CombinationPrintDataType = {
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
    {
      type: "text",
      json: {
        x: marginX * 2 + qrCodeWidth + offsetX,
        y: marginY + offsetY,
        height: qrCodeHeight,
        width: contentWidth - qrCodeWidth - marginX,
        value: "姓名：武汉精臣\n年龄：11\n类型：血液检测",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: fontSize,
        textAlignHorizonral: 0,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [true, false, false, false],
      },
    },
  ],
};
