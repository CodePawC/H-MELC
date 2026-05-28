# 精臣打印机SDK调用示例

精臣打印机SDK Web调用示例工程，展示了如何使用SDK进行各种打印操作，包括文本、二维码、条形码、图形、图片等元素的绘制和打印。本项目提供了完整的调用示例代码和详细的API文档，帮助开发者快速上手集成精臣打印机SDK。

## 项目特点

本项目是一个纯前端Web应用，通过WebSocket与本地打印服务进行通信，实现对精臣打印机的控制。无需复杂的后端配置，开发者只需在浏览器中打开页面即可开始使用。项目采用了模块化的代码组织方式，将API接口定义、调用示例和打印数据分离，便于理解和维护。代码同时支持回调函数和Promise两种调用模式，开发者可以根据项目需求灵活选择。此外，项目还提供了完善的错误处理机制和状态监听功能，确保打印过程的稳定性。

## 功能特性

本项目支持丰富的打印功能，涵盖了日常打印场景的各个方面。文本打印功能支持多种字体样式设置，包括字体大小、颜色、对齐方式和行间距等参数控制。条形码打印支持多种编码格式，如CODE128、UPC-A、UPC-E、EAN8、EAN13等，可满足不同行业的数据标识需求。二维码打印不仅支持普通二维码，还支持带logo的二维码生成，纠错级别可调。图形绘制功能支持圆、椭圆、矩形、圆角矩形等基础图形，以及实线和虚线样式。图片打印支持Base64编码的图片数据导入，并提供图像处理参数调整。组合打印功能允许在同一个标签上混合使用文本、条码、二维码和图形，实现复杂标签的设计。批量打印功能支持多页内容连续打印，每页可设置不同的打印份数。项目还预置了多种常用标签模板，包括固定资产标签、仓储制造标签、检验检测标签和小票模板，开发者可以直接使用或作为参考进行定制开发。

## 目录结构

项目的目录结构清晰明了，便于开发者快速定位所需文件。根目录下包含主页面文件index.html、样式文件index.css以及图片资源目录img。JavaScript代码主要集中在js目录下，其中api子目录存放SDK的API接口定义文件jcPrinterSdk_api_third.js，该文件封装了所有与打印服务通信的底层方法。printData子目录存放各类打印数据定义文件，包括文本打印数据text.js、一维码数据barcode.js、二维码数据qrCode.js、线条数据line.js、图形数据graph.js、图片数据img.js、组合打印数据combination.js、批量打印数据batch.js、固定资产标签数据fixed_asset.js、仓储制造标签数据warehousing_manufacturing.js、检验检测标签数据inspection_testing.js以及小票打印数据ticket.js。drawParameter子目录存放各类绘制参数的配置文件，包括文本参数DrawLableText.js、条形码参数DrawLableBarCode.js、二维码参数DrawLableQrCode.js、线条参数DrawLableLine.js、图形参数DrawLableGraph.js、图片参数DrawLableImage.js、画板初始化参数InitDrawingBoard.js、预览图像生成参数generateImagePreviewImage.js、SDK初始化参数initSdk.js以及图片打印参数picturePrint.js。

```
├── .trae/
│   └── rules/
│       └── project_rules.md          # 项目规则文档
├── drawParameter/                     # 绘制参数定义
│   ├── DrawLableBarCode.js           # 条码绘制参数
│   ├── DrawLableGraph.js             # 图形绘制参数
│   ├── DrawLableImage.js             # 图像绘制参数
│   ├── DrawLableLine.js              # 线条绘制参数
│   ├── DrawLableQrCode.js            # 二维码绘制参数
│   ├── DrawLableText.js              # 文本绘制参数
│   ├── InitDrawingBoard.js           # 画板初始化参数
│   ├── generateImagePreviewImage.js  # 预览图像生成参数
│   ├── initSdk.js                    # SDK初始化参数
│   └── picturePrint.js               # 图片打印参数
├── img/                              # 图片资源目录
│   ├── supermarket_retail.png
│   ├── test5030-200dpi.png
│   └── test5030-300dpi.png
├── js/                               # JavaScript代码目录
│   ├── api/                          # API接口文件
│   │   └── jcPrinterSdk_api_third.js # SDK API接口定义
│   ├── iJcPrinterSdk_third.js        # SDK调用示例主文件
│   └── printData/                    # 打印数据定义
│       ├── barcode.js                # 条码打印数据
│       ├── batch.js                  # 批量打印数据
│       ├── combination.js            # 组合元素打印数据
│       ├── fixed_asset.js            # 固定资产标签打印数据
│       ├── graph.js                  # 图形打印数据
│       ├── img.js                    # 图像打印数据
│       ├── inspection_testing.js     # 检验测试标签打印数据
│       ├── line.js                   # 线条打印数据
│       ├── qrCode.js                 # 二维码打印数据
│       ├── text.js                   # 文本打印数据
│       ├── ticket.js                 # 小票打印数据
│       └── warehousing_manufacturing.js # 仓储制造标签打印数据
├── index.css                         # 主样式文件
├── index.html                        # 主页面文件
└── README.md                         # 项目说明文档
```

