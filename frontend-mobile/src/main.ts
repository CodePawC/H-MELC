import './styles.css'

import {
  clearToken,
  fetchAssetLabelTemplates,
  fetchAssetPrintLabel,
  fetchMe,
  getToken,
  login,
  postScanAsset,
  setToken,
} from './api'
import { renderLabelPreview } from './labelPreview'
import {
  connectMobilePrinter,
  getPrintCapabilities,
  printViaBrowser,
  printViaMobilePrinter,
  probeBluetoothPrinter,
  scanMobilePrinters,
} from './mobilePrinter'
import type {
  AssetLabelTemplatePreset,
  AssetPrintLabelPayload,
  CurrentUser,
  MobilePrinterConnectionMode,
  MobilePrinterInfo,
} from './types'

type AppState = {
  booting: boolean
  user: CurrentUser | null
  label: AssetPrintLabelPayload | null
  labelTemplates: AssetLabelTemplatePreset[]
  selectedTemplateCode: string
  currentAssetId: string | null
  previewDataUrl: string | null
  message: string
  error: string
  scannerOpen: boolean
  scannerStatus: string
  busy: boolean
  printerMode: MobilePrinterConnectionMode
  mobilePrinters: MobilePrinterInfo[]
  selectedPrinterId: string
  connectedPrinter: MobilePrinterInfo | null
  quantity: number
}

const state: AppState = {
  booting: true,
  user: null,
  label: null,
  labelTemplates: [],
  selectedTemplateCode: 'ASSET_QR_50X30_V1',
  currentAssetId: null,
  previewDataUrl: null,
  message: '',
  error: '',
  scannerOpen: false,
  scannerStatus: '',
  busy: false,
  printerMode: 'BLUETOOTH',
  mobilePrinters: [],
  selectedPrinterId: '',
  connectedPrinter: null,
  quantity: 1,
}

const appElement = document.querySelector<HTMLDivElement>('#app')
let cameraStream: MediaStream | null = null
let scanFrame = 0

if (!appElement) throw new Error('缺少 #app 根节点')
const app = appElement

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function setMessage(message: string, error = ''): void {
  state.message = message
  state.error = error
  render()
}

function normalizeQrInput(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const token = url.searchParams.get('token') || url.searchParams.get('qr_token')
    if (token) return token.trim()
  } catch {
    // Raw token input is expected in巡检场景.
  }
  const tokenMatch = raw.match(/(?:token|qr_token)=([^&\s]+)/i)
  return tokenMatch ? decodeURIComponent(tokenMatch[1]) : raw
}

function statusPill(label: string, ok: boolean): string {
  return `<span class="capability ${ok ? 'capability-ok' : 'capability-muted'}">${escapeHtml(label)}</span>`
}

function mobilePrinterKey(printer: MobilePrinterInfo): string {
  return `${printer.mode}:${printer.id}:${printer.address ?? ''}:${printer.port ?? ''}`
}

function selectedMobilePrinter(): MobilePrinterInfo | null {
  return state.mobilePrinters.find((printer) => mobilePrinterKey(printer) === state.selectedPrinterId) ?? null
}

function printerLabel(printer: MobilePrinterInfo): string {
  const parts = [printer.mode === 'BLUETOOTH' ? '蓝牙' : 'WiFi', printer.name]
  if (printer.address) parts.push(printer.address)
  if (printer.port) parts.push(String(printer.port))
  return parts.join(' · ')
}

function renderLogin(): string {
  return `
    <main class="mobile-shell login-shell">
      <section class="login-panel">
        <div class="brand-mark">MEP</div>
        <h1>移动巡检标签打印</h1>
        <form id="loginForm" class="form-stack">
          <label>
            账号
            <input name="username" autocomplete="username" placeholder="请输入账号" required />
          </label>
          <label>
            密码
            <input name="password" autocomplete="current-password" type="password" placeholder="请输入密码" required />
          </label>
          <button class="primary-button" type="submit" ${state.busy ? 'disabled' : ''}>登录</button>
        </form>
        ${state.error ? `<p class="error-text">${escapeHtml(state.error)}</p>` : ''}
      </section>
    </main>
  `
}

