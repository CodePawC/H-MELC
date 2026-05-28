import Socket from './Socket'; // Assuming @/utils maps to ./utils
import NMPrintSocket from './Print'; // Assuming @/utils maps to ./utils
import { textPrintData } from './printData/Text';
import { barcodePrintData } from './printData/Barcode';
import { qrCodePrintData } from './printData/QrCode';
import { linePrintData } from './printData/Line';
import { graphPrintData } from './printData/Graph';
import { imgPrintData } from './printData/Img';
import { combinationPrintData } from './printData/Combination';
import { batchPrintData } from './printData/Batch';

/**
 * 打印机信息接口，用于存储打印机设备名和端口号映射关系
 */
export interface Printer {
    [key: string]: string;
}

/**
 * Wifi打印机信息接口，包含设备名称、TCP端口和IP地址（可选）
 */
export interface WifiPrinterInfo {
    deviceName: string;
    tcpPort: number;
    ipAddress?: string; // 可选字段，根据实际扫描结果决定
}

/**
 * HomeLogic类核心功能：
 * 1. 管理打印机连接状态
 * 2. 处理打印任务配置
 * 3. 维护React组件状态同步
 * 4. 提供打印预览功能
 */
export class HomeLogic {
    /**
     * 预览图像Base64数据（仅当预览功能激活时有值）
     */
    public previewImage: string | null = null;

    /**
     * 打印参数配置对象，包含以下核心字段：
     * - printerImageProcessingInfo: 图像处理配置
     * - printQuantity: 打印份数（默认1份）
     */
    public jsonObj = {
        printerImageProcessingInfo: {
            printQuantity: 1,
        },
    };

    /**
     * 自动关机时间设置（枚举类型）
     * 可选值：1|2|3|4（对应不同关机档位）
     */
    public auto_shut_down: 1 | 2 | 3 | 4 = 1;

    /**
     * 打印任务状态标志
     * 用于判断SDK是否已初始化
     */
    public initBool: boolean = false;

    /**
     * 打印任务配置参数
     * - density: 打印密度
     * - label_type: 标签类型
     * - print_mode: 打印模式
     */
    public density: number = 3;
    public label_type: number = 1;
    public print_mode: number = 1;

    /**
     * 打印任务错误标志
     * 用于记录打印过程中是否发生错误
     */
    public isPrintError: boolean = false;

    /**
     * 打印任务套接字状态标志
     * 用于判断打印服务是否已开启
     */
    public printSocketOpen: boolean = false;

    /**
     * 打印任务套接字实例
     * 用于与打印机进行通信
     */
    public socketData: Socket | null = null;

    /**
     * 打印任务套接字实例
     * 用于与打印机进行通信
     */
    public nMPrintSocket: NMPrintSocket | null = null;

    /**
     * USB打印机列表
     * 存储所有已发现的USB打印机设备名和端口号映射关系
     */
    public usbPrinters: Printer = {};

    /**
     * Wifi打印机列表
     * 存储所有已发现的Wifi打印机设备名和端口号映射关系
     */
    public wifiPrinters: Printer = {}; // Store as { deviceName: tcpPort.toString() }

    /**
     * USB打印机在线状态标志
     * 用于判断是否有USB打印机在线
     */
    public onlineUsbBool: boolean = false;

    /**
     * Wifi打印机在线状态标志
     * 用于判断是否有Wifi打印机在线
     */
    public onlineWifiBool: boolean = false;

    /**
     * 选中的USB打印机设备名
     * 用于记录用户选择的USB打印机
     */
    public usbSelectPrinter: string = "";

    /**
     * 选中的Wifi打印机设备名
     * 用于记录用户选择的Wifi打印机
     */
    public wifiSelectPrinter: string = "";

    /**
     * Wifi网络名称
     * 用于配置打印机连接的Wifi网络
     */
    public wifiName: string = "";

    /**
     * Wifi网络密码
     * 用于配置打印机连接的Wifi网络
     */
    public wifiPassword: string = "";

