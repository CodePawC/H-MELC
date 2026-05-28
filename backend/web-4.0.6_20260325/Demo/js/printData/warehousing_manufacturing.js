var offsetX = 0;
var offsetY = 0;
var width = 80;
var height = 50;
var rotate = 90;
var marginX = 2.0;
var marginY = 2.0;
var lineWidth = 0.4;
var sheetHeight = (height-marginY*2)/8.0;
var titleWidth= width-marginX*2;
var contentWidth= (width-marginX*2)/4.0;
var barCodeWidth = width - marginX * 5
var barCodeHeight = sheetHeight*3-marginY*2;
var fontSize = 3.2;

//文本打印数据
const warehousingManufacturingPrintData = {

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
        },{
            type: 'text',
            json: {
                "x": marginX + offsetX,
                "y": marginY + offsetY,
                "height": sheetHeight * 2,
                "width": titleWidth,
                "value": "武汉精臣智慧标识科技有限公司",
                "fontFamily": "宋体",
                "rotate": 0,
                "fontSize": fontSize*1.5,
                "textAlignHorizonral": 1,
                "textAlignVertical": 1,
                "letterSpacing": 0.0,
                "lineSpacing": 1.0,
                "lineMode": 6,
                "fontStyle": [true, false, false, false]
            }

        },{
            type: 'text',
            json: {
                "x": marginX + offsetX,
                "y": marginY +sheetHeight*2+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "品名",
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
                "y": marginY +sheetHeight*3+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "生产批次",
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
                "y": marginY+sheetHeight*4 + offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "数量",
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
                "x": marginX +contentWidth+ offsetX,
                "y": marginY +sheetHeight*2+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "珠宝标签",
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
                "x": marginX +contentWidth + offsetX,
                "y": marginY +sheetHeight*3+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "2023B13A",
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
                "x": marginX +contentWidth + offsetX,
                "y": marginY+sheetHeight*4 + offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "100/卷",
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
                "x": marginX +contentWidth*2 + offsetX,
                "y": marginY +sheetHeight*2+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "规格",
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
                "x": marginX+contentWidth*2 + offsetX,
                "y": marginY +sheetHeight*3+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "生产日期",
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
                "x": marginX +contentWidth*2+ offsetX,
                "y": marginY+sheetHeight*4 + offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "检验员",
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
                "x": marginX +contentWidth*3+ offsetX,
                "y": marginY +sheetHeight*2+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "R02T",
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
                "x": marginX+contentWidth*3 + offsetX,
                "y": marginY +sheetHeight*3+ offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "20230706",
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
                "x": marginX+contentWidth*3 + offsetX,
                "y": marginY+sheetHeight*4 + offsetY,
                "height": sheetHeight,
                "width": contentWidth,
                "value": "李四",
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

        },     {
            type: 'line',
            json: {
                "x": marginX + offsetX,
                "y": marginY+sheetHeight*2 + offsetX,
                "height": lineWidth,
                "width": width - marginX * 2,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },   {
            type: 'line',
            json: {
                "x": marginX + offsetX,
                "y": marginY+sheetHeight*3 + offsetX,
                "height": lineWidth,
                "width": width - marginX * 2,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },   {
            type: 'line',
            json: {
                "x": marginX + offsetX,
                "y": marginY+sheetHeight*4 + offsetX,
                "height": lineWidth,
                "width": width - marginX * 2,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },   {
            type: 'line',
            json: {
                "x": marginX + offsetX,
                "y": marginY+sheetHeight*5 + offsetX,
                "height": lineWidth,
                "width": width - marginX * 2,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },   {
            type: 'line',
            json: {
                "x": marginX+contentWidth + offsetX,
                "y": marginY+sheetHeight*2 + offsetX,
                "height":  sheetHeight*3,
                "width": lineWidth,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },   {
            type: 'line',
            json: {
                "x": marginX+contentWidth*2 + offsetX,
                "y": marginY+sheetHeight*2 + offsetX,
                "height":  sheetHeight*3,
                "width": lineWidth,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        },   {
            type: 'line',
            json: {
                "x": marginX+contentWidth*3 + offsetX,
                "y": marginY+sheetHeight*2 + offsetX,
                "height":  sheetHeight*3,
                "width": lineWidth,
                "rotate": 0,
                "lineType": 1,
                "dashwidth": [1, 1],
            }
        }, {
            type: 'barCode',
            json: {
                "x": marginX*2.5 + offsetX,
                "y":  marginY*2+sheetHeight*5  + offsetY,
                "height": barCodeHeight,
                "width": barCodeWidth,
                "value": '202307061021A',
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
