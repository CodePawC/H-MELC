import React, { useState, useEffect, useRef } from 'react';
import './home.css';
import { HomeLogic } from './HomeLogic.js';
import { textPrintData } from './printData/Text';
import { barcodePrintData } from './printData/Barcode';
import { qrCodePrintData } from './printData/QrCode';
import { linePrintData } from './printData/Line';
import { graphPrintData } from './printData/Graph';
import { imgPrintData } from './printData/Img';
import { combinationPrintData } from './printData/Combination';
import { batchPrintData } from './printData/Batch';

/**
 * Home 组件是精臣打印SDK演示的主页面组件。
 * 该组件负责管理打印机的初始化、连接、设置以及打印任务的处理。
 * 通过使用 [HomeLogic](./pc-react/src/HomeLogic.ts#L21-L482) 类来处理业务逻辑，并通过 React 的状态和副作用钩子来管理组件的状态和生命周期。
 *
 * @returns {JSX.Element} 返回一个包含打印机初始化、设置和打印相关操作的页面。
 */
function Home() {
  /**
   * 使用 useState 创建了一个状态变量 _ （实际未使用，仅用于强制更新）
   */
  const [_, setForceUpdate] = useState(0);
  /**
   * 使用 useRef 创建了一个 homeLogicRef 引用，初始值为 null
   */
  const homeLogicRef = useRef(null);

  /**
   * 强制更新组件的函数。
   * 通过增加状态值来触发组件的重新渲染。
   */
  const forceUpdate = () => setForceUpdate(prev => prev + 1);

  /**
   * 在组件挂载时初始化 [HomeLogic](./pc-react/src/HomeLogic.ts#L21-L482) 实例，并执行打印机的初始化和扫描操作。
   * 在组件卸载时进行清理操作，如关闭 socket 连接。
   * 空依赖数组 [] 表示这个effect只在组件挂载时执行一次
   */
  useEffect(() => {
    homeLogicRef.current = new HomeLogic(forceUpdate);
    homeLogicRef.current.initialize();
    console.log("useEffect");
    return () => {
      // 清理操作，如关闭 socket 连接
      if (homeLogicRef.current && homeLogicRef.current.socketData) {
        homeLogicRef.current.socketData.close();
      }
    };
  }, []);

 
  /**
   * 从 homeLogicRef 中获取当前的 [HomeLogic](./git/pc-react/src/HomeLogic.ts#L21-L482) 实例。
   */
  const logic = homeLogicRef.current;
  /**
   * 如果 [HomeLogic](./git/pc-react/src/HomeLogic.ts#L21-L482) 实例不存在，显示加载中状态。
   */
  if (!logic) {
    return (
      <div className="container">
        <h1>精臣打印SDK演示</h1>
        <p>正在初始化打印机服务...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>精臣打印SDK演示</h1>

      {/* 打印机初始化部分 */}
      <div className="print_init">
        <h3>打印机初始化：</h3>
        <div className="content">
          <div className="service">
            <p className="service_status status">
              打印服务状态：{logic.printSocketOpen ? '已' : '未'}连接
            </p>
          </div>
          <div className="select_usb">
            <div className="select_printer status">
              <label>选择USB打印机:</label>
              <select
                value={logic.usbSelectPrinter}
                onChange={(e) => logic.setUsbSelectPrinter(e.target.value)}
                name="usbPrinters"
              >
                {Object.keys(logic.usbPrinters).length === 0 && (
                  <option value="" disabled>
                    请选择USB打印机
                  </option>
                )}
                {Object.entries(logic.usbPrinters).map(([name, value]) => (
                  <option key={name} value={name}>
                    {name}: {value}
                  </option>
                ))}
              </select>
            </div>
            <button className="getPrinters" onClick={() => logic.getPrinters()} type="button">
              更新USB打印机列表
            </button>
          </div>

          <div className="connect_usb">
            <p className="usb_printer_connect_status status">
              打印机连接状态：USB打印机{logic.onlineUsbBool ? '已' : '未'}连接
            </p>
            <button className="connect_printer" onClick={() => logic.selectOnLineUsbPrinter()} type="button">
              连接USB打印机
            </button>
          </div>

          {/* <div className="select_wifi">
            <div className="select_printer status">
              <label>选择wifi打印机:</label>
              <select
                value={logic.wifiSelectPrinter}
                onChange={(e) => logic.setWifiSelectPrinter(e.target.value)}
                name="wifiPrinters"
              >
                {Object.keys(logic.wifiPrinters).length === 0 && (
                    <option value="" disabled>
                        请选择Wifi打印机
                    </option>
                )}
                {Object.entries(logic.wifiPrinters).map(([name, value]) => (
                  <option key={name} value={name}>
                    {name}: {value}
                  </option>
                ))}
              </select>
            </div>
            <button className="scanWifiPrinters" onClick={() => logic.scanWifiPrinters()} type="button">
              更新Wifi打印机列表
            </button>
          </div> */}

          {/* <div className="connect_wifi">
            <p className="wifi_printer_connect_status status">
              打印机连接状态：Wifi打印机{logic.onlineWifiBool ? '已' : '未'}连接
            </p>
            <button className="connect_printer" onClick={() => logic.selectOnLineWifiPrinter()} type="button">
              连接Wifi打印机
            </button>
          </div> */}

          <div className="init">
            <div className="init_content">
              <p className="init_status status">
                SDK初始化状态：{logic.initBool ? '已' : '未'}初始化
              </p>
              <button className="init_sdk status" onClick={() => logic.init()} type="button">
                初始化SDK
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 打印设置部分 */}
      <div className="print_settings">
        <h3>打印设置：</h3>
        <div className="content">
          <h5>打印前请设置对应的参数:</h5>
          <p>
            点击查看对应机型的参数范围及建议参数:
            {['B3S', 'B1', 'B203', 'B21', 'D11/D101/D110/B16', 'B32', 'Z401', 'B50/B50W', 'B18', 'K2', 'K3/K3W', 'M2', 'M3'].map((model, index, arr) => (
              <React.Fragment key={model}>
                <span className="printer_model" onClick={() => logic.printerDetails(model)}>
                  {model}
                </span>
                {index < arr.length - 1 && '、'}
              </React.Fragment>
            ))}
          </p>
          <label>选择打印浓度:</label>
          <select value={logic.density} onChange={(e) => logic.setDensity(e.target.value)} name="density">
            {Array.from({ length: 15 }, (_, i) => i + 1).map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label style={{ marginLeft: '16px' }}>选择纸张类型:</label>
          <select value={logic.label_type} onChange={(e) => logic.setLabelType(e.target.value)} name="label_type">
            <option value={1}>间隙纸</option>
            <option value={2}>黑标纸</option>
            <option value={3}>连续纸</option>
            <option value={4}>过孔纸</option>
            <option value={5}>透明纸</option>
            <option value={6}>标牌</option>
            <option value={10}>黑标间隙纸</option>
          </select>

          <label style={{ marginLeft: '16px' }}>选择打印模式:</label>
          <select value={logic.print_mode} onChange={(e) => logic.setPrintMode(e.target.value)} name="print_mode">
            <option value={1}>热敏模式</option>
            <option value={2}>热转印模式</option>
          </select>

          <label style={{ marginLeft: '16px' }}>自动关机时间：</label>
          <select value={logic.auto_shut_down} onChange={(e) => logic.setAutoShutDown(e.target.value)} name="auto_shut_down">
            {Array.from({ length: 5 }, (_, i) => i + 1).map(item => (
              <option key={item} value={item}>
                {item}挡
              </option>
            ))}
          </select>
          
          {/* <div className="wifi_printer_setting">
            <h5>WIFI打印机网络配置及信息查询:</h5>
            <p>
              1.打印机仅支持2.4G Wifi网络<br />2.请在USB连接成功后进行网络设置
            </p> */}
            {/* <form onSubmit={(e) => e.preventDefault()}>  */}
              {/* <input
                type="text"
                placeholder="请输入Wifi名称"
                id="wifi_name"
                value={logic.wifiName}
                onChange={(e) => logic.setWifiName(e.target.value)}
              /> */}
              {/* <input
                type="text"
                placeholder="请输入Wifi密码"
                id="wifi_password"
                value={logic.wifiPassword}
                onChange={(e) => logic.setWifiPassword(e.target.value)}
              /> */}
            {/* </form> */}
            {/* <div className="setOrGet">
              <button onClick={() => logic.setWifiConfiguration()} type="button">
                配置打印机wifi网络（仅K3W支持）
              </button>
              <button onClick={() => logic.getWifiConfigurationInfo()} type="button">
                获取wifi配置信息（仅K3W支持）
              </button>
            </div> */}
          {/* </div> */}

        </div>
      </div>

      {/* 打印相关操作部分 */}
      <div className="print_related">
        <h3>打印相关：</h3>
        <div className="content">
          <button className="print_label" onClick={() => logic.startPrintJobTest(textPrintData)} type="button">
            文本打印(40-60)
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(textPrintData)} type="button">
            文本打印预览(40-60)
          </button>
          <button className="print_label" onClick={() => logic.startPrintJobTest(barcodePrintData)} type="button">
            一维码打印(40-20)
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(barcodePrintData)} type="button">
            一维码打印预览(40-20)
          </button>
          <button className="print_label" onClick={() => logic.startPrintJobTest(qrCodePrintData)} type="button">
            二维码打印(30-30)
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(qrCodePrintData)} type="button">
            二维码打印预览(30-30)
          </button>
          <button className="print_label" onClick={() => logic.startPrintJobTest(linePrintData)} type="button">
            线条打印(40-20)
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(linePrintData)} type="button">
            线条打印预览(40-20)
          </button>
          <button className="print_label" onClick={() => logic.startPrintJobTest(graphPrintData)} type="button">
            图形打印（矩形、圆形）（40-20）
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(graphPrintData)} type="button">
            图形打印（矩形、圆形）预览（40-20）
          </button>
          <button className="print_label" onClick={() => logic.startPrintJobTest(imgPrintData)} type="button">
            图片打印（50-30）
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(imgPrintData)} type="button">
            图片打印预览（50-30）
          </button>
          <button className="print_label" onClick={() => logic.startPrintJobTest(combinationPrintData)} type="button">
            多元素组合打印（50-30）
          </button>
          <button className="print_label" onClick={() => logic.handlePreview(combinationPrintData)} type="button">
            多元素组合打印预览（50-30）
          </button>
          <button className="print_label" onClick={() => logic.startBatchPrintJobTest(batchPrintData)} type="button">
            批量打印（50-30）
          </button>
        </div>
      </div>

      {/* 预览容器 */}
      {logic.previewImage && (
        <div className="preview_container">
          <img src={logic.previewImage} alt="打印预览图" />
        </div>
      )}
    </div>
  );
}

export default Home;