## 支持的打印机型号

本SDK支持精臣多款热敏和热转印打印机型号。热敏打印机型号包括B3S、B1、B203、B21、K2、K3、K3W和B11，这些型号适用于日常标签打印场景，支持的打印浓度范围为1至5，建议默认值为3。热敏模式下支持的纸张类型包括间隙纸、黑标纸、连续纸和透明纸。热转印打印机型号包括B50、B50W、B32、Z401、M2和M3，这些型号适用于需要更高耐久性的标签打印场景，支持的打印浓度范围为1至15，建议默认值为8。热转印模式下支持的纸张类型包括间隙纸、透明纸，部分型号还支持黑标间隙纸。不同型号的打印机在纸张类型支持上略有差异，开发者在实际使用时应根据具体型号进行参数设置。

| 打印机型号 | 打印模式 | 浓度范围 | 默认浓度 | 支持纸张类型 |
|-----------|---------|---------|---------|-------------|
| B3S | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、连续纸、透明纸 |
| B1 | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、透明纸 |
| B203 | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、透明纸 |
| B21 | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、连续纸、透明纸 |
| K2 | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、透明纸 |
| K3/K3W | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、透明纸 |
| B11 | 热敏 | 1-5 | 3 | 间隙纸、黑标纸、透明纸 |
| B50/B50W | 热转印 | 1-15 | 8 | 间隙纸 |
| B32 | 热转印 | 1-15 | 8 | 间隙纸、透明纸 |
| Z401 | 热转印 | 1-15 | 8 | 间隙纸、透明纸 |
| M2 | 热转印 | 1-5 | 3 | 间隙纸、黑标纸、透明纸、黑标间隙纸 |
| M3 | 热转印 | 1-5 | 3 | 间隙纸、黑标纸、透明纸、黑标间隙纸 |

## 环境要求

本项目对运行环境有一定要求，确保满足这些条件后才能正常使用打印功能。浏览器方面，项目支持主流现代浏览器，包括Chrome、Firefox、Edge和Safari等，但要求浏览器必须支持WebSocket协议。由于项目通过WebSocket与本地打印服务进行通信，因此浏览器的WebSocket实现必须正常工作。最重要的是，本项目依赖精臣打印服务客户端，该服务通过ws://127.0.0.1:37989端口与Web应用进行通信。用户需要先在电脑上安装并启动精臣打印服务，确保服务正常运行后才能连接打印机。WiFi打印机连接时，电脑和打印机必须处于同一局域网内，且网络环境应为2.4GHz频段，部分型号的打印机不支持5GHz WiFi网络。

## 快速开始

开发者可以通过以下步骤快速开始使用本项目。首先，需要获取项目代码，可以从代码仓库克隆或下载ZIP压缩包到本地。然后，确保电脑上已安装精臣打印服务客户端，并确认服务已启动运行。接下来，直接用浏览器打开项目根目录下的index.html文件即可进入打印演示界面。页面加载后，系统会自动尝试连接打印服务，连接成功后会在界面显示服务状态。开发者需要选择连接方式，USB连接模式下点击更新USB打印机列表按钮，系统会扫描并显示已连接的USB打印机，选择后点击连接USB打印机按钮即可。WiFi连接模式下，点击更新Wifi打印机列表按钮扫描网络中的打印机，选择后点击连接WIFI打印机按钮。打印机连接成功后，点击初始化SDK按钮完成SDK初始化。初始化完成后，即可使用界面上的各种打印功能按钮进行预览或打印操作。

