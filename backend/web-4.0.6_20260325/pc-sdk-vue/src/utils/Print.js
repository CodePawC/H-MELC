/**
 * @Description
 * @Version
 * @Author 徐泽鹏
 * @date 2023/5/23 15:37
 */
/*
 * 打印服务的方法
 * */

import PrintElementFactory from './PrintElementFactory';

export default class NMPrintSocket {
  // 打印异常码及原因
  printerrormessage = {
    1: "异常开盖，请关闭上盖后再继续打印",
    2: "未检测到标签纸，请重新安装后再试",
    3: "电量过低，请充电后再试",
    4: "电池异常，请联系客服",
    5: "已停止打印",
    6: "打印异常，请稍后再试",
    7: "打印头温度过高，请冷却后再试",
    8: "出纸异常或标签纸用完，请检查标签纸后再试",
    9: "打印忙碌，请稍后再试",
    10: "未检测到打印头，请联系客服",
    11: "打印环境温度过低，请在室温下再试",
    12: "打印头未锁紧，请锁紧后再试",
    13: "未检测到碳带，请安装碳带后再试",
    14: "碳带不匹配，请安装匹配类型碳带",
    15: "碳带已用完，请更换碳带后再试",
    16: "纸张类型错误，请联系客服",
    20: "标签损坏或非RFID标签，请检查标签纸后再试",
    22: "通讯异常，请稍后再试",
    23: "打印机连接断开，请重新连接再试",
    28: "标签纸异常，请按打印机右键重新定位",
    29: "检测到RFID标签，请更换标签纸后再试",
    30: "浓度设置异常，请重新设置",
    31: "打印模式异常，请重新设置",
    32: "标签材质设置异常，请重新设置",
    33: "不支持该标签材质，请更换或重新设置",
    34: "不支持RFID写入",
    50: "非法标签",
    51: "非法碳带和标签",
  };
  printSocket;

  constructor(printSocketData) {
    this.printSocket = printSocketData;
  }

  // 获取打印服务是否连接
  printSocketStatus() {
    return (
      this.printSocket._websocket && this.printSocket._websocket.readyState
    );
  }

  // 自定义消息发送，不走promise
  customSend(json) {
    return this.printSocket.customSend(json);
  }

  /**
   * 初始化SDK，在打印服务连接成功后调用此接口。
   * 在调用SDK的绘制接口之前，必须先调用此接口。
   *
   * @param {object} json - 包含必要参数的JSON对象,格式如下：
   *  {
   *   "fontDir": string, //字体文件目录，默认为""，暂不生效
   * }
   *
   * @return {Promise} 返回一个 Promise，解析为初始化SDK的结果
   */
  initSdk(json) {
    var jsonObj = {
      apiName: "initSdk",
      parameter: json,
    };

    return this.printSocket.send(jsonObj);
  }



  /**
   * 获取所有当前PC上通过USB连接的精臣打印机
   *
   * @return {Promise} 返回一个Promise，解析为打印机列表。
   *
   * @description
   * 需要在打印服务连接成功后调用此函数。
   */
  getAllPrinters() {
    var jsonObj = { apiName: "getAllPrinters" };
    // console.log("开始搜索设备");
    return this.printSocket.send(jsonObj);
  }

  /**
   * 选择并打开需要使用的打印机名称，及端口号
   *
   * @param {string} printerName - 打印机名称。
   * @param {number} port - 连接端口。
   * @return {Promise} 返回一个Promise，解析为连接结果
   *
   * @description
   * 需要在打印服务连接成功后调用此函数，建议在getAllPrinters调用成功后调用该接口，以保证传入的打印机名称和端口的打印机状态正常。。
   */
  selectPrinter(printerName, port) {
    var jsonObj = {
      apiName: "selectPrinter",
      parameter: {
        printerName: printerName,
        port: port,
      },
    };
    return this.printSocket.send(jsonObj);
  }

  /**
   * 搜索Wifi打印机
   *
   *
   * @return {Promise} 返回一个 Promise，解析为打印机Wifi配置信息
   *
   * @description
   * 需要在打印服务连接成功后调用此函数。
   */
  scanWifiPrinter() {
    var jsonObj = {
      apiName: "scanWifiPrinter",
    };
    return this.printSocket.send(jsonObj, 25000);
  }