function renderWorkspace(): string {
  const caps = getPrintCapabilities()
  const label = state.label
  const connectedPrinter = state.connectedPrinter
  return `
    <main class="mobile-shell">
      <header class="app-header">
        <div>
          <p class="eyebrow">现场巡检</p>
          <h1>标签补打</h1>
        </div>
        <button id="logoutButton" class="ghost-button" type="button">退出</button>
      </header>

      <section class="user-strip">
        <span>${escapeHtml(state.user?.display_name || state.user?.username || '已登录')}</span>
        <span>${statusPill('App桥接', caps.nativeBridge)}${statusPill('手机蓝牙', caps.nativeBluetooth || caps.webBluetooth)}${statusPill('手机WiFi', caps.nativeWifi)}${statusPill('系统打印', caps.browserPrint)}</span>
      </section>

      <section class="panel">
        <h2>设备定位</h2>
        <form id="lookupForm" class="form-stack">
          <label>
            二维码内容或 token
            <textarea name="qrToken" rows="3" placeholder="扫码结果、mep://asset/... 或 qr_token"></textarea>
          </label>
          <div class="button-row">
            <button class="primary-button" type="submit" ${state.busy ? 'disabled' : ''}>解析二维码</button>
            <button id="scanButton" class="secondary-button" type="button" ${state.busy ? 'disabled' : ''}>打开相机</button>
          </div>
        </form>
        <form id="assetForm" class="inline-form">
          <input name="assetId" placeholder="或输入设备 UUID" />
          <button class="secondary-button" type="submit" ${state.busy ? 'disabled' : ''}>读取标签</button>
        </form>
        <label class="template-select">
          标签模板
          <select id="templateSelect" ${state.labelTemplates.length ? '' : 'disabled'}>
            ${state.labelTemplates.length
              ? state.labelTemplates
                  .map(
                    (template) =>
                      `<option value="${escapeHtml(template.template_code)}" ${template.template_code === state.selectedTemplateCode ? 'selected' : ''}>${escapeHtml(template.template_name)} · ${escapeHtml(template.paper_type_name)}</option>`,
                  )
                  .join('')
              : `<option value="${escapeHtml(state.selectedTemplateCode)}">模板加载中</option>`}
          </select>
        </label>
        ${
          state.scannerOpen
            ? `<div class="scanner-box">
                <video id="scanVideo" playsinline muted></video>
                <button id="stopScanButton" class="ghost-button" type="button">关闭相机</button>
                <p>${escapeHtml(state.scannerStatus || '正在等待二维码')}</p>
              </div>`
            : ''
        }
      </section>

      <section class="panel label-panel">
        <div class="panel-title-row">
          <h2>标签预览</h2>
          ${label ? `<span>${escapeHtml(label.template.label_width_mm)}×${escapeHtml(label.template.label_height_mm)} mm</span>` : ''}
        </div>
        ${
          label
            ? `<div class="asset-summary">
                <strong>${escapeHtml(label.asset.asset_name)}</strong>
                <span>${escapeHtml(label.asset.asset_code)}</span>
                <span>${escapeHtml(label.template.template_name)} · ${escapeHtml(label.template.paper_type_name)}</span>
                <span>${escapeHtml(label.asset.main_status)}</span>
              </div>
              <div class="print-sheet">
                <canvas id="labelCanvas" class="label-canvas"></canvas>
              </div>`
            : `<div class="empty-state">请先解析二维码或读取设备 UUID</div>`
        }
      </section>

      <section class="panel">
        <div class="panel-title-row">
          <h2>手机直连打印机</h2>
          <span>${connectedPrinter ? `已连接 ${escapeHtml(connectedPrinter.name)}` : '未连接'}</span>
        </div>
        <div class="segmented-control">
          <button class="${state.printerMode === 'BLUETOOTH' ? 'active' : ''}" data-printer-mode="BLUETOOTH" type="button">蓝牙</button>
          <button class="${state.printerMode === 'WIFI' ? 'active' : ''}" data-printer-mode="WIFI" type="button">WiFi</button>
        </div>
        ${
          state.printerMode === 'WIFI'
            ? `<form id="manualWifiForm" class="wifi-form">
                <input name="host" placeholder="打印机 IP" autocomplete="off" />
                <input name="port" inputmode="numeric" placeholder="端口" value="9100" />
                <button class="secondary-button" type="submit">添加</button>
              </form>`
            : ''
        }
        <div class="inline-form printer-line">
          <button id="mobileScanButton" class="secondary-button" type="button" ${state.busy ? 'disabled' : ''}>搜索${state.printerMode === 'BLUETOOTH' ? '蓝牙' : 'WiFi'}</button>
          <select id="mobilePrinterSelect" ${state.mobilePrinters.length ? '' : 'disabled'}>
            <option value="">选择打印机</option>
            ${state.mobilePrinters
              .map((printer) => {
                const key = mobilePrinterKey(printer)
                return `<option value="${escapeHtml(key)}" ${key === state.selectedPrinterId ? 'selected' : ''}>${escapeHtml(printerLabel(printer))}</option>`
              })
              .join('')}
          </select>
        </div>
        <div class="button-row">
          <button id="mobileConnectButton" class="secondary-button" type="button" ${!state.selectedPrinterId || state.busy ? 'disabled' : ''}>连接打印机</button>
          <button id="mobilePrintButton" class="primary-button" type="button" ${!label || !connectedPrinter || state.busy ? 'disabled' : ''}>手机直连打印</button>
        </div>
      </section>

      <section class="panel">
        <h2>打印输出</h2>
        <label class="quantity-line">
          份数
          <input id="quantityInput" type="number" min="1" max="99" value="${escapeHtml(state.quantity)}" />
        </label>
        <div class="print-grid">
          <button id="browserPrintButton" class="secondary-button" type="button" ${!label ? 'disabled' : ''}>系统打印</button>
          <button id="bluetoothButton" class="secondary-button" type="button">浏览器蓝牙探测</button>
        </div>
      </section>

      ${state.message ? `<p class="toast success-toast">${escapeHtml(state.message)}</p>` : ''}
      ${state.error ? `<p class="toast error-toast">${escapeHtml(state.error)}</p>` : ''}
    </main>
  `
}

