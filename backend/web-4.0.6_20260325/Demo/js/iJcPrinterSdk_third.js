//单页数据打印份数
const jsonObj = {
    "printerImageProcessingInfo": {
        "printQuantity": 1,
    }
};

//SDK初始化参数
const data = {
    initSdkParam: {
        "fontDir": "",
    }
};

const models = {
    'B3S': { printMode: ['热敏'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '连续纸', '透明纸'] },
    'B50/B50W': { printMode: ['热转印'], densityRange: { min: 1, max: 15, default: 8 }, labelType: ['间隙纸'] },
    'B1': { printMode: ['热敏'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '透明纸'] },
    'B203': { printMode: ['热敏'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '透明纸'] },
    'B21': { printMode: ['热敏'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '连续纸', '透明纸'] },
    'K2': { printMode: ['热敏'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '透明纸'] },
    'K3/K3W': { printMode: ['热敏'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '透明纸'] },
    'M2': { printMode: ['热转印'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '透明纸', '黑标间隙纸'] },
    'M3': { printMode: ['热转印'], densityRange: { min: 1, max: 5, default: 3 }, labelType: ['间隙纸', '黑标纸', '透明纸', '黑标间隙纸'] },
    'B32': { printMode: ['热转印'], densityRange: { min: 1, max: 15, default: 8 }, labelType: ['间隙纸', '透明纸'] },
    'Z401': { printMode: ['热转印'], densityRange: { min: 1, max: 15, default: 8 }, labelType: ['间隙纸', '透明纸'] }
}
// [Phase 3 新增] 全局应用状态管理，替代散乱的变量
const AppState = {
    // 服务和打印机连接状态
    isServiceConnected: false,
    isServiceSupported: true,
    isPrinterConnected: false,
    connectedPrinterType: 'NONE', // 'USB' | 'WIFI' | 'NONE'
    printerName: '',
    // UI元素引用
    uiElements: {
        selectDensity: null,
        selectLabelType: null,
        selectPrintMode: null,
        selectAutoShutDown: null
    },
    // 打印机数据
    printerData: {
        allUsbPrinters: null,
        allPrintersNameAndPortArray: null
    },
};

window.onload = function () {
    initFormElements()
    //打印当前时间，精确到毫秒
    printTimeInfo();
    //连接打印服务
    getInstance(() => {
        AppState.isServiceConnected = true;
        updateServiceState();
    }, () => {
        AppState.isServiceSupported = false;
        console.log('当前浏览器不支持打印服务');
        updateServiceState();
    }, () => {
        AppState.isServiceConnected = false;
        AppState.isPrinterConnected = false;
        console.log('打印服务连接断开');
        refreshUI();
        clearPrinterList();
    });
}

// [Phase 3 新增] 更新打印服务状态
function updateServiceState() {
    const service_status = document.querySelector('.service_status');
    // 更新服务状态
    if (AppState.isServiceConnected) {
        service_status.textContent = '打印服务状态：已连接';
    } else if (!AppState.isServiceSupported) {
        service_status.textContent = '打印服务状态：不支持';
    } else {
        service_status.textContent = '打印服务状态：未连接';
    }
}

//清除打印机列表
function clearPrinterList() {
    AppState.printerData.allUsbPrinters = null;
    // 清空USB打印机列表
    const usb_printer_list = document.getElementById("usb_printers");
    usb_printer_list.innerHTML = '';
    const usbOption = document.createElement('option');
    usbOption.value = '请选择USB打印机';
    usbOption.text = '请选择USB打印机';
    usb_printer_list.appendChild(usbOption);
    AppState.printerData.allPrintersNameAndPortArray = null;
    // 清空Wifi打印机列表
    const wifi_printer_list = document.getElementById("wifi_printers");
    wifi_printer_list.innerHTML = '';
    const wifiOption = document.createElement('option');
    wifiOption.value = '请选择WIFI连接的打印机';
    wifiOption.text = '请选择WIFI连接的打印机';
    wifi_printer_list.appendChild(wifiOption);
}