  /**
   * 发送消息以选择打印机。
   *
   * @param {string} printerName - 打印机名称。
   * @param {number} tcpPort - 端口号。
   * @return {Promise} 返回连接结果
   *
   * @description
   * 需要在打印服务连接成功后调用此函数，建议在scanWifiPrinter调用成功的回调接口中调用该接口，保证传入的打印机名称和端口的打印机状态正常。
   * 注意：此函数仅能连接 WIFI 打印机列表中的打印机。
   */
  connectWifiPrinter(printerName, tcpPort) {
    var jsonObj = {
      apiName: "connectWifiPrinter",
      parameter: {
        printerName: printerName,
        port: tcpPort,
      },
    };
    return this.printSocket.send(jsonObj, 25000);
  }

  /**
   * 配置打印机的Wifi网络
   *
   * @param {string} wifiName - wifi网络的名称。
   * @param {string} wifiPassword - wifi网络的密码。
   * @return {Promise} 返回一个 Promise，解析为打印机Wifi配置结果
   *
   * @description
   * 注意:仅支持2.4G频段网络，且需要在连接成功后配置。首次配置建议在USB连接成功后配置
   */
  configurationWifi(wifiName, wifiPassword) {
    var jsonObj = {
      apiName: "configurationWifi",
      parameter: {
        wifiName: wifiName,
        wifiPassword: wifiPassword,
      },
    };
    return this.printSocket.send(jsonObj, 25000);
  }

  /**
   * 获取打印机的wifi配置。
   *
   * @return {Promise} 返回一个 Promise，解析为打印机Wifi配置信息
   */
  getWifiConfiguration() {
    var jsonObj = {
      apiName: "getWifiConfiguration",
    };
    return this.printSocket.send(jsonObj);
  }

  /**
   * 关闭打印机。
   *
   * @return {Promise} 返回一个Promise，解析为关闭结果
   */
  closePrinter() {
    var jsonObj = { apiName: "closePrinter" };
    return this.printSocket.send(jsonObj);
  }

  /**
   * 设置打印机自动关机时间。
   *
   * @param {number} nType - 自动关机档位:
   *                        1: 15分钟
   *                        2: 30分钟
   *                        3: 60分钟
   *                        4: 从不
   * @return {Promise} - 返回一个 Promise，解析为设置自动关机时间的结果
   */
  setPrinterAutoShutDownTime(nType) {
    var jsonObj = {
      apiName: "setPrinterAutoShutDownTime",
      parameter: { nType: nType },
    };
    // console.log("设置自动关机", jsonObj);
    return this.printSocket.send(jsonObj);
  }

  /**
   * 开始一个打印任务。
   *
   * @param {number} printDensity - 打印浓度，根据不同打印机型号取值范围不同，具体如下：
   *                                  - B3S、B203、B1、K3、K3W、M2: 取值范围 1~5，默认为 3。
   *                                    - B50、B11、B50W、B32、Z401: 取值范围 1~15，默认为 8。
   * @param {number} printLabelType - 纸张类型，可选值：
   *                               1: 间隙纸
   *                               2: 黑标纸
   *                               3: 连续纸
   *                               4: 定孔纸
   *                               5: 透明纸
   *                               6: 标牌
   *                              10:黑标间隙纸
   * @param {number} printMode - 打印模式，可选值：
   *                            1: 热敏
   *                            2: 热转印
   *                            注意，不同打印机型号支持的打印模式有限制，具体如下：
   *                            - D11、D101、D110、H10、B16、B18、B3S、B203、B1、K3、K3W、B11 仅支持热敏。
   *                            - B50、B50W、B32、Z401、M2 仅支持热转印。
   * @param {number} count - 总打印份数，表示所有页面的打印份数之和。
   *                            例如，如果你有3页需要打印，第一页打印3份，第二页打印2份，第三页打印5份，那么count的值应为10（3+2+5）。
   * @return {Promise} - 返回一个 Promise，解析为开始打印任务的结果
   * @example
   * //返回数据示例
   * {
   *     "apiName": "startJob",
   *     "resultAck": {
   *         "errorCode": 0,
   *         "info": "startJob ok!",
   *         "result": 0
   *     }
   * }
   * @description 返回结果中的 errorCode 含义如下：
   *              - 0: 成功
   *              - -1: 失败，info 表示原因
   *              - -2: 打印机忙碌，info 表示原因
   *              - -3: 打印机接收到不支持的参数，主要是浓度、纸张类型、打印模式，info 表示具体原因
   */
  startJob(printDensity, printLabelType, printMode, count) {
    var jsonObj = {
      apiName: "startJob",
      parameter: {
        printDensity: printDensity,
        printLabelType: printLabelType,
        printMode: printMode,
        count: count,
      },
    };
    return this.printSocket.send(jsonObj);
  }

