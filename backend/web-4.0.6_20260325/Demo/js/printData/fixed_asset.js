var offsetX = 0;
var offsetY = 0;
var width = 50;
var height = 30;
var rotate = 0;
var marginX = 2.0;
var marginY = 2.0;
var sheetHeight = (height - marginY * 2) / 5.0;
var lineWidth = 0.4;
var titleWidth = (width - marginY * 2) / 4.0;
var fontSize = 2.3;
var qrCodeWidth = sheetHeight*3-marginX*2;

//文本打印数据
const fixedAssetPrintData = {

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
            type: 'graph',
            json: {
                "x": marginX + offsetX,
                "y": marginY + offsetX,
                "height": height - marginX * 2,
                "width": width - marginY * 2,
                "rotate": 0,
                "graphType": 3,
                "cornerRadius": 0,
                "lineWidth": lineWidth,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },
        {
            type: 'line',
            json: {
                "x": marginX + offsetX,
                "y": marginY + sheetHeight * 2 + offsetX,
                "height": lineWidth,
                "width": width - marginX * 2,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        }
        , {
            type: 'line',
            json: {
                "x": marginX + offsetX,
                "y": marginY + sheetHeight * 3.5 + offsetX,
                "height": lineWidth,
                "width": width - marginX * 2 - sheetHeight * 3,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        }
        ,
        {
            type: 'line',
            json: {
                "x": marginX + titleWidth + offsetX,
                "y": marginY + offsetX,
                "height": height - marginY * 2,
                "width": lineWidth,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        }
        , {
            type: 'line',
            json: {
                "x": width - marginX - sheetHeight * 3 + offsetX,
                "y": marginY + sheetHeight * 2 + offsetX,
                "height": height - marginY * 2 - sheetHeight * 2,
                "width": lineWidth,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        }
        , {
            type: 'text',
            json: {
                "x": marginX + offsetX,
                "y": marginY + offsetY,
                "height": sheetHeight * 2,
                "width": titleWidth,
                "value": "网点名称",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        }, {
            type: 'text',
            json: {
                "x": marginX*1.5 +titleWidth+ offsetX,
                "y": marginY + offsetY,
                "height": sheetHeight * 2,
                "width": width-marginX*3-titleWidth,
                "value": "奉城镇社区事务受理服务中心（居住证分中心）",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        },{
            type: 'text',
            json: {
                "x": marginX + offsetX,
                "y": marginY + sheetHeight * 2 + offsetY,
                "height": sheetHeight * 1.5,
                "width": titleWidth,
                "value": "设备类型",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        }, {
            type: 'text',
            json: {
                "x": marginX*1.5 +titleWidth + offsetX,
                "y": marginY + sheetHeight * 2 + offsetY,
                "height": sheetHeight * 1.5,
                "width": width-marginX*3-titleWidth-sheetHeight*3,
                "value": "身份证识别仪",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        },{
            type: 'text',
            json: {
                "x": marginX + offsetX,
                "y": marginY + sheetHeight * 3.5 + offsetY,
                "height": sheetHeight * 1.5,
                "width": titleWidth,
                "value": "维保编号",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        }, {
            type: 'text',
            json: {
                "x": marginX*1.5 +titleWidth + offsetX,
                "y": marginY + sheetHeight * 3.5 + offsetY,
                "height": sheetHeight * 1.5,
                "width": width-marginX*3-titleWidth-sheetHeight*3,
                "value": "999999",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [false, false, false, false]
            }

        }
        ,{
            type: 'qrCode',
            json: {
                "x": width-sheetHeight*3+ offsetX,
                "y":  marginY*2 +sheetHeight*2+ offsetY,
                "height": qrCodeWidth,
                "width": qrCodeWidth,
                "value": '12345678',
                "codeType": 31,
                "rotate": 0
            }
        }
    ]
};

// export default textPrintData;