// [Phase 3 新增] 更新打印机连接状态
function updatePrinterConnectStatus() {
    const usb_connect_status = document.querySelector('.usb_printer_connect_status');
    const wifi_connect_status = document.querySelector('.wifi_printer_connect_status');
    // 更新打印机状态
    if (!AppState.isPrinterConnected) {
        // 打印机断开状态处理
        usb_connect_status.textContent = '打印机连接状态：未连接';
        wifi_connect_status.textContent = '打印机连接状态：未连接';
        // 如果是从连接状态变为断开状态，执行断开逻辑
        if (AppState.connectedPrinterType !== 'NONE') {
            // 保存当前连接类型，用于后续判断
            const previousType = AppState.connectedPrinterType;
            // 更新AppState状态
            AppState.connectedPrinterType = 'NONE';
            AppState.printerName = '';
            // 移除状态监听器
            removePrinterStatusListener(onPrinterStatusChange);
            // 记录断开连接的日志
            console.log(`打印机已断开连接，原连接类型: ${previousType}`);
        }
    } else {
        // 打印机连接状态处理
        if (AppState.connectedPrinterType === 'USB') {
            usb_connect_status.textContent = `打印机连接状态：USB已连接 (${AppState.printerName})`;
            wifi_connect_status.textContent = '打印机连接状态：未连接';
        } else if (AppState.connectedPrinterType === 'WIFI') {
            usb_connect_status.textContent = '打印机连接状态：未连接';
            wifi_connect_status.textContent = `打印机连接状态：Wifi已连接 (${AppState.printerName})`;
        }
    }
}

// [Phase 3 新增] 处理打印机断开逻辑
function handlePrinterDisconnect() {
    AppState.isPrinterConnected = false;
    updatePrinterConnectStatus();
}

// [Phase 3 新增] 集中 UI 更新函数
function refreshUI() {
    updateServiceState();
    updatePrinterConnectStatus();
}

// [Phase 3 新增] 打印机状态变更监听器 (处理开盖、缺纸等)
function onPrinterStatusChange(res) {
    // 这里可以扩展处理更多硬件状态
    if (res.resultAck) {
        if (res.resultAck.callback) {
            const cb = res.resultAck.callback;
            if (cb.name === 'onCoverStatusChange') {
                console.warn('检测打印机盖子状态为: ' + (cb.coverStatus === 0 ? '合盖' : '开盖'));
            } else if (cb.name === 'onPaperStatusChange') {
                console.warn('检测打印机装纸状态为: ' + (cb.paperStatus === 1 ? '缺纸' : '有纸'));
            } if (cb.name === 'onElectricityChange') {
                console.warn('检测打印机当前电量为: ' + cb.powerLever);
            }
        } else {
            const info = res.resultAck.online;
            console.warn('检测打印机是否在线: ' + (info === 'offline' ? '不在线' : '在线'));
            handlePrinterDisconnect();
        }
    }
}