  /**
   * 提交打印任务，并执行回调函数。
   *
   * @param {string} [printData=null] - 打印数据的 JSON 字符串。
   * @param {string} printerImageProcessingInfo - 打印机图像处理信息的 JSON 字符串，包含打印份数信息，格式如下：
   * {
   *   "printerImageProcessingInfo": {
   *     "printQuantity": 1 // 用于指定当前页的打印份数。例如，如果需要打印3页，第一页打印3份，第二页打印2份，第三页打印5份，则在3次提交数据时，printerImageProcessingInfo 中的 "printQuantity" 值分别应为 3，2，5。
   *   }
   * }
   *
   * @return {Promise} 返回一个 Promise，解析为提交打印任务返回信息
   *
   * @description
   * 需要先开启打印任务，完成绘制后再提交打印任务
   */
  commitJob(printData, printerImageProcessingInfo) {
    var printDataJson = eval("(" + printData + ")");
    var printerImageProcessingInfoJson = eval(
      "(" + printerImageProcessingInfo + ")"
    );
    var jsonObj = {
      apiName: "commitJob",
      parameter: {
        printData: printDataJson,
        printerImageProcessingInfo:
          printerImageProcessingInfoJson["printerImageProcessingInfo"],
      },
    };
    // const resultInfo = "commitJob ok";
    return this.printSocket.send(jsonObj);
  }

  /**
   * 结束打印任务
   *
   * @return {Promise} 返回一个 Promise，解析为结束打印任务的结果
   *
   * @description
   * 收到最后一页最后一份打印页面后调用该函数结束打印任务
   */
  endJob() {
    var jsonObj = { apiName: "endJob" };
    return this.printSocket.send(jsonObj);
  }

  /**
   * 取消当前的打印任务，并执行回调函数。
   *
   * @return {Promise} 返回一个 Promise，解析为取消打印任务的结果
   */
  cancelJob() {
    var jsonObj = { apiName: "stopPrint" };
    return this.printSocket.send(jsonObj);
  }

  /**
   * 初始化绘制画板
   *
   * @param {Object} json - 包含初始化绘制画板所需数据的JSON对象。格式如下：
   * {
   *   "width": number, // 画板的宽度，单位为mm
   *   "height": number, // 画板的高度，单位为mm
   *   "rotate": number, // 画板的旋转角度，仅支持0、90、180、270
   *   "path": string, // 字体文件的路径，默认为""，暂不生效
   *   "verticalShift": number, // 垂直偏移量，暂不生效
   *   "HorizontalShift": number // 水平偏移量，暂不生效
   * }
   * @return {Promise} 返回一个 Promise，解析为初始化绘制画板的结果
   *
   * @description
   * 增加接口说明:
   * 1.在调用绘制接口之前，必须先初始化SDK。
   * 2.绘制元素前，必须先初始化画板，否则会引起崩溃！
   * 3.初始化画板时会清空画板上次绘制的内容！
   */
  InitDrawingBoard(json) {
    var jsonObj = {
      apiName: "InitDrawingBoard",
      parameter: json,
    };
    // console.log("宽度:" + json.width);
    // console.log("高度:" + json.height);
    // console.log("旋转角度:" + json.rotate);
    return this.printSocket.send(jsonObj);
  }

  /**
   * 绘制标签文本。
   * @param {object} json - 包含标签文本信息的JSON对象。
   *   JSON格式要求如下：
   *   - x: x轴坐标，单位mm
   *   - y: y轴坐标，单位mm
   *   - height: 文本高度，单位mm
   *   - width: 文本宽度，单位mm
   *   - value: 文本内容
   *   - fontFamily: 字体名称，暂不生效，使用默认字体思源黑体
   *   - rotate: 旋转角度，0:0，1:90，2:180，3:270
   *   - fontSize: 字号，单位mm
   *   - textAlignHorizonral: 水平对齐方式：0:左对齐 1:居中对齐 2:右对齐
   *   - textAlignVertical: 垂直对齐方式：0:顶对齐 1:垂直居中 2:底对齐
   *   - letterSpacing: 字母之间的标准间隔，单位mm
   *   - lineSpacing: 行间距（倍距），默认1
   *   - lineMode: 1:宽高固定，内容大小自适应，预设宽高过大时字号放大，预设宽高过小时字号缩小，
   *     保证内容占据满预设宽高（字号/字符间距/行间距 按比例缩放）
   *     2:宽度固定，高度自适应
   *     4:宽高固定,超出内容直裁切
   *     6:宽高固定，内容超过预设的文本宽高自动缩放
   *     建议设置为6
   *   - fontStyle: 字体样式[加粗，斜体，下划线，删除下划线（预留）]
   *
   * @return {Promise} 返回一个 Promise，解析为绘制标签文本的结果
   * @description 绘制标签文本前必须先初始化画板
   */
  DrawLableText(json) {
    const elementConfig = PrintElementFactory.createElement('text', json);
    return this.printSocket.send(elementConfig);
  }

