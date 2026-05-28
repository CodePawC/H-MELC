# 移动巡检标签打印端

手机 H5 用于现场巡检时登录平台、解析资产二维码、预览设备标签，并把标签任务交给蓝牙/WiFi 打印通道。

```bash
npm install
npm run dev
```

默认开发地址为 `http://<本机局域网IP>:5175`，`/api` 会由 Vite 代理到 `VITE_API_PROXY_TARGET`，未配置时默认 `http://127.0.0.1:8010`。

## 当前能力

- 平台账号登录与 `/auth/me` 会话校验。
- 粘贴二维码内容、token，或直接输入设备 UUID。
- 调用 `GET /api/v1/assets/label-templates` 读取纸张/尺寸/版式预设。
- 调用 `GET /api/v1/assets/{asset_id}/print-label?template_code=...` 生成按模板排版的标签预览。
- 手机相机扫码优先使用浏览器 `BarcodeDetector`；真机浏览器通常要求 HTTPS 或 App WebView 安全上下文，不支持时保留手动输入。

## 打印通道

- 浏览器系统打印：用于验证标签内容与普通打印兜底。
- 手机直连：蓝牙/WiFi 搜索、选择、连接、打印工作流。
- 蓝牙探测：检测浏览器是否开放 `navigator.bluetooth.requestDevice`，用于确认手机能发现附近蓝牙设备。
- 原生桥接：App / 小程序需注入 `window.JcMobilePrinter.scanPrinters/connectPrinter/printLabel`，本 H5 会把标签载荷交给原生精臣 SDK 打印。

## 移动端原生桥接协议

```ts
window.JcMobilePrinter = {
  capabilities: { bluetooth: true, wifi: true },
  async scanPrinters({ mode }) {
    return [{ id: 'printer-1', name: 'B50W', mode, address: '192.168.5.80', port: 9100 }]
  },
  async connectPrinter({ mode, printer }) {
    return { connected: true, printer: { ...printer, mode } }
  },
  async printLabel(job) {
    // job.payload 为 /api/v1/assets/{asset_id}/print-label?template_code=... 的 data
    // job.payload.template 含纸张类型、纸张大小、打印参数与版式编码
    // job.connection.mode 为 BLUETOOTH 或 WIFI
    // job.connection.printer 为已连接打印机
    // job.quantity 为份数
  },
}
```