function render(): void {
  app.innerHTML = state.booting
    ? '<main class="mobile-shell"><div class="empty-state">正在连接平台</div></main>'
    : state.user
      ? renderWorkspace()
      : renderLogin()

  bindEvents()
  void drawPreview()
  if (state.scannerOpen) void attachScannerVideo()
}

function bindEvents(): void {
  document.querySelector<HTMLFormElement>('#loginForm')?.addEventListener('submit', handleLogin)
  document.querySelector<HTMLButtonElement>('#logoutButton')?.addEventListener('click', handleLogout)
  document.querySelector<HTMLFormElement>('#lookupForm')?.addEventListener('submit', handleLookup)
  document.querySelector<HTMLFormElement>('#assetForm')?.addEventListener('submit', handleAssetLookup)
  document.querySelector<HTMLSelectElement>('#templateSelect')?.addEventListener('change', handleTemplateChange)
  document.querySelector<HTMLButtonElement>('#scanButton')?.addEventListener('click', openScanner)
  document.querySelector<HTMLButtonElement>('#stopScanButton')?.addEventListener('click', handleCloseScanner)
  document.querySelector<HTMLButtonElement>('#browserPrintButton')?.addEventListener('click', () => {
    if (state.label) printViaBrowser()
  })
  document.querySelector<HTMLButtonElement>('#bluetoothButton')?.addEventListener('click', handleBluetoothProbe)
  document.querySelector<HTMLButtonElement>('#mobileScanButton')?.addEventListener('click', handleScanMobilePrinters)
  document.querySelector<HTMLButtonElement>('#mobileConnectButton')?.addEventListener('click', handleConnectMobilePrinter)
  document.querySelector<HTMLButtonElement>('#mobilePrintButton')?.addEventListener('click', handleMobilePrint)
  document.querySelector<HTMLSelectElement>('#mobilePrinterSelect')?.addEventListener('change', handleMobilePrinterSelect)
  document.querySelector<HTMLFormElement>('#manualWifiForm')?.addEventListener('submit', handleManualWifiPrinter)
  document.querySelector<HTMLInputElement>('#quantityInput')?.addEventListener('change', handleQuantityChange)
  document.querySelectorAll<HTMLButtonElement>('[data-printer-mode]').forEach((button) => {
    button.addEventListener('click', handlePrinterModeChange)
  })
}