## 核心API文档

### 服务连接API

服务连接API用于建立Web应用与打印服务之间的通信链路。getInstance函数是所有API调用的前提，必须在页面加载时或使用前首先调用该函数来建立WebSocket连接。该函数接受三个回调参数：onServiceConnected在连接成功时调用，onNotSupportedService在浏览器不支持WebSocket时调用，onServiceDisconnected在连接断开时调用。连接建立后，系统会自动尝试保持连接，当连接断开时会自动重连，重连间隔为3秒。建议在onServiceConnected回调中继续调用获取打印机列表和初始化SDK等后续操作。

### 打印机操作API

打印机操作API用于发现、连接和管理打印机设备。getAllPrinters函数用于获取所有通过USB连接的打印机列表，返回的打印机信息包含名称和端口号。scanWifiPrinters函数用于扫描局域网内的WiFi打印机，该操作的超时时间较长，设置为25秒以确保能够发现所有在线设备。selectPrinter函数用于连接USB打印机，需要传入打印机名称和端口号作为参数。connectWifiPrinter函数用于连接WiFi打印机，同样需要传入设备名称和端口号。closePrinter函数用于断开当前连接的打印机。configurationWifi函数用于配置打印机的WiFi网络连接，仅支持2.4GHz网络，且需要在USB连接成功后才能配置。getWifiConfiguration函数用于获取打印机当前已配置的WiFi信息。

### 绘制元素API

绘制元素API用于在画板上绘制各种打印内容。InitDrawingBoard函数用于初始化画板，设置画布的宽度、高度和旋转角度，每次调用会清空画板上一次绘制的内容。DrawLableText函数用于绘制文本内容，支持设置字体大小、对齐方式、行间距、字间距、字体样式（加粗、斜体、下划线）等参数。DrawLableBarCode函数用于绘制一维条码，支持CODE128、UPC-A、UPC-E、EAN8、EAN13、CODE93、CODE39、CODABAR、ITF25等多种编码格式。DrawLableQrCode函数用于绘制二维码，支持QR_CODE、PDF417、DATA_MATRIX、AZTEC等编码类型。DrawLableQrCodeWithLogo函数支持绘制带logo的二维码，可设置logo的缩放比例和位置。DrawLableLine函数用于绘制线条，支持实线和虚线两种类型。DrawLableGraph函数用于绘制几何图形，支持圆、椭圆、矩形和圆角矩形。DrawLableImage函数用于绘制图片，需要传入Base64编码的图片数据。

### 打印任务API

打印任务API用于执行实际的打印操作。startJob函数用于启动打印任务，需要传入打印浓度、纸张类型、打印模式和打印份数等参数。纸张类型参数的可选值包括：1表示间隙纸、2表示黑标纸、3表示连续纸、4指定孔纸、5表示透明纸、6表示标牌、10表示黑标间隙纸。commitJob函数用于提交打印数据，在完成所有元素绘制后调用。endJob函数用于结束打印任务，在收到最后一页最后一份打印完成信号后必须调用。cancelJob函数用于取消当前打印任务，打印机会立即停止打印。addJobListener函数用于添加打印任务监听器，用于接收打印进度和完成状态。addPrinterStatusListener函数用于添加打印机状态监听器，用于接收开盖、缺纸、离线等硬件状态变化事件。

## 使用示例

以下是一些常用功能的代码示例，开发者可以参考这些示例在自己的项目中集成打印功能。

### 基础调用流程

所有打印操作都遵循相同的调用流程：连接打印服务、初始化SDK、选择打印机、开始打印任务、绘制元素、提交数据、结束任务。以下代码展示了完整的基础调用流程：

