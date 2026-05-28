var offsetX = 0;
var offsetY = 0;
var width = 40;
var height = 20;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var lineWidth = 0.4;
var sheetHeight = (height-marginY*2)/3.0;
var titleWidth= width-marginX*2;
var barCodeWidth = width - marginX * 5
var barCodeHeight = sheetHeight*2-marginY;
var fontSize = 3.2;

//文本打印数据
const inspectionTestingPrintData = {

    InitDrawingBoardParam: {
        "width": width,
        "height": height,
        "rotate": rotate,
        "path": "ZT001.ttf",
        "verticalShift": 0,
        "HorizontalShift": 0
    },

    "elements": [
       {
            type: 'text',
            json: {
                "x": marginX + offsetX,
                "y": marginY + offsetY,
                "height": sheetHeight,
                "width": titleWidth,
                "value": "张三 男 57岁 血常规",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize*1.5,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        }, {
            type: 'barCode',
            json: {
                "x": marginX*2.5 + offsetX,
                "y":  marginY*2+sheetHeight+ offsetY,
                "height": barCodeHeight,
                "width": barCodeWidth,
                "value": '164240568968018',
                "codeType": 20,
                "rotate": 0,
                "fontSize": fontSize,
                "textHeight": fontSize,
                "textPosition": 0,
            }
        }
    ]
};

// export default textPrintData;