  /**
   * 绘制一维码条形码。
   *
   * @param {Object} json - 包含一维码条形码信息的JSON对象。格式如下：
   * {
   *   "x": number, // x轴坐标，单位mm
   *   "y": number, // y轴坐标，单位mm
   *   "height": number, // 一维码宽度，单位mm
   *   "width": number, // 一维码高度，单位mm（包含文本高度）
   *   "value": string, // 一维码内容
   *   "codeType": number, // 条码类型：
   *                     // 20: CODE128
   *                     // 21: UPC-A
   *                     // 22: UPC-E
   *                     // 23: EAN8
   *                     // 24: EAN13
   *                     // 25: CODE93
   *                     // 26: CODE39
   *                     // 27: CODEBAR
   *                     // 28: ITF25
   *   "rotate": number, // 旋转角度，0: 0，1: 90，2: 180，3: 270
   *   "fontSize": number, // 文本字号，单位mm，字号为0则文本不显示
   *   "textHeight": number, // 文本高度，单位mm，高度为0则文本不显示
   *   "textPosition": number // 一维码文字识别码显示位置：
   *                          // 0: 下方显示
   *                          // 1: 上方显示
   *                          // 2: 不显示
   * }
   *
   * @return {Promise} 返回一个 Promise，解析为绘制一维码条形码的结果
   *
   * @description
   * 1. 绘制元素前，必须先初始化画板
   */
  DrawLableBarCode(json) {
    const elementConfig = PrintElementFactory.createElement('barCode', json);
    return this.printSocket.send(elementConfig);
  }

  /**
   * 绘制二维码。
   *
   * @param {Object} json - 包含二维码信息的JSON对象。格式如下：
   * {
   *   "x": number, // x轴坐标，单位mm
   *   "y": number, // y轴坐标，单位mm
   *   "height": number, // 二维码高度，默认宽高一致
   *   "width": number, // 二维码宽度，单位mm
   *   "value": string, // 二维码内容
   *   "codeType": number, // 条码类型：
   *                     // 31: QR_CODE
   *                     // 32: PDF417
   *                     // 33: DATA_MATRIX
   *                     // 34: AZTEC
   *   "rotate": number, // 旋转角度，仅支持0、90、180、270
   * }
   *
   * @return {Promise} 返回一个 Promise，解析为绘制二维码的结果
   *
   * @description
   * 1. 绘制元素前，必须先初始化画板
   */
  DrawLableQrCode(json) {
    const elementConfig = PrintElementFactory.createElement('qrCode', json);
    return this.printSocket.send(elementConfig);
  }

  /**
 * 绘制带logo的二维码。
 * @param {*} json - 包含二维码信息的JSON对象。格式如下：
 * {
 *   "x": number, // x轴坐标，单位mm
 *   "y": number, // y轴坐标，单位mm
 *   "height": number, // 二维码高度，默认宽高一致
 *   "width": number, // 二维码宽度，单位mm
 *   "value": string, // 二维码内容
 *   "codeType": number, // 条码类型：
 *                     // 31: QR_CODE
 *                     // 32: PDF417
 *                     // 33: DATA_MATRIX
 *                     // 34: AZTEC
 *   "rotate": number, // 旋转角度，仅支持0、90、180、270
 *  "correctLevel": 2,//纠错级别，取值范围1-4，默认2
 *  ""logoBase64": ": string,//logo的base64编码(不含数据头，如data:image/png;base64,)
 *  ""logoPosition": ": 0,//logo的位置，取值范围0-4，默认0:居中，3右下·
 *  "logoHeight": number,//logo高度，单位mm，默认10mm
 *    "logoScale": 0.25,//logo缩放比例，取值范围0-0.33，默认0.25
 * }
 */
DrawLableQrCodeWithLogo(json) {
  const elementConfig = PrintElementFactory.createElement('qrCodeWithLogo', json);
  return this.printSocket.send(elementConfig);
}

