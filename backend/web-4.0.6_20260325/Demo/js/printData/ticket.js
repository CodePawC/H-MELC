// 窗口加载完成时执行的函数
function getTicketData() {
    // 调用 `draw` 函数并传入菜品数组作为参数
    let dishesArray = [
        {name: '番茄土豆牛腩', price: 68.9, quantity: 1},
        {name: '蛋黄焗茄子', price: 28.9, quantity: 1},
        {name: '番茄鱼', price: 38.9, quantity: 1},
        // 添加更多菜品...
    ];
   return  draw(dishesArray); // 调用draw函数
}

let ctx;

// 绘图函数
function draw(dishes) {
    // 获取id为 'ticket' 的canvas元素
    const canvas = document.getElementById('ticket');
    const marginTop = 30;
    const marginBottom = 60;
    const marginLeft = 20;
    const marginRight = 48;
    let titleFontSize = 48;
    let contentFontSize = 32;
    const headerHeight = 100;
    const bottomHeight = 100;

    canvas.width = 464;
    const labelWidth = canvas.width;
    let totalHeight = 0;

    let ticketData;
    let base64Data = "";
    // 检查canvas是否有getContext方法
    if (canvas.getContext) {
        // 获取2D绘图上下文
        ctx = canvas.getContext('2d');
        const dishBitmapHeight = getDishBitmapHeight(dishes, ctx, labelWidth, contentFontSize, marginRight, marginLeft);
        totalHeight = marginTop + titleFontSize + headerHeight + contentFontSize * 25.6 + dishBitmapHeight + bottomHeight + marginBottom;
        canvas.height = totalHeight;
        console.log('canvas.height', canvas.height);
        // 设置绘制填充颜色为白色
        ctx.fillStyle = 'rgb(255, 255, 255)';
        // 填充矩形区域
        ctx.fillRect(0, 0, labelWidth, totalHeight);
        // 设置绘制填充颜色为黑色
        ctx.fillStyle = 'rgb(0, 0, 0)';
        let y;


        // 设置字体样式
        ctx.font = `${titleFontSize}px Arial`;


        const titleTextMetrics = ctx.measureText('精臣食堂');
        const titleWidth = titleTextMetrics.width;
        y = marginTop + titleFontSize;

        // 绘制文本内容' Hello World '
        ctx.fillText('精臣食堂', (labelWidth - titleWidth) / 2.0, y);


        y += contentFontSize * 1.5;

        ctx.font = `${contentFontSize}px Arial`;
        let contentTextMetrics = ctx.measureText('电话：13555555555');
        let contentTextWidth = contentTextMetrics.width;
        // 绘制文本内容' 电话：13555555555 '
        ctx.fillText('电话：13555555555', (labelWidth - contentTextWidth) / 2.0, y);

        y += contentFontSize * 1.5;
        y += headerHeight;


        const restaurantInfo = [
            '日期：2023-12-21 15:59',
            '区域：大厅',
            '桌位：A04',
            '上座人数：5人',
            '服务员：Steven',
            '订单编号：202312211603'
        ];

        const restaurantInfoLength = restaurantInfo.length;

        for (let i = 0; i < restaurantInfoLength; i++) {
            ctx.fillText(restaurantInfo[i], marginLeft, y);
            y += contentFontSize * 1.5;
        }

        y -= contentFontSize * 0.7;
        drawLine(ctx, marginLeft, y, labelWidth - marginLeft, y);
        y += contentFontSize * 1.5;
        ctx.fillText('菜品', marginLeft, y);
        contentTextMetrics = ctx.measureText('数量');
        contentTextWidth = contentTextMetrics.width;


        ctx.fillText('单价', labelWidth - contentTextWidth - marginRight, y);

        ctx.fillText('数量', labelWidth - (contentTextWidth + marginRight) * 2, y);
        y += contentFontSize * 0.8;
        drawLine(ctx, marginLeft, y, labelWidth - marginLeft, y);
        y += contentFontSize * 1.5;


        const nameMaxWidth = labelWidth - (contentTextWidth + marginRight + marginLeft) * 2;
        let maxWordDisplay = getMaxWordDisplayForSingleLine(ctx, nameMaxWidth, contentFontSize);

        const dishesLength = dishes.length;


        for (let i = 0; i < dishesLength; i++) {
            ctx.fillText('¥' + dishes[i].price, labelWidth - contentTextWidth - marginRight, y);
            ctx.fillText('' + dishes[i].quantity, labelWidth - (contentTextWidth + marginRight) * 2, y);
            let dishName = dishes[i].name;
            let dishShowLine = getShowLine(dishName, maxWordDisplay);
            for (let i = 0; i < dishShowLine; i++) {
                const text = getDisplayTextForLine(dishName, i, dishShowLine, maxWordDisplay);
                ctx.fillText(text, marginLeft, y);
                console.log(`i=${i},${dishShowLine}`);
                y += contentFontSize * 1.5;
            }
        }


        y -= contentFontSize * 0.7;
        drawLine(ctx, marginLeft, y, labelWidth - marginLeft, y);
        y += contentFontSize * 1.5;
        const collectionInfo = [
            {collectionType: '店铺实收', price: 100.0},
            {collectionType: '消费税', price: 10.0},
            {collectionType: '服务费', price: 10.0},
            {collectionType: '折扣', price: 15.0},
        ];
        const collectionInfoLength = collectionInfo.length;

        for (let i = 0; i < collectionInfoLength; i++) {
            ctx.fillText(collectionInfo[i].collectionType, marginLeft, y);
            if (i === collectionInfoLength - 1) {
                ctx.fillText('-¥' + collectionInfo[i].price, labelWidth - contentTextWidth - marginRight, y);
                y += contentFontSize * 0.8;
            } else {
                ctx.fillText('¥' + collectionInfo[i].price, labelWidth - contentTextWidth - marginRight, y);
                y += contentFontSize * 1.5;
            }

        }

        drawLine(ctx, marginLeft, y, labelWidth - marginLeft, y);
        y += contentFontSize * 1.5;
        ctx.fillText('最终实收', marginLeft, y);
        ctx.fillText('¥65.0', labelWidth - contentTextWidth - marginRight, y);

        y += contentFontSize * 1.5;

        y += bottomHeight;

        contentTextMetrics = ctx.measureText('[欢迎再次光临本店]');
        contentTextWidth = contentTextMetrics.width;
        ctx.fillText('[欢迎再次光临本店]', (labelWidth - contentTextWidth) / 2.0, y);

        const dataUrl = canvas.toDataURL("image/png");
        base64Data = dataUrl.split(",")[1];
        console.log(base64Data);


    }
    const  offsetX = 0;
    const  offsetY = 0;
    ticketData = {

        InitDrawingBoardParam: {
            "width": labelWidth/8.0,
            "height": totalHeight/8.0,
            "rotate": 0,
            "path": "ZT001.ttf",
            "verticalShift": 0,
            "HorizontalShift": 0
        },

        "elements": [
            {
                type: 'image',
                json: {
                    "x": offsetX,
                    "y": offsetY,
                    "height": totalHeight/8.0,
                    "width": labelWidth/8.0,
                    "rotate": 0,
                    "imageProcessingType": 0,
                    "imageProcessingValue": 127,
                    "imageData": base64Data
                }
            }

        ]
    };

    return ticketData;


}

