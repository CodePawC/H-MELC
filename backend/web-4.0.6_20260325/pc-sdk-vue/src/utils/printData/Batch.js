var offsetX = 0;
var offsetY = 0;
var width = 50;
var height = 30;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var contentWidth = width - marginX * 2;
var qrCodeHeight = height - marginY * 2;
var qrCodeWidth = height - marginY * 2;
var fontSize = 3.2;

//批量打印数据
export const batchPrintData = {
  data: [
    {
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：12\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：13\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：14\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：15\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：16\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：17\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：18\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：19\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：20\n类型：血液检测",
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
    },
    {
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
            value: "姓名：武汉精臣\n年龄：21\n类型：血液检测",
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
    },
  ],
};

// export default textPrintData;