function printTimeInfo() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const millisecond = now.getMilliseconds();
    const time = `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
    console.log("当前时间:", time);
}

function initFormElements() {
    // 将UI元素引用存储到AppState中
    AppState.uiElements.selectDensity = document.getElementById('density');
    AppState.uiElements.selectDensity.selectedIndex = 2;
    // 初始化标签类型下拉框
    AppState.uiElements.selectLabelType = document.getElementById('label_type');
    AppState.uiElements.selectLabelType.selectedIndex = 0;
    // 初始化打印模式下拉框
    AppState.uiElements.selectPrintMode = document.getElementById('print_mode');
    AppState.uiElements.selectPrintMode.selectedIndex = 0;
    // 初始化自动关机下拉框
    AppState.uiElements.selectAutoShutDown = document.getElementById('auto_shut_down');
    AppState.uiElements.selectAutoShutDown.selectedIndex = 0;
    AppState.uiElements.selectAutoShutDown.addEventListener('change', () => {
        const nType = parseInt(AppState.uiElements.selectAutoShutDown.value.replace('挡', '')) || 1;
        setPrinterAutoShutDownTime(nType)
            .then(() => alert('设置成功'))
            .catch(err => alert(err.message));
    });
}
// ---------------------------------------------------------------
// 业务功能函数 (全部使用 async/await)
// ---------------------------------------------------------------

// 获取 Wifi 配置
async function getWifiConfigurationInfo() {
    try {
        const res = await getWifiConfiguration();
        const { errorCode, info } = res.resultAck; // 这里不再需要 JSON.parse(JSON.stringify(data))，直接使用对象即可
        // 解析 JSON 字符串
        if (errorCode === 0) {
            const infoObj = JSON.parse(info);
            alert("获取配置信息成功-Wifi名称为:" + infoObj.wifiName);
        } else {
            alert(info);
        }
    } catch (error) {
        alert(error.message);
    }
}

// 设置 Wifi
async function setWifiConfiguration() {
    let name = document.getElementById('wifi_name');
    let password = document.getElementById('wifi_password');
    console.log(name.value);
    console.log(password.value);
    if (name.value.trim() === "") return;
    try {
        const res = await configurationWifi(name.value, password.value);
        const { errorCode, info } = res.resultAck;
        if (errorCode === 0) {
            alert("网络配置成功，请断开USB线缆后使用WIFI搜索连接打印机（PC需要和打印机在同一网络）");
        } else {
            alert(info);
        }
    } catch (error) {
        alert(error.message);
    }
}

// 初始化 SDK
async function init() {
    let status = document.querySelector('.init_status')
    try {
        const res = await initSdk(data.initSdkParam);
        const { errorCode, info } = res.resultAck;
        if (errorCode === 0) {
            console.log('初始化成功');
            status.textContent = "SDK初始化状态：已初始化";
        } else {
            throw new Error(info); // 抛出错误跳转到 catch
        }
    } catch (error) {
        console.log('初始化失败', error);
        status.textContent = "SDK初始化状态：未初始化";
        alert(error.message || error);
    }
}

// 获取 USB 打印机列表
async function getUsbPrinters() {
    console.log('开始获取打印机');
    try {
        // [修改] 变量名 data -> res
        const res = await getAllPrinters();
        const { errorCode, info } = res.resultAck;
        const select = document.getElementById("usb_printers");
        select.innerHTML = ""; // 清空选项
        if (errorCode === 0) {
            AppState.printerData.allUsbPrinters = JSON.parse(info);
            const allPrintersName = Object.keys(AppState.printerData.allUsbPrinters);
            // 检查是否有打印机
            if (allPrintersName.length > 0) {
                allPrintersName.forEach((name) => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.text = name;
                    select.appendChild(option);
                });
                return; // 成功则返回
            }
        }

        // 失败或无数据处理
        console.log('无打印机在线');
        const option = document.createElement('option');
        option.value = '请选择USB打印机';
        option.text = '请选择USB打印机';
        select.appendChild(option);
        alert('无打印机在线');

    } catch (error) {
        alert(error.message);
    }
}

// 扫描 Wifi 打印机
async function scanWifiPrinters() {
    const select = document.getElementById("wifi_printers");
    try {
        const res = await scanWifiPrinter();
        const { errorCode, info } = res.resultAck;
        // 解析 JSON 字符串
        if (errorCode === 0 && info && info.length > 0) {
            select.innerHTML = '';
            AppState.printerData.allPrintersNameAndPortArray = info.map(item => ({
                deviceName: item.deviceName,
                tcpPort: item.tcpPort
            }));
            AppState.printerData.allPrintersNameAndPortArray.forEach((item) => {
                const option = document.createElement('option');
                option.value = item.deviceName;
                option.text = item.deviceName + ":" + item.tcpPort;
                select.appendChild(option);
            });
            select.selectedIndex = 0;
        } else {
            throw new Error('无打印机在线');
        }
    } catch (error) {
        console.log('无打印机在线');
        select.innerHTML = '';
        const option = document.createElement('option');
        option.value = '请选择WIFI连接的打印机';
        option.text = '请选择WIFI连接的打印机';
        if (select) select.appendChild(option);
        alert(error.message || '无打印机在线');
    }
}

// 连接 USB 打印机
async function selectOnLineUsbPrinter() {
    if (!AppState.printerData.allUsbPrinters) {
        alert('未选择打印机');
        return;
    }

    const select = document.getElementById("usb_printers");
    const allPrintersName = Object.keys(AppState.printerData.allUsbPrinters);
    const allPrintersValue = Object.values(AppState.printerData.allUsbPrinters);
    // 先断开旧连接，防止状态混乱
    if (AppState.isPrinterConnected) handlePrinterDisconnect();
    try {
        // [修改] 变量名 data -> res
        const res = await selectPrinter(allPrintersName[select.selectedIndex], parseInt(allPrintersValue[select.selectedIndex]));
        const { errorCode } = res.resultAck;

        if (errorCode === 0) {
            console.log('连接成功');
            // 更新状态
            AppState.isPrinterConnected = true;
            AppState.connectedPrinterType = 'USB';
            AppState.printerName = allPrintersName[select.selectedIndex];
            refreshUI();
            // [Phase 3] 注册状态监听器 (监听开盖/缺纸)
            addPrinterStatusListener(onPrinterStatusChange);
        } else {
            throw new Error('连接失败');
        }
    } catch (error) {
        handlePrinterDisconnect();
        alert(error.message);
    }
}

// 连接 Wifi 打印机
async function selectOnLineWifiPrinter() {
    if (!AppState.printerData.allPrintersNameAndPortArray) {
        alert('未选择打印机');
        return;
    }
    const select = document.getElementById("wifi_printers");
    const item = AppState.printerData.allPrintersNameAndPortArray[select.selectedIndex];
    console.log(item);
    if (AppState.isPrinterConnected) handlePrinterDisconnect();

    try {
        const res = await connectWifiPrinter(item.deviceName, item.tcpPort);
        if (res.resultAck.errorCode === 0) {
            console.log('连接成功');
            AppState.isPrinterConnected = true;
            AppState.connectedPrinterType = 'WIFI';
            AppState.printerName = item.deviceName;
            refreshUI();
            addPrinterStatusListener(onPrinterStatusChange);
        } else {
            throw new Error('连接失败');
        }
    } catch (error) {
        handlePrinterDisconnect();
        alert(error.message);
    }
}

//批量打印
function startBatchPrintJobTest(content) {
    if (!content || content.length === 0) return;
    batchPrintJob(content.data);
}

//打印单页
function startPrintJobTest(content) {
    if (!content) return;
    batchPrintJob([content]);
}

// 预览功能
async function previewTest(content) {
    const previewImg = document.querySelector('#preview');
    if (previewImg) previewImg.remove();
    if (!content) return;
    try {
        const initRes = await InitDrawingBoard(content.InitDrawingBoardParam);
        if (initRes.resultAck.errorCode !== 0) throw new Error(initRes.resultAck.info);

        // 调用新封装的 printElements
        await printElements(content.elements);
        const previewRes = await generateImagePreviewImage(8);
        if (previewRes.resultAck.errorCode !== 0) throw new Error(previewRes.resultAck.info);
        const imageData = "data:image/jpeg;base64," + JSON.parse(previewRes.resultAck.info).ImageData;
        const img = new Image();
        img.src = imageData;
        img.id = 'preview';
        document.body.appendChild(img);
    } catch (error) {
        alert(error.message);
    }

}

// [Phase 2 新增] 核心绘图函数：线性绘制替代递归
async function printElements(elements) {
    if (!elements || elements.length === 0) return;
    for (const item of elements) {
        const json = item.json;
        let res;
        switch (item.type) {
            case 'text': res = await DrawLableText(json); break;
            case 'qrCode': res = await DrawLableQrCode(json); break;
            case 'barCode': res = await DrawLableBarCode(json); break;
            case 'line': res = await DrawLableLine(json); break;
            case 'graph': res = await DrawLableGraph(json); break;
            case 'image': res = await DrawLableImage(json); break;
            default: console.warn('未知元素:', item.type); continue;
        }
        if (res && res.resultAck && res.resultAck.errorCode !== 0) {
            throw new Error(`绘制 ${item.type} 失败: ${res.resultAck.info}`);
        }
    }
}

// 单页发送逻辑 (仅发送数据，不处理进度)
async function sendPageData(list, x) {
    try {
        console.log("准备绘制第 " + (x + 1) + " 页");
        const pageData = list[x];
        // 1. 初始化画板
        const initRes = await InitDrawingBoard(pageData.InitDrawingBoardParam);
        if (initRes.resultAck.errorCode !== 0) throw new Error(initRes.resultAck.info);
        // 2. 绘制元素
        await printElements(pageData.elements);
        // 3. 提交任务 (此时只是发送，成功后等待监听器收到 OK 信号)
        const commitRes = await commitJob(null, JSON.stringify(jsonObj));
        if (commitRes.resultAck.errorCode !== 0) throw new Error(commitRes.resultAck.info);
    } catch (error) {
        alert(error.message);
    }

}

/**
 * 批量打印流程 (事件驱动模式)
 * 
 * 流程说明：
 * 1. 调用 startJob 开启任务。
 * 2. startJob 成功后，SDK 会自动上报一次 "commitJob ok!" (表示就绪)。
 * 3. 监听器收到 "commitJob ok!" 后，发送当前页数据 (sendPageData)。
 * 4. 发送成功后，打印机处理，处理完再次上报 "commitJob ok!"，触发下一页。
 * 5. 所有页面发送完毕，且收到完成信号后，调用 endJob。
 */
async function batchPrintJob(list) {
    if (list == null || list.length === 0) {
        return;
    }
    // 读取配置
    const printQuantity = jsonObj.printerImageProcessingInfo.printQuantity;
    // 获取打印参数
    const density = AppState.uiElements.selectDensity ? parseInt(AppState.uiElements.selectDensity.value) : 3;
    let labelType = 1;
    if (AppState.uiElements.selectLabelType) {
        const typeMap = { '间隙纸': 1, '黑标纸': 2, '连续纸': 3, '定孔纸': 4, '透明纸': 5, '标牌': 6, '黑标间隙纸': 10 };
        labelType = typeMap[AppState.uiElements.selectLabelType.value] || 1;
    }
    //[修改] 优化打印模式写法
    let printMode = 1;
    if (AppState.uiElements.selectPrintMode) {
        printMode = AppState.uiElements.selectPrintMode.value === '热转印模式' ? 2 : 1;
    }
    console.log(`打印配置: 浓度=${density}, 类型=${labelType}, 模式=${printMode}, 总张数=${list.length * printQuantity}`);
    // 注册监听器以获取进度
    let progressListener = null
    let currentIndex = 0;
    console.log("list", list.length)
    progressListener = async (msg) => {
        if (msg.apiName === 'commitJob' && msg.resultAck.info === 'commitJob ok!') {
            // 1. 处理 "commitJob ok!" 信号
            // 含义：上一张数据接收完毕，打印机准备好接收下一张
            // 注意：startJob 成功后，服务端会自动推送一次 commitJob ok! 来触发第一张
            if (currentIndex < list.length) {
                try {
                    await sendPageData(list, currentIndex);
                    currentIndex++
                } catch (e) {
                    alert(e.message);
                    removeJobListener(progressListener);
                }
            }
        } else if (msg.apiName === 'commitJob' && msg.resultAck.printCopies !== undefined) {
            //结束任务
            console.log(`进度：第${msg.resultAck.printPages}页，第${msg.resultAck.printCopies}份`);
            if (msg.resultAck.printCopies === printQuantity && msg.resultAck.printPages === list.length) {
                try {
                    const endRes = await endJob();
                    if (endRes.resultAck.errorCode !== 0) throw new Error(endRes.resultAck.info);
                    console.log("打印任务全部完成");
                } catch (e) {
                    alert(e.message);
                } finally {
                    // 任务结束，必须移除监听器
                    removeJobListener(progressListener);
                }
            }
        } else if (msg.apiName === 'commitJob' && msg.resultAck.errorCode !== 0) {
            // 3. 处理异常
            alert("打印出错: " + msg.resultAck.info);
            removeJobListener(progressListener)
        }
    };
    addJobListener(progressListener);
    try {
        // 1. 开启任务
        const startRes = await startJob(density, labelType, printMode, list.length * printQuantity);
        if (startRes.resultAck.errorCode !== 0) throw new Error(startRes.resultAck.info);
    } catch (error) {
        alert(error.message);
        // 启动失败则立即移除监听
        removeJobListener(progressListener);
    }
}

function printerDetails(printModel) {
    let model = getPrinterConfig(printModel);
    let printMode = model.printMode.join('、');
    let densityRange = `${model.densityRange.min}-${model.densityRange.max}，建议值为${model.densityRange.default}`;
    let labelType = model.labelType.join('、');
    alert(`${printModel}支持范围说明:\n打印模式支持：${printMode}\n打印浓度范围：${densityRange}\n打印纸张类型支持：${labelType}`);
}

function getPrinterConfig(model) {
    return models[model] || models['B3S']; // 默认配置
}

