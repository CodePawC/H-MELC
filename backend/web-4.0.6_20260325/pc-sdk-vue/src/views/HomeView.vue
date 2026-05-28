<template>
  <div class="container">
    <h1>精臣打印SDK演示</h1>
    <div class="print_init">
      <h3>打印机初始化：</h3>
      <div class="content">
        <div class="service">
          <p class="service_status status">
            打印服务状态：{{ !printSocketOpen ? "未" : "已" }}连接
          </p>
        </div>
        <div class="select_usb">
          <div class="select_printer status">
            <label>选择USB打印机:</label>
            <select v-model="usbSelectPrinter" name="usbPrinters">
              <option value="" disabled v-if="!Object.keys(usbPrinters).length">
                请选择USB打印机
              </option>
              <option v-for="(value, name) in usbPrinters" :value="name" :key="name">
                {{ name }}: {{ value }}
              </option>
            </select>
          </div>
          <button class="getPrinters" @click="getPrinters()" type="button">
            更新USB打印机列表
          </button>
        </div>

        <div class="connect_usb">
          <p class="usb_printer_connect_status status">
            打印机连接状态：USB打印机{{ !onlineUsbBool ? "未" : "已" }}连接
          </p>
          <button class="connect_printer" @click="selectOnLineUsbPrinter()" type="button">
            连接USB打印机
          </button>
        </div>

        <div class="select_wifi">
          <div class="select_printer status">
            <label>选择wifi打印机:</label>
            <select v-model="wifiSelectPrinter" name="wifiPrinters">
              <option value="" disabled v-if="!Object.keys(wifiPrinters).length">
                请选择Wifi打印机
              </option>
              <option v-for="(value, name) in wifiPrinters" :value="name" :key="name">
                {{ name }}: {{ value }}
              </option>
            </select>
          </div>
          <button class="scanWifiPrinters" @click="scanWifiPrinters()" type="button">
            更新Wifi打印机列表
          </button>
        </div>
        <div class="connect_wifi">
          <p class="wifi_printer_connect_status status">
            打印机连接状态：Wifi打印机{{ !onlineWifiBool ? "未" : "已" }}连接
          </p>
          <button class="connect_printer" @click="selectOnLineWifiPrinter()" type="button">
            连接Wifi打印机
          </button>
        </div>

        <div class="init">
          <div class="init_content">
            <p class="init_status status">
              SDK初始化状态：{{ !initBool ? "未" : "已" }}初始化
            </p>
            <button class="init_sdk status" @click="init()" type="button">
              初始化SDK
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="print_settings">
      <h3>打印设置：</h3>
      <div class="content">
        <h5>打印前请设置对应的参数:</h5>
        <p>
          点击查看对应机型的参数范围及建议参数:
          <span class="printer_model" @click="printerDetails('B3S')">B3S</span>、
          <span class="printer_model" @click="printerDetails('B1')">B1</span>、
          <span class="printer_model" @click="printerDetails('B203')">B203</span>、
          <span class="printer_model" @click="printerDetails('B21')">B21</span>、
          <span class="printer_model" @click="printerDetails('D11/D101/D110/B16')">D11/D101/D110/B16</span>、
          <span class="printer_model" @click="printerDetails('B32')">B32</span>、
          <span class="printer_model" @click="printerDetails('Z401')">Z401</span>、
          <span class="printer_model" @click="printerDetails('B50/B50W')">B50/B50W</span>、
          <span class="printer_model" @click="printerDetails('B18')">B18</span>、
          <span class="printer_model" onclick="printerDetails('K2')">K2</span>、
          <span class="printer_model" onclick="printerDetails('K3/K3W')">K3/K3W</span>、
          <span class="printer_model" onclick="printerDetails('M2')">M2</span>、
          <span class="printer_model" onclick="printerDetails('M3')">M3</span>
        </p>
        <label>选择打印浓度:</label>
        <select v-model="density" name="density">
          <option v-for="item in 15" :key="item" :value="item">
            {{ item }}
          </option>
        </select>

        <label style="margin-left: 16px">选择纸张类型:</label>
        <select v-model="label_type" name="label_type">
          <option :value="1">间隙纸</option>
          <option :value="2">黑标纸</option>
          <option :value="3">连续纸</option>
          <option :value="4">过孔纸</option>
          <option :value="5">透明纸</option>
          <option :value="6">标牌</option>
          <option :value="10">黑标间隙纸</option>
        </select>

        <label style="margin-left: 16px">选择打印模式:</label>
        <select v-model="print_mode" name="print_mode">
          <option :value="1">热敏模式</option>
          <option :value="2">热转印模式</option>
        </select>

        <label style="margin-left: 16px">自动关机时间：</label>
        <select v-model="auto_shut_down" name="auto_shut_down" @change="setPrinterAutoShutDownTime">
          <option v-for="item in 5" :key="item" :value="item">
            {{ item }}挡
          </option>
        </select>
        <div class="wifi_printer_setting">
          <h5>WIFI打印机网络配置及信息查询:</h5>
          <p>
            1.打印机仅支持2.4G Wifi网络<br />2.请在USB连接成功后进行网络设置
          </p>
          <form>
            <input type="text" placeholder="请输入Wifi名称" id="wifi_name" v-model="wifiName" />
            <input type="text" placeholder="请输入Wifi密码" id="wifi_password" v-model="wifiPassword" />
          </form>
          <div class="setOrGet">
            <button @click="setWifiConfiguration()" type="button">
              配置打印机wifi网络（仅K3W支持）
            </button>
            <button @click="getWifiConfigurationInfo()" type="button">
              获取wifi配置信息（仅K3W支持）
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="print_related">
      <h3>打印相关：</h3>
      <div class="content">
        <button class="print_label" @click="startPrintJobTest(textPrintData)" type="button">
          文本打印(40-60)
        </button>
        <button class="print_label" @click="handlePreview(textPrintData)" type="button">
          文本打印预览(40-60)
        </button>
        <button class="print_label" @click="startPrintJobTest(barcodePrintData)" type="button">
          一维码打印(40-20)
        </button>
        <button class="print_label" @click="handlePreview(barcodePrintData)" type="button">
          一维码打印预览(40-20)
        </button>
        <button class="print_label" @click="startPrintJobTest(qrCodePrintData)" type="button">
          二维码打印(30-30)
        </button>
        <button class="print_label" @click="handlePreview(qrCodePrintData)" type="button">
          二维码打印预览(30-30)
        </button>
        <button class="print_label" @click="startPrintJobTest(linePrintData)" type="button">
          线条打印(40-20)
        </button>
        <button class="print_label" @click="handlePreview(linePrintData)" type="button">
          线条打印预览(40-20)
        </button>
        <button class="print_label" @click="startPrintJobTest(graphPrintData)" type="button">
          图形打印（矩形、圆形）（40-20）
        </button>
        <button class="print_label" @click="handlePreview(graphPrintData)" type="button">
          图形打印（矩形、圆形）预览（40-20）
        </button>
        <button class="print_label" @click="startPrintJobTest(imgPrintData)" type="button">
          图片打印（50-30）
        </button>
        <button class="print_label" @click="handlePreview(imgPrintData)" type="button">
          图片打印预览（50-30）
        </button>
        <button class="print_label" @click="startPrintJobTest(combinationPrintData)" type="button">
          多元素组合打印（50-30）
        </button>
        <button class="print_label" @click="handlePreview(combinationPrintData)" type="button">
          多元素组合打印预览（50-30）
        </button>
        <button class="print_label" @click="startBatchPrintJobTest(batchPrintData, false)" type="button">
          批量打印（50-30）
        </button>


      </div>
    </div>

    <div class="preview_container" v-if="previewImage">
      <img :src="previewImage" alt="打印预览图" />
    </div>
  </div>