```javascript
// 1. 连接打印服务（页面加载时调用）
getInstance(
    () => {
        console.log('服务连接成功');
        // 继续后续初始化操作
        init();
    },
    () => {
        console.log('浏览器不支持WebSocket');
    },
    () => {
        console.log('服务连接断开');
    }
);

// 2. 初始化SDK
async function init() {
    try {
        const res = await initSdk({ fontDir: '' });
        if (res.resultAck.errorCode === 0) {
            console.log('SDK初始化成功');
        }
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 3. 获取USB打印机列表
async function getPrinters() {
    const res = await getAllPrinters();
    const printers = JSON.parse(res.resultAck.info);
    console.log('打印机列表:', printers);
}

// 4. 连接打印机
async function connect() {
    const select = document.getElementById('printers');
    const printerName = select.options[select.selectedIndex].value;
    const port = 1; // 示例端口号
    await selectPrinter(printerName, port);
}

// 5. 执行打印
async function print() {
    const density = 3; // 打印浓度
    const labelType = 1; // 纸张类型：间隙纸
    const printMode = 1; // 打印模式：热敏
    const count = 1; // 打印份数

    // 开始打印任务
    await startJob(density, labelType, printMode, count);

    // 初始化画板
    await InitDrawingBoard({
        width: 40,
        height: 60,
        rotate: 0
    });

    // 绘制文本
    await DrawLableText({
        x: 2,
        y: 2,
        height: 10,
        width: 36,
        value: 'Hello, 精臣打印机!',
        fontSize: 5,
        textAlignHorizonral: 1,
        textAlignVertical: 1,
        lineMode: 6
    });

    // 提交打印任务
    await commitJob(null, JSON.stringify({
        printerImageProcessingInfo: {
            printQuantity: 1
        }
    }));

    // 结束打印任务
    await endJob();
}
```

### 文本打印示例

文本打印是最常用的打印功能，以下代码展示了如何设置文本的各种样式参数：

```javascript
const textData = {
    InitDrawingBoardParam: {
        width: 40,
        height: 60,
        rotate: 0
    },
    elements: [
        {
            type: 'text',
            json: {
                x: 2,
                y: 2,
                height: 10,
                width: 36,
                value: '合格证',
                fontFamily: '宋体',
                rotate: 0,
                fontSize: 8,
                textAlignHorizonral: 1,
                textAlignVertical: 1,
                letterSpacing: 0,
                lineSpacing: 1,
                lineMode: 6,
                fontStyle: [true, false, false, false]
            }
        }
    ]
};

// 执行打印
await startPrintJobTest(textData);
```

### 条码打印示例

条码打印支持多种编码格式，以下是CODE128条码的打印示例：

```javascript
const barcodeData = {
    InitDrawingBoardParam: {
        width: 40,
        height: 20,
        rotate: 0
    },
    elements: [
        {
            type: 'barCode',
            json: {
                x: 2,
                y: 2,
                height: 10,
                width: 36,
                value: '12345678',
                codeType: 20,
                rotate: 0,
                fontSize: 3,
                textHeight: 3,
                textPosition: 0
            }
        }
    ]
};

// 执行打印
await startPrintJobTest(barcodeData);
```

### 二维码打印示例

二维码打印支持设置纠错级别和嵌入logo，以下是基础二维码的打印示例：

```javascript
const qrCodeData = {
    InitDrawingBoardParam: {
        width: 30,
        height: 30,
        rotate: 0
    },
    elements: [
        {
            type: 'qrCode',
            json: {
                x: 2,
                y: 2,
                height: 26,
                width: 26,
                value: 'https://www.jc.com',
                codeType: 31,
                rotate: 0
            }
        }
    ]
};

// 执行打印
await startPrintJobTest(qrCodeData);
```

### 预览功能示例

预览功能可以在实际打印前查看标签效果，避免浪费纸张：

```javascript
async function preview() {
    try {
        // 初始化画板
        const initRes = await InitDrawingBoard(content.InitDrawingBoardParam);
        if (initRes.resultAck.errorCode !== 0) {
            throw new Error('画板初始化失败');
        }

        // 绘制所有元素
        for (const item of content.elements) {
            let res;
            switch (item.type) {
                case 'text': res = await DrawLableText(item.json); break;
                case 'qrCode': res = await DrawLableQrCode(item.json); break;
                case 'barCode': res = await DrawLableBarCode(item.json); break;
                default: continue;
            }
            if (res.resultAck.errorCode !== 0) {
                throw new Error(`绘制${item.type}失败`);
            }
        }

        // 生成预览图
        const previewRes = await generateImagePreviewImage(8);
        const imageData = 'data:image/jpeg;base64,' + 
            JSON.parse(previewRes.resultAck.info).ImageData;
        
        // 显示预览图
        const img = new Image();
        img.src = imageData;
        document.body.appendChild(img);
    } catch (error) {
        console.error('预览失败:', error);
    }
}
```