    private _updateReactState: () => void;

    constructor(updateReactState: () => void) {
        this._updateReactState = updateReactState;
    }

    /**
     * 初始化连接打印服务，并注册打印机状态回调
     * 创建Socket实例并注册状态回调
     */
    public initialize(): void {

        this.socketData = new Socket();
        this.socketData.open(
            async (openBool) => {
                console.log("openBool1");
                // 更新套接字连接状态
                this.printSocketOpen = openBool;
                this._updateReactState();
            },
            (msg: any) => {
                // 处理设备状态回调
                if (msg.resultAck.callback !== undefined) {
                    const callbackName = msg.resultAck.callback.name;
                    const msgInfo = msg.resultAck.info;
                    if (callbackName === "onCoverStatusChange") {
                        console.log("盒盖状态", msgInfo.capStatus);
                    } else if (callbackName === "onElectricityChange") {
                        console.log("电池电量等级", msgInfo.power);
                    }
                }
            }
        );
        this.nMPrintSocket = new NMPrintSocket(this.socketData);
        this._updateReactState();
    }
    
    /**
     * 获取所有USB打印机
     * 通过API调用获取所有已连接的USB打印机
     */
    public async getPrinters(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            // alert("打印服务未开启");
            console.log("打印服务未开启");
            return;
        }
        console.log("开始获取打印机");
        try {
            const allPrintersRes = await this.nMPrintSocket.getAllPrinters();
            console.log(allPrintersRes, "allPrintersRes");
            if (allPrintersRes.resultAck.errorCode === 0) {
                const allPrinters = JSON.parse(allPrintersRes.resultAck.info);
                this.usbPrinters = { ...allPrinters };
                this.usbSelectPrinter = Object.keys(this.usbPrinters)[0] || "";
                console.log("printers", this.usbPrinters);
            } else {
                this.usbPrinters = {};
                this.usbSelectPrinter = "";
                alert("没有在线的USB打印机");
            }
        } catch (err) {
            console.error(err);
            this.usbPrinters = {};
            this.usbSelectPrinter = "";
            alert("获取USB打印机列表失败");
        }
        this._updateReactState();
    }

    /**
     * 扫描所有Wifi打印机
     * 通过API调用扫描所有可用的Wifi打印机
     */
    public async scanWifiPrinters(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            alert("打印服务未开启");
            return;
        }
        try {
            const allPrintersRes = await this.nMPrintSocket.scanWifiPrinter();
            console.log("allPrintersRes", allPrintersRes);
            const errorCode = allPrintersRes.resultAck.errorCode;
            if (errorCode === 0) {
                const allPrinters: WifiPrinterInfo[] = allPrintersRes.resultAck.info;
                this.wifiPrinters = {};
                allPrinters.forEach((item) => {
                    this.wifiPrinters[item.deviceName] = item.tcpPort.toString();
                });
                console.log("wifiPrinters", this.wifiPrinters);
                this.wifiSelectPrinter = Object.keys(this.wifiPrinters)[0] || "";
                console.log("wifiSelectPrinter", this.wifiSelectPrinter);
            } else {
                this.wifiPrinters = {};
                this.wifiSelectPrinter = "";
                alert("没有在线的Wifi打印机");
            }
        } catch (err) {
            console.error(err);
            this.wifiPrinters = {};
            this.wifiSelectPrinter = "";
            alert("扫描Wifi打印机列表失败");
        }
        this._updateReactState();
    }

    /**
     * 获取当前打印机的Wifi配置信息
     * 通过API调用获取打印机的Wifi配置信息
     */
    public async getWifiConfigurationInfo(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        try {
            const wifiInfo = await this.nMPrintSocket.getWifiConfiguration();
            const errorCode = wifiInfo.resultAck.errorCode; // Assuming errorCode is a number directly

            if (errorCode === 0) {
                const info = JSON.parse(wifiInfo.resultAck.info);
                console.log("wifiInfo", info);
                alert("wifiInfo:" + JSON.stringify(info));
            } else {
                alert("wifiInfo:获取失败，错误码：" + errorCode);
            }
        } catch (err) {
            console.error(err);
            alert("获取Wifi配置信息异常");
        }
    }

    /**
     * 连接选中的Wifi打印机
     * 通过API调用连接用户选择的Wifi打印机
     */
    public async selectOnLineWifiPrinter(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        if (!this.wifiSelectPrinter || !this.wifiPrinters[this.wifiSelectPrinter]) {
            alert("请先选择一个有效的Wifi打印机");
            return;
        }
        try {
            const wifiConnectRes = await this.nMPrintSocket.connectWifiPrinter(
                this.wifiSelectPrinter,
                parseInt(this.wifiPrinters[this.wifiSelectPrinter])
            );
            const result = JSON.parse(wifiConnectRes.resultAck.errorCode);
            if (result) {
                console.log("Wifi打印机连接成功");
                this.onlineWifiBool = true;
                this.onlineUsbBool = false;
            } else {
                console.log("Wifi打印机连接失败");
                this.onlineWifiBool = false;
                alert("Wifi打印机连接失败");
            }
            console.log("wifiConnectRes", wifiConnectRes);
        } catch (err) {
            console.error(err);
            this.onlineWifiBool = false;
            alert("连接Wifi打印机异常");
        }
        this._updateReactState();
    }

    /**
     * 配置打印机的Wifi网络
     * 通过API调用配置打印机的Wifi网络
     */
    public async setWifiConfiguration(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        try {
            if (this.wifiName.trim() !== "") {
                const wifiConfigurationResult = await this.nMPrintSocket.configurationWifi(
                    this.wifiName.trim(),
                    this.wifiPassword.trim()
                );
                console.log("wifiConfigurationResult", wifiConfigurationResult);
                const errorCode = wifiConfigurationResult.resultAck.errorCode;
                if (errorCode === 0) {
                    alert("网络配置成功，请断开USB线缆后使用WIFI搜索连接打印机（PC需要和打印机在同一网络）");
                } else {
                    alert("网络配置失败，错误码：" + errorCode);
                }
            } else {
                alert("wifi名称不得为空");
            }
        } catch (err) {
            console.error(err);
            alert("配置Wifi网络异常");
        }
    }

    /**
     * 连接选中的USB打印机
     * 通过API调用连接用户选择的USB打印机
     */
    public async selectOnLineUsbPrinter(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        if (!this.usbSelectPrinter) {
            alert("请先选择一个USB打印机");
            return;
        }
        try {
            console.log("this.usbSelectPrinter", this.usbSelectPrinter);
            console.log("this.usbPrinters[this.usbSelectPrinter]", this.usbPrinters[this.usbSelectPrinter]);
            const usbConnectRes = await this.nMPrintSocket.selectPrinter(this.usbSelectPrinter, parseInt(this.usbPrinters[this.usbSelectPrinter]));
            const result = JSON.parse(usbConnectRes.resultAck.errorCode);
            console.log("result", result);
            if (result === 0) {
                console.log("USB打印机连接成功");
                this.onlineUsbBool = true;
                this.onlineWifiBool = false;
            } else {
                console.log("USB打印机连接失败");
                this.onlineUsbBool = false;
                alert("USB打印机连接失败");
            }
            console.log("usbConnectRes", usbConnectRes);
        } catch (err) {
            console.error(err);
            this.onlineUsbBool = false;
            alert("连接USB打印机异常");
        }
        this._updateReactState();
    }

    /**
     * 初始化SDK
     * 通过API调用初始化SDK
     */
    public async init(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        if (!this.onlineUsbBool && !this.onlineWifiBool) {
            return alert("打印机未连接");
        }
        try {
            const initRes = await this.nMPrintSocket.initSdk({ fontDir: "" });
            const result = JSON.parse(initRes.resultAck.errorCode);
            if (result === 0) {
                this.initBool = true;
                console.log("SDK初始化成功");
            } else {
                this.initBool = false;
                console.log("SDK初始化失败");
                alert("SDK初始化失败");
            }
        } catch (err) {
            console.error(err);
            this.initBool = false;
            alert("SDK初始化异常");
        }
        this._updateReactState();
    }

    /**
     * 设置自动关机时间
     * 包含输入验证和API调用
     * @param value - 用户输入的档位值（字符串）
     */
    public setAutoShutDown = (value: string) => {
        const num = parseInt(value);
        if ([1, 2, 3, 4].includes(num)) {
            // 类型安全转换
            this.auto_shut_down = num as 1 | 2 | 3 | 4;
            this._updateReactState();
            // 同步调用API设置
            this.setPrinterAutoShutDownTime().then(r => console.log("设置自动关机时间成功"));
        } else {
            // 非法值处理
            console.error("Invalid auto shutdown value. Must be 1, 2, 3, or 4");
            alert("自动关机时间档位必须为1、2、3或4");
        }
    };

    /**
     * 设置自动关机时间
     * 通过API调用设置打印机的自动关机时间
     */
    public async setPrinterAutoShutDownTime(): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        if (!this.onlineUsbBool && !this.onlineWifiBool) {
            return alert("打印机未连接");
        }
        try {

            const res = await this.nMPrintSocket.setPrinterAutoShutDownTime(this.auto_shut_down);
            const result = JSON.parse(res.resultAck.errorCode);
            if (result) {
                alert("自动关机时间设置成功");
            } else {
                alert("自动关机时间设置失败");
            }
        } catch (err) {
            console.error(err);
            alert("设置自动关机时间异常");
        }
    }

    /**
     * 显示打印机详细信息
     * 用于展示打印机的详细信息和参数范围
     * @param model - 打印机型号
     */
    public printerDetails(model: string): void {
        switch (model) {
            case "B3S":
                alert(
                    "B3S支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、连续纸、透明纸"
                );
                break;
            case "B1":
                alert(
                    "B1支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸"
                );
                break;
            case "B203":
                alert(
                    "B203支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸"
                );
                break;
            case "B21":
                alert(
                    "B21支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、连续纸、透明纸"
                );
                break;
            case "D11/D101/D110/B16":
                alert(
                    "D11/D101/D110/B16支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-3，建议值为2\n打印纸张类型支持：间隙纸、透明纸"
                );
                break;
            case "B32":
                alert(
                    "B32支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-15，建议值为8\n打印纸张类型支持：间隙纸、透明纸"
                );
                break;
            case "Z401":
                alert(
                    "Z401支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-15，建议值为8\n打印纸张类型支持：间隙纸、透明纸"
                );
                break;
            case "B50/B50W":
                alert(
                    "B50/B50W支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-15，建议值为8\n打印纸张类型支持：间隙纸"
                );
                break;
            case "B18":
                alert(
                    "B18支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-3，建议值为2\n打印纸张类型支持：间隙纸"
                );
                break;
            case "K2":
                alert(
                    "K2:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸"
                );
                break;
            case "K3/K3W":
                alert(
                    "K3/K3W支持范围说明:\n打印模式支持：热敏\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸"
                );
                break;
            case "M2":
                alert(
                    "M2支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸、黑标间隙纸"
                );
            case "M3":
                alert(
                    "M3支持范围说明:\n打印模式支持：热转印\n打印浓度范围：1-5，建议值为3\n打印纸张类型支持：间隙纸、黑标纸、透明纸、黑标间隙纸"
                );
                break;
            default:
                break;
        }
    }

    /**
     * 初始化打印画布
     * 通过API调用初始化打印画布
     * @param params - 画布初始化参数
     * @returns 是否初始化成功
     */
    private async initCanvas(params: String): Promise<boolean> {
        if (!this.printSocketOpen || !this.nMPrintSocket || !this.initBool) {
            return false;
        }
        console.log("初始化打印画布");
        try {
            const res = await this.nMPrintSocket.InitDrawingBoard(params);
            return res.resultAck.errorCode === 0;

        } catch (err) {
            console.error('画布初始化错误:', err);
            return false;
        }
    }

    /**
     * 打印元素处理方法
     * 支持多种打印元素类型，按顺序执行绘制操作
     * @param elements - 打印元素数组
     * @returns 是否全部元素处理成功
     */
    private async processPrintElements(elements: any[]): Promise<boolean> {
        if (!this.nMPrintSocket) return false;
        console.log("elements", elements);
        for (const element of elements) {
            let res;
            switch (element.type) {
                case "text": // 文本打印
                    res = await this.nMPrintSocket.DrawLabelText(element.json);
                    break;
                case "qrCode": // 二维码打印
                    res = await this.nMPrintSocket.DrawLabelQrCode(element.json);
                    break;
                case "barCode": // 条形码打印
                    res = await this.nMPrintSocket.DrawLabelBarCode(element.json);
                    break;
                case "line": // 线条绘制
                    res = await this.nMPrintSocket.DrawLabelLine(element.json);
                    break;
                case "graph": // 图形绘制
                    res = await this.nMPrintSocket.DrawLabelGraph(element.json);
                    break;
                case "image": // 图像打印
                    res = await this.nMPrintSocket.DrawLabelImage(element.json);
                    break;
                default:
                    console.error("Unsupported element type:", element.type);
                    return false;
            }
            if (parseInt(JSON.parse(res.resultAck.errorCode)) !== 0) {
                console.error(`Failed to draw ${element.type}:`, res);
                return false;
            }
        }
        return true;
    }

    /**
     * 开始打印任务
     * 通过API调用开始打印任务
     * @param printData - 打印数据对象
     * @param isBatch - 是否为批量打印任务
     */
    public async startPrintJobTest(printData: any): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }

        let contentArr = [];
        contentArr.push(printData);
        this.batchPrintJob(contentArr);

    }


    /**
     * 开始批量打印任务
     * 通过API调用开始批量打印任务
     * @param printData - 打印数据对象
     */
    public async startBatchPrintJobTest(printData: any): Promise<void> {
        if (!this.printSocketOpen) return alert("打印服务未开启");
      if (printData == null || printData.length == 0) {
        return;
      }
     
        return  this.batchPrintJob(printData.data);
    }


    //批量打印列表数据
    public async batchPrintJob(list: any): Promise<void> {
        const printQuantity = this.jsonObj.printerImageProcessingInfo.printQuantity;
        this.isPrintError = false;

        let printListener: any = null;
        const cleanupListener = () => {
            if (printListener && this.nMPrintSocket) {
                this.nMPrintSocket.removePrintListener(printListener);
                printListener = null;
            }
        };

        try {
            cleanupListener();
            let pageIndex = 0;

            // 创建打印策略工厂
            const strategyFactory = {
                handleCommitSuccess: async () => {
                    console.log("提交打印任务", pageIndex);
                    if (this.isPrintError) return;
                    if (pageIndex < list.length) {
                        await this.printTag(list, pageIndex);
                        pageIndex++;
                        console.log("提交打印任务成功", pageIndex);
                    }
                },
                handleProgressUpdate: (resultAck: any) => {
                    console.log('打印进度更新', {
                        当前进度: `第${resultAck.printPages}页,第${resultAck.printCopies}份`,
                        总页数: list.length,
                        完成长度: resultAck.onPrintPageLengthCompleted
                    });
                },
                handleCompletion: async () => {
                    if (!this.nMPrintSocket) return;
                    const endRes = await this.nMPrintSocket.endJob();
                    if (endRes.resultAck.errorCode === 0) {
                        console.log("打印完成");
                    }


                    cleanupListener();

                },
                handleError: (msg: any) => {
                    this.isPrintError = true;
                    cleanupListener();
                    alert(`打印错误: ${msg.resultAck.info}`);
                }
            };
            if (!this.nMPrintSocket) return;
            printListener = this.nMPrintSocket.addPrintListener(async (msg) => {
                const resultAck = msg?.resultAck;

                if (resultAck?.errorCode === 0 && resultAck?.info === "commitJob ok!") {
                    await strategyFactory.handleCommitSuccess();
                }
                //已接入历史版本客户仍可以使用printQuantity和onPrintPageCompleted字段获取打印进度

                if (resultAck?.printCopies != null && resultAck?.printPages != null) {
                    strategyFactory.handleProgressUpdate(resultAck);
                }

                if (resultAck?.printCopies === printQuantity &&
                    resultAck?.printPages === list.length) {
                    await strategyFactory.handleCompletion();
                }

                if (resultAck?.errorCode !== 0) {
                    strategyFactory.handleError(msg);
                }
            });

            console.log("this.density", this.density);
            console.log("this.label_type", this.label_type);
            console.log("this.print_mode", this.print_mode);
            console.log("list.length * printQuantity",list.length * printQuantity);
            const startRes = await this.nMPrintSocket.startJob(
                this.density,
                this.label_type,
                this.print_mode,
                list.length * printQuantity
            );

            if (startRes.resultAck.errorCode !== 0) {
                cleanupListener();
            }
        } catch (err) {
            console.error(err);
            cleanupListener();
        }
    }

    // 绘制打印标签
    async printTag(list: any, x: number) {
        //设置画布尺寸
        try {
            console.log("打印标签-initCanvas");
            await this.initCanvas(list[x].InitDrawingBoardParam);
            // 提交打印任务
            console.log("打印标签-processPrintElements");
            await this.processPrintElements(list[x].elements);
            this.commitPrintJob();

        } catch (err) {
            console.error(err);
        }
    }

    public async commitPrintJob() {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        this.nMPrintSocket.commitJob(undefined, JSON.stringify(this.jsonObj));
    }

    /**
     * 生成打印预览图像
     * 通过API调用生成打印预览图像
     * @param printData - 打印数据对象
     */
    public async handlePreview(printData: any): Promise<void> {
        if (!this.printSocketOpen || !this.nMPrintSocket) {
            return alert("打印服务未开启");
        }
        if (!this.initBool) {
            return alert("SDK未初始化");
        }

        try {
            const initCanvasRes = await this.initCanvas(printData.InitDrawingBoardParam)
            if (!initCanvasRes) {
                alert("初始化画布失败");
                return;
            }
            const elementsProcessed = await this.processPrintElements(printData.elements);
            if (!elementsProcessed) {
                alert("处理打印预览元素失败");
                return;
            }

            const previewRes = await this.nMPrintSocket.generateImagePreviewImage(8);
            if (previewRes.resultAck.errorCode === 0 && previewRes.resultAck.info) {
                const imageData = JSON.parse(previewRes.resultAck.info).ImageData
                this.previewImage = "data:image/png;base64," + imageData;
                // alert("预览图已生成");
                console.log("预览图已生成");
            } else {
                this.previewImage = null;
                alert("获取预览图失败");
            }
        } catch (err) {
            console.error(err);
            this.previewImage = null;
            alert("打印预览异常");
        }
        this._updateReactState();
    }

    // Update methods for React state
    public setDensity = (value: string) => {
        this.density = parseInt(value);
        this._updateReactState();
    };
    public setLabelType = (value: string) => {
        this.label_type = parseInt(value);
        this._updateReactState();
    };
    public setPrintMode = (value: string) => {
        this.print_mode = parseInt(value);
        this._updateReactState();
    };
    public setWifiName = (value: string) => {
        this.wifiName = value;
        this._updateReactState();
    };
    public setWifiPassword = (value: string) => {
        this.wifiPassword = value;
        this._updateReactState();
    };
    public setUsbSelectPrinter = (value: string) => {
        this.usbSelectPrinter = value;
        this._updateReactState();
    };
    public setWifiSelectPrinter = (value: string) => {
        this.wifiSelectPrinter = value;
        this._updateReactState();
    };
}