async function withBusy(action: () => Promise<void>): Promise<void> {
  state.busy = true
  state.error = ''
  state.message = ''
  render()
  try {
    await action()
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error)
  } finally {
    state.busy = false
    render()
  }
}

async function handleLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = new FormData(event.currentTarget as HTMLFormElement)
  const username = String(form.get('username') || '').trim()
  const password = String(form.get('password') || '')
  await withBusy(async () => {
    const result = await login(username, password)
    setToken(result.access_token)
    state.user = await fetchMe()
    await loadLabelTemplates()
    state.message = '登录成功'
  })
}

function handleLogout(): void {
  clearToken()
  closeScanner()
  state.user = null
  state.label = null
  state.currentAssetId = null
  state.previewDataUrl = null
  state.message = ''
  state.error = ''
  render()
}

async function loadLabelTemplates(): Promise<void> {
  try {
    const data = await fetchAssetLabelTemplates()
    state.labelTemplates = data.items
    state.selectedTemplateCode = data.default_template_code
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error)
  }
}

async function loadLabel(assetId: string): Promise<void> {
  const label = await fetchAssetPrintLabel(assetId, state.selectedTemplateCode)
  state.label = label
  state.currentAssetId = assetId
  state.selectedTemplateCode = label.template.template_code
  state.previewDataUrl = null
  state.message = `标签已生成：${label.template.template_name}`
}

async function handleTemplateChange(event: Event): Promise<void> {
  state.selectedTemplateCode = (event.currentTarget as HTMLSelectElement).value
  state.label = null
  state.previewDataUrl = null
  state.message = ''
  state.error = ''
  if (!state.currentAssetId) {
    render()
    return
  }
  await withBusy(async () => {
    await loadLabel(state.currentAssetId as string)
  })
}

async function handleLookup(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = new FormData(event.currentTarget as HTMLFormElement)
  const qrToken = normalizeQrInput(String(form.get('qrToken') || ''))
  if (!qrToken) {
    setMessage('', '请输入二维码内容或 token')
    return
  }
  await withBusy(async () => {
    const asset = await postScanAsset(qrToken)
    await loadLabel(asset.asset_id)
  })
}

async function handleAssetLookup(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = new FormData(event.currentTarget as HTMLFormElement)
  const assetId = String(form.get('assetId') || '').trim()
  if (!assetId) {
    setMessage('', '请输入设备 UUID')
    return
  }
  await withBusy(async () => {
    await loadLabel(assetId)
  })
}

async function drawPreview(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#labelCanvas')
  if (!canvas || !state.label) return
  try {
    state.previewDataUrl = await renderLabelPreview(canvas, state.label)
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error)
  }
}

function openScanner(): void {
  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    setMessage('', '手机浏览器通常需要 HTTPS 或 App WebView 才能打开相机，可先粘贴 token 或输入设备 UUID')
    return
  }
  if (!window.BarcodeDetector) {
    setMessage('', '当前浏览器未开放二维码识别能力，可手动粘贴 token')
    return
  }
  state.scannerOpen = true
  state.scannerStatus = '正在启动相机'
  state.error = ''
  render()
}

function closeScanner(): void {
  state.scannerOpen = false
  state.scannerStatus = ''
  if (scanFrame) cancelAnimationFrame(scanFrame)
  scanFrame = 0
  cameraStream?.getTracks().forEach((track) => track.stop())
  cameraStream = null
}

function handleCloseScanner(): void {
  closeScanner()
  render()
}