  /**
   * 绘制线条。
   *
   * @param {Object} json - 包含线条信息的JSON对象。格式如下：
   * {
   *   "x": number, // x轴坐标，单位mm
   *   "y": number, // y轴坐标，单位mm
   *   "height": number, // 线高，单位mm
   *   "width": number, // 线宽，单位mm
   *   "lineType": number, // 线条类型：1:实线 2:虚线类型,虚实比例1:1
   *   "rotate": number, // 旋转角度，仅支持0、90、180、270
   *   "dashwidth": number // 线条为虚线宽度，【实线段长度，空线段长度】
   * }
   *
   * @return {Promise} 返回一个 Promise，解析为绘制线条的结果
   *
   * @description
   * 1. 绘制元素前，必须先初始化画板
   */
  DrawLableLine(json) {
    const elementConfig = PrintElementFactory.createElement('line', json);
    return this.printSocket.send(elementConfig);
  }

  /**
   * 绘制图形。
   *
   * @param {Object} json - 包含绘制图形信息的JSON对象。格式如下：
   * {
   *   "x": number, // x轴坐标，单位mm
   *   "y": number, // y轴坐标，单位mm
   *   "height": number, // 图形高度，单位mm
   *   "width": number, // 图形宽度，单位mm
   *   "rotate": number, // 旋转角度，仅支持0、90、180、270
   *   "cornerRadius": number, // 圆角半径，单位mm，暂不生效
   *   "lineWidth": number, // 线宽，单位mm
   *   "lineType": number, // 线条类型：1:实线 2:虚线类型,虚实比例1:1
   *   "graphType": number, // 图形类型：1:圆，2:椭圆，3:矩形 4:圆角矩形
   *   "dashwidth": number // 线条为虚线宽度，【实线段长度，空线段长度】
   * }
   *
   * @return {Promise} 返回一个 Promise，解析为绘制图形的结果
   *
   * @description
   * 1. 绘制元素前，必须先初始化画板
   */
  DrawLableGraph(json) {
    const elementConfig = PrintElementFactory.createElement('graph', json);
    return this.printSocket.send(elementConfig);
  }

  /**
   * 绘制图片。
   *
   * @param {Object} json - 包含绘制图片信息的JSON对象。格式如下：
   * {
   *   "x": number, // x轴坐标，单位mm
   *   "y": number, // y轴坐标，单位mm
   *   "height": number, // 图片高度，单位mm
   *   "width": number, // 图片宽度，单位mm
   *   "rotate": number, // 旋转角度，仅支持0、90、180、270
   *   "imageProcessingType": number, // 图像处理算法，默认0
   *   "imageProcessingValue": number, // 算法参数，默认127
   *   "imageData": number, // 图片base64数据，不含数据头
   *                     // 如原始数据为“data:image/png;base64,iVBORw0KGgoAAAANSU”
   *                     // 传入的数据需要去除头部，数据为，“iVBORw0KGgoAAAANSU”
   * }
   * @return {Promise} 返回一个 Promise，解析为绘制图片的结果
   *
   * @description
   * 增加接口说明:
   * 1. 绘制元素前，必须先初始化画板
   */
  DrawLableImage(json) {
    const elementConfig = PrintElementFactory.createElement('image', json);
    return this.printSocket.send(elementConfig);
  }

  /**
   * 生成图像预览图像。
   *
   * @param {number} displayScale - 图像显示比例，表示 1mm 的点数，可调整预览图大小。
   *                               例如，200dpi 的打印机可设置为 8，300dpi 的打印机可设置为 11.81。
   *
   * @return {Promise} 返回一个 Promise，解析为生成图像预览图像的结果
   *
   * @description
   * 增加方法说明:
   * 1. 在调用此函数之前，必须确保图像数据已准备好，否则无法生成预览。
   */
  generateImagePreviewImage(displayScale) {
    var jsonObj = {
      apiName: "generateImagePreviewImage",
      displayScale: displayScale,
    };

    return this.printSocket.send(jsonObj);
  }

  // 添加打印回调
  addPrintListener(callback) {
    return this.printSocket.addPrintListener(callback);
  }

  // 移除打印回调
  removePrintListener(callback) {
    this.printSocket.removePrintListener(callback);
  }


  // 添加用于调试的方法
  getListenersCount() {
    return this.printSocket.printListeners.size;
  }
  // 修改清理所有监听器的方法
  clearAllListeners() {
    const count = this.printSocket.printListeners.size;
    this.printSocket.printListeners.clear();
    console.log(`Cleared ${count} listeners`);
  }

}