</template>

<script>
import Socket from "@/utils/Socket";
import NMPrintSocket from "@/utils/Print";
import { textPrintData } from "@/utils/printData/Text";
import { barcodePrintData } from "@/utils/printData/Barcode";
import { qrCodePrintData } from "@/utils/printData/QrCode";
import { linePrintData } from "@/utils/printData/Line";
import { graphPrintData } from "@/utils/printData/Graph";
import { imgPrintData } from "@/utils/printData/Img";
import { combinationPrintData } from "@/utils/printData/Combination";
import { batchPrintData } from "@/utils/printData/Batch";
export default {
  name: "HomeView",
  data() {
    const jsonObj = {
      printerImageProcessingInfo: {
        printQuantity: 1,
      },
    };
    return {
      //预览图形
      previewImage: null,
      textPrintData,
      barcodePrintData,
      qrCodePrintData,
      linePrintData,
      graphPrintData,
      imgPrintData,
      combinationPrintData,
      batchPrintData,
      jsonObj,
      // 打印服务实例（新增）
      socketData: null,
      // 打印是否错误（新增）
      isPrintError: false,
      // 打印服务是否连接成功
      printSocketOpen: false,
      nMPrintSocket: null,
      usbPrinters: {},
      wifiPrinters: {},
      onlineUsbBool: false,
      onlineWifiBool: false,
      usbSelectPrinter: "",
      wifiSelectPrinter: "",
      initBool: false,
      density: 3,
      label_type: 1,
      print_mode: 1,
      auto_shut_down: 1,
      wifiName: "",
      wifiPassword: "",
    };
  },
  mounted() {
    // 创建socket实例
    this.socketData = new Socket("ws://127.0.0.1:37989");

    this.socketData.open(
      (openBool) => {
        console.log(openBool, "openBool");
        this.printSocketOpen = openBool;
      },
      (msg) => {
        if (msg.resultAck.callback != undefined) {
          const callbackName = msg.resultAck.callback.name;
          const msgInfo = msg.resultAck.info;
          if (callbackName == "onCoverStatusChange") {
            //盒盖状态：0-闭合、1-打开
            console.log("盒盖状态", msgInfo.capStatus);
          } else if (callbackName == "onElectricityChange") {
            //"power" : 0-4, // 电池电量等级（共5档）
            console.log("电池电量等级", msgInfo.power);
          }
        }
      }
    );
    // 创建打印实例
    this.nMPrintSocket = new NMPrintSocket(this.socketData);
  },
  methods: {
    //更新打印机列表
    async getPrinters() {
      if (!this.printSocketOpen) {
        return alert("打印服务未开启");
      }
      console.log("开始获取打印机");
      try {
        const allPrintersRes = await this.nMPrintSocket.getAllPrinters();
        console.log(allPrintersRes, "allPrintersRes");
        if (allPrintersRes.resultAck.errorCode === 0) {
          const allPrinters = JSON.parse(allPrintersRes.resultAck.info);
          this.usbPrinters = { ...allPrinters };
          this.usbSelectPrinter = Object.keys(this.usbPrinters)[0];
          console.log("printers", this.usbPrinters);
        } else {
          alert("没有在线的打印机");
        }
      } catch (err) {
        console.error(err);
      }
    },
    async scanWifiPrinters() {
      const allPrintersRes = await this.nMPrintSocket.scanWifiPrinter();
      console.log("allPrintersRes", allPrintersRes);
      const errorCode = allPrintersRes.resultAck.errorCode;
      //处理搜索结果
      if (errorCode === 0) {
        const allPrinters = allPrintersRes.resultAck.info;
        this.wifiPrinters = {};
        allPrinters.forEach((item) => {
          this.wifiPrinters[item.deviceName] = item.tcpPort;
        });
        console.log("wifiPrinters", this.wifiPrinters);

        this.wifiSelectPrinter = Object.keys(this.wifiPrinters)[0];
        console.log("wifiSelectPrinter", this.wifiSelectPrinter);
      } else {
        alert("没有在线的打印机");
      }
    },
    //获取打印机Wifi配置信息
    async getWifiConfigurationInfo() {
      if (!this.printSocketOpen) {
        return alert("打印服务未开启");
      }
      try {
        const wifiInfo = await this.nMPrintSocket.getWifiConfiguration();
        const errorCode = JSON.parse(wifiInfo.resultAck.errorCode);

        if (errorCode === 0) {
          const info = JSON.parse(wifiInfo.resultAck.info);
          console.log("wifiInfo", info);
          alert("wifiInfo:" + info);
        } else {
          alert("wifiInfo:获取失败");
        }
      } catch (err) {
        console.error(err);
      }
    },

    async selectOnLineWifiPrinter() {
      if (!this.printSocketOpen) {
        return alert("打印服务未开启");
      }
      try {
        const wifiConnectRes = await this.nMPrintSocket.connectWifiPrinter(
          this.wifiSelectPrinter,
         this.wifiPrinters[this.wifiSelectPrinter]
        );
        const result = JSON.parse(wifiConnectRes.resultAck.result);
        if (result) {
          console.log("连接成功");
          this.onlineWifiBool = true;
          this.onlineUsbBool = false;
        } else {
          console.log("连接失败");
          this.onlineWifiBool = false;
          alert("连接失败");
        }
        console.log("wifiConnectRes", wifiConnectRes);
      } catch (err) {
        console.error(err);
      }
    },

    async setWifiConfiguration() {
      if (!this.printSocketOpen) {
        return alert("打印服务未开启");
      }

      try {
        if (this.wifiName.trim() !== "") {
          const wifiConfigurationResult =
            await this.nMPrintSocket.configurationWifi(
              this.wifiName.trim(),
              this.wifiPassword.trim()
            );

          console.log("wifiConfigurationResult", wifiConfigurationResult);

          const errorCode = JSON.parse(
            wifiConfigurationResult.resultAck.errorCode
          );

          console.log("errorCode", errorCode);

          if (errorCode === 0) {
            return alert(
              "网络配置成功，请断开USB线缆后使用WIFI搜索连接打印机（PC需要和打印机在同一网络）"
            );
          } else {
            return alert("网络配置失败");
          }
        } else {
          return alert("wifi名称不得为空");
        }
      } catch (err) {
        console.error(err);
      }
    },
    // 连接打印机
    async selectOnLineUsbPrinter() {
      if (!this.printSocketOpen) {
        return alert("打印服务未开启");
      }
      console.log("开始连接打印机");
      try {
        const res = await this.nMPrintSocket.selectPrinter(
          this.usbSelectPrinter,
          parseInt(this.usbPrinters[this.usbSelectPrinter])
        );
        console.log("选择打印机", res);

        if (res.resultAck.errorCode === 0) {
          console.log("连接成功");
          this.onlineUsbBool = true;
        } else {
          console.log("连接失败");
          this.onlineUsbBool = false;
          alert("连接失败");
        }
      } catch (err) {
        console.error(err);
      }
    },
    //初始化SDK
    async init() {
      if (!this.printSocketOpen) return alert("打印服务未开启");
      //初始化数据
      try {
        const res = await this.nMPrintSocket.initSdk({ fontDir: "" });
        if (res.resultAck.errorCode == 0) {
          console.log("初始化成功");
          this.initBool = true;
        } else {
          console.log("初始化失败");
          this.initBool = false;
        }
      } catch (err) {
        console.error(err);
      }
    },
    // 打印机类型建议
    printerDetails(printModel) {
      switch (printModel) {
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
    },
    // 设置自动关机时间
    async setPrinterAutoShutDownTime(e) {
      if (!this.printSocketOpen) return alert("打印服务未开启");
      console.log("setPrinterAutoShutDownTime", e.target.value);
      try {
        const res = await this.nMPrintSocket.setPrinterAutoShutDownTime(
          parseInt(e.target.value)
        );

        console.log("res", res);
        if (res.resultAck.errorCode === 0) {
          console.log("设置成功");
        } else if (res.resultAck.errorCode === -3) {
          console.log("不支持设置");
        } else {
          console.log("设置失败");
        }
      } catch (err) {
        console.error(err);
      }
    },

    // 开始打印
    async startPrintJobTest(content) {
      if (!this.printSocketOpen) return alert("打印服务未开启");
      let contentArr = [];
      contentArr.push(content);
      this.batchPrintJob(contentArr);
    },

    async handlePreview(content) {
      if (!this.printSocketOpen) return alert("打印服务未开启");
      try {

        await this.initCanvas(content.InitDrawingBoardParam);
        // 提交打印任务
        await this.drawElementItem(content.elements);
        const res = await this.nMPrintSocket.generateImagePreviewImage(8);
        console.log("previewData", JSON.parse(res.resultAck.info).ImageData);
        if (res.resultAck.errorCode == 0) {
          console.log("预览成功");
          const imageData = JSON.parse(res.resultAck.info).ImageData
          this.previewImage = `data:image/png;base64,${imageData}`;
        } else {
          console.log("预览失败");
        }

      } catch (err) {
        console.error(err);
        alert("预览生成失败");
      }
    },


    // 开始打印
    async startBatchPrintJobTest(content) {

      if (!this.printSocketOpen) return alert("打印服务未开启");
      if (content == null || content.length == 0) {
        return;
      }
      this.batchPrintJob(content.data);
    },

    //批量打印列表数据
    async batchPrintJob(list) {
      const printQuantity = this.jsonObj.printerImageProcessingInfo.printQuantity;
      this.isPrintError = false;

      let printListener = null;
      const cleanupListener = () => {
        if (printListener) {
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
          handleProgressUpdate: (resultAck) => {
            console.log('打印进度更新', {
              当前进度: `第${resultAck.printPages}页,第${resultAck.printCopies}份`,
              总页数: list.length,
              完成长度: resultAck.onPrintPageLengthCompleted
            });
          },
          handleCompletion: async () => {
            const endRes = await this.nMPrintSocket.endJob();
            if (endRes.resultAck.errorCode === 0) {
              console.log("打印完成");
            }
            cleanupListener();
          },
          handleError: (msg) => {
            this.isPrintError = true;
            cleanupListener();
            alert(`打印错误: ${msg.resultAck.info}`);
          }
        };

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
    },
    // 绘制打印标签
    async printTag(list, x) {
      //设置画布尺寸
      try {
        await this.initCanvas(list[x].InitDrawingBoardParam);
        // 提交打印任务
        await this.drawElementItem(list[x].elements);
        this.commitPrintJob();

      } catch (err) {
        console.error(err);
      }
    },
    async initCanvas(params) {
      console.log("初始化打印画布");
      try {
        const res = await this.nMPrintSocket.InitDrawingBoard(params);
        if (res.resultAck.errorCode !== 0) {
          throw new Error('画布初始化失败');
        }
        return true;
      } catch (err) {
        console.error('画布初始化错误:', err);
        return false;
      }
    },
    async drawElementItem(item) {
      console.log("开始绘制元素");
      try {
        let i = 0;
        while (i < item.length) {
          const element = item[i];
          let result;

          switch (element.type) {
            case 'text':
              result = await this.handleTextElement(element);
              break;
            case 'qrCode':
              result = await this.handleQrCodeElement(element);
              break;
            case 'barCode':
              result = await this.handleBarCodeElement(element);
              break;
            case 'line':
              result = await this.handleLineElement(element);
              break;
            case 'graph':
              result = await this.handleGraphElement(element);
              break;
            case 'image':
              result = await this.handleImageElement(element);
              break;
            default:
              throw new Error('未知的打印元素类型');
          }

          if (result?.resultAck?.errorCode !== 0) {
            return;
          }
          i++;
        }

      } catch (err) {
        console.error(err);
      }
    },

    async commitPrintJob() {
      this.nMPrintSocket.commitJob(null, JSON.stringify(this.jsonObj));
    },

    /**
     * 处理文本元素
     * @param {Object} element - 文本元素配置
     */
    async handleTextElement(element) {
      return this.nMPrintSocket.DrawLableText(element.json);
    },

    /**
     * 处理二维码元素
     * @param {Object} element - 二维码元素配置
     */
    async handleQrCodeElement(element) {
      return this.nMPrintSocket.DrawLableQrCode(element.json);
    },

    /**
     * 处理一维码元素
     * @param {Object} element - 一维码元素配置
     */
    async handleBarCodeElement(element) {
      return this.nMPrintSocket.DrawLableBarCode(element.json);
    },

    /**
     * 处理线条元素
     * @param {Object} element - 线条元素配置
     */
    async handleLineElement(element) {
      return this.nMPrintSocket.DrawLableLine(element.json);
    },

    /**
     * 处理图形元素
     * @param {Object} element - 图形元素配置
     */
    async handleGraphElement(element) {
      return this.nMPrintSocket.DrawLableGraph(element.json);
    },

    /**
     * 处理图片元素
     * @param {Object} element - 图片元素配置
     */
    async handleImageElement(element) {
      return this.nMPrintSocket.DrawLableImage(element.json);
    },
  },
};
</script>
<style lang="scss" scoped>
.container {
  width: 1200px;
  margin: 0 auto;

  h1 {
    text-align: center;
  }

  h3 {
    text-align: left;
  }

  .content {
    border: solid 1px #ced4da;
    padding: 8px;
    text-align: left;
  }

  button {
    margin-left: 8px;
    margin-right: 0px;
    display: inline;
    padding: 8px;
    background-color: #409eff;
    border-color: #409eff;
    border: 1px;
    border-radius: 4px;
    color: #fff;
  }

  button:hover {
    background-color: #75baff;
    border-color: #75baff;
  }

  button:active {
    background-color: #1866b4;
    border-color: #1866b4;
  }

  span {
    color: red;
    font-style: italic;
    font-weight: bold;
    text-decoration: underline;
  }

  .status {
    display: inline;
  }

  .service_status,
  .init_status,
  .connect_usb .usb_printer_connect_status,
  .connect_wifi .wifi_printer_connect_status,
  .select_usb .select_printer,
  .select_wifi .select_printer {
    border: solid 1px #ced4da;
    background-color: #e9ecef;
    border-radius: 4px;
    font-size: 14px;
    padding: 6px;
  }

  .service,
  .init,
  .select_usb,
  .select_wifi,
  .connect_usb,
  .connect_wifi,
  .wifi_printer_setting,
  .wifi_printer_setting .setOrGet,
  .print {
    margin-top: 16px;
  }

  .print_label {
    margin-left: 10px;
    margin-top: 8px;
  }

  #wifi_password {
    margin-left: 16px;
  }
  .preview_container{
    margin-top: 16px;
  }
  img{
    border: solid 1px #ced4da;
  }
}
</style>
