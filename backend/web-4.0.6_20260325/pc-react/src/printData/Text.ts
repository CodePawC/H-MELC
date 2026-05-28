const offsetX = 0;
const offsetY = -2.0;
const width = 40;
const height = 60;
const rotate = 0;
const marginX = 2.0;
const marginY = 2.0;
const titleFontSize = 5.6;
const titleWidth = width - marginX * 2;
const titleHeight = 7.4;

const sheetHeight = 6.0;

const contentWidth = width - marginX * 3;
const contentHeight = 4.3;
const fontSize = 3.2;

interface InitDrawingBoardParamType {
  width: number;
  height: number;
  rotate: number;
  path: string;
  verticalShift: number;
  HorizontalShift: number;
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
    fontStyle: [boolean, boolean, boolean, boolean];
  };
}



interface TextPrintDataType {
  InitDrawingBoardParam: InitDrawingBoardParamType;
  elements: TextElementType[];
}



//文本打印数据
export const textPrintData: TextPrintDataType = {
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
      type: "text",
      json: {
        x: marginX + offsetX,
        y: marginY * 2 + offsetY,
        height: titleHeight,
        width: titleWidth,
        value: "合格证",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: titleFontSize,
        textAlignHorizonral: 1,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [true, false, false, false],
      },
    },
    {
      type: "text",
      json: {
        x: marginX * 1.5 + offsetX,
        y: marginY * 6.5 + offsetY,
        height: contentHeight,
        width: contentWidth,
        value: "品名：连衣裙",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: fontSize,
        textAlignHorizonral: 0,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false],
      },
    },
    {
      type: "text",
      json: {
        x: marginX * 1.5 + offsetX,
        y: marginY * 6.5 + sheetHeight + offsetY,
        height: contentHeight,
        width: contentWidth,
        value: "货号：L0565",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: fontSize,
        textAlignHorizonral: 0,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false],
      },
    },
    {
      type: "text",
      json: {
        x: marginX * 1.5 + offsetX,
        y: marginY * 6.5 + sheetHeight * 2 + offsetY,
        height: contentHeight,
        width: contentWidth,
        value: "尺码：S（155）",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: fontSize,
        textAlignHorizonral: 0,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false],
      },
    },
    {
      type: "text",
      json: {
        x: marginX * 1.5 + offsetX,
        y: marginY * 6.5 + sheetHeight * 3 + offsetY,
        height: contentHeight,
        width: contentWidth,
        value: "颜色：蓝色",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: fontSize,
        textAlignHorizonral: 0,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false],
      },
    },
    {
      type: "text",
      json: {
        x: marginX * 1.5 + offsetX,
        y: marginY * 6.5 + sheetHeight * 4 + offsetY,
        height: contentHeight,
        width: contentWidth,
        value: "面料：100%聚酯纤维",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: fontSize,
        textAlignHorizonral: 0,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false],
      },
    },
    {
      type: "text",
      json: {
        x: marginX * 1.5 + offsetX,
        y: marginY * 6.5 + sheetHeight * 5 + offsetY,
        height: titleHeight * 2,
        width: contentWidth,
        value: "全国统一价\n¥188",
        fontFamily: "宋体",
        rotate: 0,
        fontSize: titleFontSize,
        textAlignHorizonral: 1,
        textAlignVertical: 1,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false],
      },
    },
  ],
};