async function attachScannerVideo(): Promise<void> {
  if (cameraStream) return
  const video = document.querySelector<HTMLVideoElement>('#scanVideo')
  if (!video || !window.BarcodeDetector) return
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    video.srcObject = cameraStream
    await video.play()
    state.scannerStatus = '对准设备二维码'
    document.querySelector('.scanner-box p')?.replaceChildren(document.createTextNode(state.scannerStatus))
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    const tick = async () => {
      const currentVideo = document.querySelector<HTMLVideoElement>('#scanVideo')
      if (!state.scannerOpen || !currentVideo) return
      try {
        const codes = await detector.detect(currentVideo)
        const raw = codes[0]?.rawValue
        if (raw) {
          closeScanner()
          await withBusy(async () => {
            const token = normalizeQrInput(raw)
            const asset = await postScanAsset(token)
            await loadLabel(asset.asset_id)
          })
          return
        }
      } catch {
        state.scannerStatus = '扫码中'
      }
      scanFrame = requestAnimationFrame(tick)
    }
    scanFrame = requestAnimationFrame(tick)
  } catch (error) {
    closeScanner()
    state.error = error instanceof Error ? error.message : '无法打开相机'
    render()
  }
}

function handlePrinterModeChange(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement
  const mode = button.dataset.printerMode
  if (mode !== 'BLUETOOTH' && mode !== 'WIFI') return
  state.printerMode = mode
  state.mobilePrinters = []
  state.selectedPrinterId = ''
  if (state.connectedPrinter?.mode !== mode) state.connectedPrinter = null
  state.message = ''
  state.error = ''
  render()
}

function handleMobilePrinterSelect(event: Event): void {
  state.selectedPrinterId = (event.currentTarget as HTMLSelectElement).value
  state.connectedPrinter = null
  render()
}

function handleQuantityChange(event: Event): void {
  const input = event.currentTarget as HTMLInputElement
  state.quantity = Math.min(99, Math.max(1, Number(input.value) || 1))
  input.value = String(state.quantity)
}

async function handleManualWifiPrinter(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = new FormData(event.currentTarget as HTMLFormElement)
  const host = String(form.get('host') || '').trim()
  const port = Math.max(1, Number(form.get('port')) || 9100)
  if (!host) {
    setMessage('', '请输入 WiFi 打印机 IP')
    return
  }
  const printer: MobilePrinterInfo = {
    id: `wifi:${host}:${port}`,
    name: host,
    mode: 'WIFI',
    address: host,
    port,
  }
  state.printerMode = 'WIFI'
  state.mobilePrinters = [printer, ...state.mobilePrinters.filter((item) => mobilePrinterKey(item) !== mobilePrinterKey(printer))]
  state.selectedPrinterId = mobilePrinterKey(printer)
  state.connectedPrinter = null
  state.message = '已添加 WiFi 打印机'
  state.error = ''
  render()
}

async function handleScanMobilePrinters(): Promise<void> {
  await withBusy(async () => {
    const printers = await scanMobilePrinters(state.printerMode)
    state.mobilePrinters = printers
    state.selectedPrinterId = printers[0] ? mobilePrinterKey(printers[0]) : ''
    state.connectedPrinter = null
    state.message = printers.length ? `发现 ${printers.length} 台${state.printerMode === 'BLUETOOTH' ? '蓝牙' : 'WiFi'}打印机` : '未发现在线打印机'
  })
}

async function handleConnectMobilePrinter(): Promise<void> {
  const printer = selectedMobilePrinter()
  if (!printer) {
    setMessage('', '请选择打印机')
    return
  }
  await withBusy(async () => {
    state.connectedPrinter = await connectMobilePrinter(printer)
    state.message = `已连接 ${state.connectedPrinter.name}`
  })
}

async function handleMobilePrint(): Promise<void> {
  if (!state.label) return
  if (!state.connectedPrinter) {
    setMessage('', '请先连接蓝牙或 WiFi 打印机')
    return
  }
  await withBusy(async () => {
    await printViaMobilePrinter(
      state.label as AssetPrintLabelPayload,
      state.connectedPrinter as MobilePrinterInfo,
      state.previewDataUrl ?? undefined,
      state.quantity,
    )
    state.message = `已提交 ${state.quantity} 份标签`
  })
}

async function handleBluetoothProbe(): Promise<void> {
  await withBusy(async () => {
    const name = await probeBluetoothPrinter()
    state.message = `已选择：${name}`
  })
}

async function boot(): Promise<void> {
  try {
    const token = getToken()
    if (token) {
      state.user = await fetchMe()
      await loadLabelTemplates()
    }
  } catch {
    clearToken()
  } finally {
    state.booting = false
    render()
  }
}

void boot()