/**
 * 获取菜品部分位图高度
 *
 * @param dishes 菜品数组
 * @param labelWidth 标签宽度
 * @param context 上下文对象
 * @param contentFontSize 正文内容字号
 * @param marginRight 右边距
 * @param marginLeft 左边距
 * @return {number} 返回菜品部分位图高度
 */
function getDishBitmapHeight(dishes, context, labelWidth, contentFontSize, marginRight, marginLeft) {
    let contentTextMetrics = context.measureText('单价');
    let contentTextWidth = contentTextMetrics.width;
    const nameMaxWidth = labelWidth - (contentTextWidth + marginRight + marginLeft) * 2;
    let maxWordDisplay = getMaxWordDisplayForSingleLine(context, nameMaxWidth, contentFontSize);
    const dishesLength = dishes.length;

    let maxShowLine = 0;
    for (let i = 0; i < dishesLength; i++) {
        const dishName = dishes[i].name;
        maxShowLine += getShowLine(dishName, maxWordDisplay);
    }

    return (maxShowLine - 1) * contentFontSize * 1.5 + contentFontSize * 0.8;

}

/**
 * 获取指定行的显示文本
 *
 * @param {string} dishName - 菜品名称字符串
 * @param {number} lineIndex - 行索引
 * @param {number} lines - 总行数
 * @param {number} maxWordDisplay - 每行最大显示字节数
 * @return {string} 返回指定行的显示文本
 */
function getDisplayTextForLine(dishName, lineIndex, lines, maxWordDisplay) {
    let text;
    if (lines === 1) {
        text = dishName;
    } else if (lineIndex !== lines - 1 || dishName.length % maxWordDisplay === 0) {
        text = dishName.substring(lineIndex * maxWordDisplay, (lineIndex + 1) * maxWordDisplay);
    } else {
        text = dishName.substring(lineIndex * maxWordDisplay);
    }

    return text;
}

/**
 * 菜品显示行数
 *
 * @param dish 菜品名称
 * @param maxWordDisplay 单行最多可以显示的字数
 * @returns {number} 菜品显示的行数
 */
function getShowLine(dish, maxWordDisplay) {
    let showLine = 1;
    let dishLength = dish.length;
    if (dishLength > maxWordDisplay) {
        console.log(dishLength / maxWordDisplay);
        showLine = dishLength % maxWordDisplay === 0 ? dishLength / maxWordDisplay : Math.ceil(dishLength / maxWordDisplay);
    }

    return showLine;

}


/**
 * 获取当行最多展示的字数
 *
 * @param context 上下文对象
 * @param maxWidth 最大展示宽度
 * @param fontSize 字号
 * @returns {number|number} 单行可展示的最多字数
 */
function getMaxWordDisplayForSingleLine(context, maxWidth, fontSize) {
    let word = '武';
    context.font = `${fontSize}px Arial`;
    let contentTextMetrics = ctx.measureText(word);
    let contentTextWidth = contentTextMetrics.width;
    while (contentTextWidth < maxWidth) {
        word += '武';
        console.log(word);
        contentTextMetrics = ctx.measureText(word);
        contentTextWidth = contentTextMetrics.width;
        console.log(`最大宽度为:${maxWidth},文字宽度为:${contentTextWidth}`)
    }

    return word.length === 1 ? 1 : word.length - 1;

}


/**
 * 绘制直线
 * @param context 绘图上下文对象
 * @param startX 起始点X轴坐标
 * @param startY 起始点Y轴坐标
 * @param endX 结束点X轴坐标
 * @param endY 结束点Y轴坐标
 */
function drawLine(context, startX, startY, endX, endY) {
    context.beginPath(); // 开始一个新的路径
    context.moveTo(startX, startY); // 将画笔移动到指定的坐标
    context.lineTo(endX, endY); // 通过直线连接到指定的坐标
    context.closePath(); // 关闭路径
    context.stroke(); // 绘制路径
}
