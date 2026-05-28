import type { AssetPrintLabelPayload, JcPrinterElement, JcPrinterPrintData } from '../api/assets'

type JcPrinterApiName =
  | 'initSdk'
  | 'getAllPrinters'
  | 'selectPrinter'
  | 'scanWifiPrinter'
  | 'connectWifiPrinter'
  | 'closePrinter'
  | 'InitDrawingBoard'
  | 'DrawLableText'
  | 'DrawLableQrCode'
  | 'DrawLableBarCode'
  | 'DrawLableLine'
  | 'DrawLableGraph'
  | 'DrawLableImage'
  | 'generateImagePreviewImage'
  | 'startJob'
  | 'commitJob'
  | 'endJob'
  | 'stopPrint'

type JcPrinterAck = {
  apiName: string
  resultAck?: {
    errorCode?: number
    info?: unknown
    result?: unknown
    printCopies?: number
    printPages?: number
  }
  Error?: string
}

export type JcPrinterInfo = {
  name: string
  port: number
  connection: 'USB' | 'WIFI'
}

export type JcPrinterPrintOptions = {
  density?: number
  labelType?: number
  mode?: 1 | 2
}

type PendingRequest = {
  resolve: (value: JcPrinterAck) => void
  timer: number
}

type PrintStartOptions = {
  printDensity: number
  printLabelType: number
  printMode: 1 | 2
  count: number
}

type PrinterProfile = {
  printMode: 1 | 2
  densityMin: number
  densityMax: number
  labelTypes: number[]
}

const API_NAMES_BY_ELEMENT: Record<JcPrinterElement['type'], JcPrinterApiName> = {
  text: 'DrawLableText',
  qrCode: 'DrawLableQrCode',
  barCode: 'DrawLableBarCode',
  line: 'DrawLableLine',
  graph: 'DrawLableGraph',
  image: 'DrawLableImage',
}

export class JcPrinterClient {
  private readonly url: string
  private websocket: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private jobListeners = new Set<(message: JcPrinterAck) => void>()

  constructor(url = 'ws://127.0.0.1:37989') {
    this.url = url
  }

  connect(timeout = 5000): Promise<void> {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    this.close()

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.websocket = ws
      const timer = window.setTimeout(() => {
        ws.close()
        reject(new Error('连接精臣打印服务超时，请确认本机打印服务已安装并启动'))
      }, timeout)

      ws.onopen = () => {
        window.clearTimeout(timer)
        resolve()
      }
      ws.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('无法连接精臣打印服务 ws://127.0.0.1:37989'))
      }
      ws.onclose = () => {
        this.resolveAllAsDisconnected()
      }
      ws.onmessage = (event) => {
        this.routeMessage(event.data)
      }
    })
  }

  close(): void {
    this.resolveAllAsDisconnected()
    this.jobListeners.clear()
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close()
    }
    this.websocket = null
  }

  async initSdk(): Promise<JcPrinterAck> {
    return this.send('initSdk', { fontDir: '' })
  }

  async getAllPrinters(): Promise<JcPrinterInfo[]> {
    const res = await this.request('getAllPrinters')
    if (this.isNoDeviceResponse(res)) return []
    this.assertOk('getAllPrinters', res)
    const raw = res.resultAck?.info
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || typeof data !== 'object') return []
    return Object.entries(data as Record<string, string | number>).map(([name, port]) => ({
      name,
      port: Number(port),
      connection: 'USB',
    }))
  }

  async scanWifiPrinters(): Promise<JcPrinterInfo[]> {
    const res = await this.request('scanWifiPrinter', undefined, 25000)
    if (this.isNoDeviceResponse(res)) return []
    this.assertOk('scanWifiPrinter', res)
    const raw = res.resultAck?.info
    const items = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(items)) return []
    return items.map((item) => ({
      name: String(item.deviceName ?? item.printerName ?? ''),
      port: Number(item.tcpPort ?? item.port),
      connection: 'WIFI' as const,
    })).filter((item) => item.name && Number.isFinite(item.port))
  }

  async selectPrinter(printer: JcPrinterInfo): Promise<JcPrinterAck> {
    const apiName = printer.connection === 'WIFI' ? 'connectWifiPrinter' : 'selectPrinter'
    return this.send(apiName, { printerName: printer.name, port: printer.port }, printer.connection === 'WIFI' ? 25000 : 10000)
  }

  async preview(label: AssetPrintLabelPayload): Promise<string> {
    await this.draw(label.print_data)
    const res = await this.send('generateImagePreviewImage', undefined, 10000, {
      displayScale: label.template.display_scale,
    })
    const raw = res.resultAck?.info
    const info = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!info?.ImageData) {
      throw new Error('精臣打印服务未返回预览图')
    }
    const mime = String(info.ImageData).startsWith('/9j/') ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${info.ImageData}`
  }

  async print(
    label: AssetPrintLabelPayload,
    quantity: number,
    onProgress?: (message: string) => void,
    printer?: JcPrinterInfo | null,
    onTrace?: (message: string) => void,
    options?: JcPrinterPrintOptions,
  ): Promise<void> {
    const safeQuantity = Math.max(1, Math.floor(quantity))
    const startOptions = this.buildStartOptions(label, safeQuantity, printer ?? undefined, options)
    onTrace?.(`startJob ${JSON.stringify(startOptions)}`)
    onProgress?.(
      `打印参数：${startOptions.printMode === 2 ? '热转印' : '热敏'} / 纸张类型 ${startOptions.printLabelType} / 浓度 ${
        startOptions.printDensity
      }`,
    )

    let doneTimer = 0
    let jobEnded = false
    let listener: ((message: JcPrinterAck) => void) | null = null
    let pageCommitted = false

    try {
      const done = new Promise<void>((resolve, reject) => {
        doneTimer = window.setTimeout(() => {
          reject(new Error('等待打印完成超时'))
        }, 60000)

        listener = (message: JcPrinterAck) => {
          const ack = message.resultAck
          if (!ack) return
          onTrace?.(`${message.apiName} ${JSON.stringify(ack)}`)
          if (ack.errorCode && ack.errorCode !== 0) {
            reject(new Error(String(ack.info ?? `打印异常：${ack.errorCode}`)))
            return
          }
          if (ack.info === 'commitJob ok!' && !pageCommitted) {
            pageCommitted = true
            this.draw(label.print_data)
              .then(() =>
                this.send('commitJob', {
                  printData: undefined,
                  printerImageProcessingInfo: { printQuantity: safeQuantity },
                }),
              )
              .catch(reject)
            return
          }
          if (ack.printCopies != null && ack.printPages != null) {
            onProgress?.(`正在打印第 ${ack.printPages} 页 / 第 ${ack.printCopies} 份`)
          }
          if (ack.printCopies === safeQuantity && ack.printPages === 1) {
            resolve()
          }
        }
        this.jobListeners.add(listener)
      })

      await this.startJobWithCompatibleOptions(label, safeQuantity, printer ?? undefined, startOptions, onTrace)
      await done
      onTrace?.('endJob request')
      await this.send('endJob')
      jobEnded = true
    } finally {
      window.clearTimeout(doneTimer)
      if (listener) this.jobListeners.delete(listener)
      if (!jobEnded) {
        await this.send('endJob').catch(() => undefined)
      }
    }
  }

  private async draw(printData: JcPrinterPrintData): Promise<void> {
    await this.send('InitDrawingBoard', printData.InitDrawingBoardParam)
    for (const element of printData.elements) {
      const apiName = API_NAMES_BY_ELEMENT[element.type]
      const parameter = element.json ?? element.payload
      if (!apiName || !parameter) continue
      await this.send(apiName, parameter)
    }
  }

  private send(
    apiName: JcPrinterApiName,
    parameter?: unknown,
    timeout = 10000,
    extra?: Record<string, unknown>,
  ): Promise<JcPrinterAck> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('精臣打印服务未连接'))
    }

    return this.request(apiName, parameter, timeout, extra).then((message) => {
      this.assertOk(apiName, message)
      return message
    })
  }

  private request(
    apiName: JcPrinterApiName,
    parameter?: unknown,
    timeout = 10000,
    extra?: Record<string, unknown>,
  ): Promise<JcPrinterAck> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('精臣打印服务未连接'))
    }

    const content = parameter === undefined ? { apiName, ...extra } : { apiName, parameter, ...extra }

    return new Promise<JcPrinterAck>((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(apiName)
        resolve({ apiName, resultAck: { errorCode: 22, info: '打印服务响应超时' } })
      }, timeout)
      this.pending.set(apiName, { resolve, timer })
      this.websocket?.send(JSON.stringify(content))
    })
  }

  private assertOk(apiName: JcPrinterApiName, message: JcPrinterAck): void {
    const code = message.resultAck?.errorCode
    if (code && code !== 0) {
      throw new Error(this.formatError(apiName, message))
    }
  }

  private async startJobWithCompatibleOptions(
    label: AssetPrintLabelPayload,
    count: number,
    printer?: JcPrinterInfo,
    preferred?: PrintStartOptions,
    onTrace?: (message: string) => void,
  ): Promise<PrintStartOptions> {
    const primary = preferred ?? this.buildStartOptions(label, count, printer)
    try {
      await this.send('startJob', primary)
      return primary
    } catch (e) {
      if (!this.isPrintParameterMessage(e)) throw e
      const fallback = this.buildFallbackStartOptions(primary, count, e)
      onTrace?.(`startJob fallback ${JSON.stringify(fallback)}`)
      await this.send('startJob', fallback).catch((fallbackError) => {
        throw new Error(this.formatPrintParameterError(e, fallbackError, printer))
      })
      return fallback
    }
  }

  private buildStartOptions(
    label: AssetPrintLabelPayload,
    count: number,
    printer?: JcPrinterInfo,
    options?: JcPrinterPrintOptions,
  ): PrintStartOptions {
    const profile = printer ? printerProfile(printer.name) : null
    const printMode = safePrintMode(options?.mode ?? profile?.printMode ?? label.template.print_mode)
    const densityMin = profile?.densityMin ?? 1
    const densityMax = profile && !options?.mode ? profile.densityMax : printMode === 2 ? 15 : 5
    const labelTypes = profile?.labelTypes
    const labelType = Number.isFinite(options?.labelType) ? Number(options?.labelType) : label.template.print_label_type
    const shouldConstrainLabelType = labelTypes && options?.labelType == null
    return {
      printDensity: clampInt(options?.density ?? label.template.print_density, densityMin, densityMax),
      printLabelType: shouldConstrainLabelType && !labelTypes.includes(labelType) ? labelTypes[0] : labelType,
      printMode,
      count,
    }
  }

  private buildFallbackStartOptions(primary: PrintStartOptions, count: number, reason?: unknown): PrintStartOptions {
    const reasonText = reason instanceof Error ? reason.message : String(reason ?? '')
    const printMode = /setPrintMode|打印模式/i.test(reasonText) ? (primary.printMode === 2 ? 1 : 2) : primary.printMode
    const densityMax = printMode === 2 ? 15 : 5
    return {
      printDensity: clampInt(primary.printDensity, 1, densityMax),
      printLabelType: 1,
      printMode,
      count,
    }
  }

  private isPrintParameterMessage(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return /setPrintMode|打印模式|打印参数|不支持的参数|浓度设置|标签材质|纸张类型|setDensity|setLabel/i.test(message)
  }

  private formatPrintParameterError(primaryError: unknown, fallbackError: unknown, printer?: JcPrinterInfo): string {
    const primary = primaryError instanceof Error ? primaryError.message : String(primaryError)
    const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
    const printerText = printer ? `（当前打印机：${printer.name}）` : ''
    return `打印机不接受当前打印参数${printerText}：${fallback || primary}。请确认模板的热敏/热转印模式与纸张类型匹配；B50/B32/Z401/M2/M3 等热转印机型建议使用“热转印间隙标签”模板。`
  }

  private isNoDeviceResponse(message: JcPrinterAck): boolean {
    const code = message.resultAck?.errorCode
    if (!code || code === 0) return false
    const info = String(message.resultAck?.info ?? message.Error ?? '').toLowerCase()
    return info.includes('no device') || info.includes('no printer') || info.includes('未发现') || info.includes('没有在线')
  }

  private formatError(apiName: JcPrinterApiName, message: JcPrinterAck): string {
    const raw = String(message.resultAck?.info ?? message.Error ?? '').trim()
    if (this.isNoDeviceResponse(message)) {
      return '未发现在线打印机：请确认打印机已开机，并通过 USB/有线连接电脑或与电脑处于同一 WiFi 网络'
    }
    if (apiName === 'startJob' && /setPrintMode|打印模式/i.test(raw)) {
      return `${raw}：当前打印机不支持这个打印模式，请切换热敏/热转印模板或重新搜索并连接正确打印机`
    }
    return raw || `精臣接口 ${apiName} 返回错误码 ${message.resultAck?.errorCode}`
  }

  private routeMessage(raw: unknown): void {
    const message = this.parseMessage(raw)
    if (!message?.apiName) return

    if (message.apiName === 'commitJob') {
      this.jobListeners.forEach((listener) => listener(message))
    }

    const pending = this.pending.get(message.apiName)
    if (!pending) return
    window.clearTimeout(pending.timer)
    this.pending.delete(message.apiName)
    pending.resolve(message)
  }

  private parseMessage(raw: unknown): JcPrinterAck | null {
    if (typeof raw !== 'string') return null
    try {
      return JSON.parse(raw) as JcPrinterAck
    } catch {
      return null
    }
  }

  private resolveAllAsDisconnected(): void {
    this.pending.forEach((pending, apiName) => {
      window.clearTimeout(pending.timer)
      pending.resolve({ apiName, resultAck: { errorCode: 23, info: '打印服务连接已断开' } })
    })
    this.pending.clear()
  }
}

function safePrintMode(value: number): 1 | 2 {
  return value === 2 ? 2 : 1
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.min(max, Math.max(min, n))
}

function printerProfile(printerName: string): PrinterProfile | null {
  const name = printerName.toUpperCase()
  if (includesAny(name, ['B50W', 'B50'])) {
    return { printMode: 2, densityMin: 1, densityMax: 15, labelTypes: [1] }
  }
  if (includesAny(name, ['B32R', 'B32', 'Z401'])) {
    return { printMode: 2, densityMin: 1, densityMax: 15, labelTypes: [1, 5] }
  }
  if (includesAny(name, ['M2', 'M3'])) {
    return { printMode: 2, densityMin: 1, densityMax: 5, labelTypes: [1, 2, 5, 10] }
  }
  if (includesAny(name, ['B18'])) {
    return { printMode: 2, densityMin: 1, densityMax: 3, labelTypes: [1] }
  }
  if (includesAny(name, ['D101', 'D110', 'D11', 'H10', 'B16'])) {
    return { printMode: 1, densityMin: 1, densityMax: 3, labelTypes: [1, 5] }
  }
  if (includesAny(name, ['B3S', 'B21'])) {
    return { printMode: 1, densityMin: 1, densityMax: 5, labelTypes: [1, 2, 3, 5] }
  }
  if (includesAny(name, ['B203', 'B1', 'K3W', 'K3', 'K2', 'B11'])) {
    return { printMode: 1, densityMin: 1, densityMax: 5, labelTypes: [1, 2, 5] }
  }
  return null
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle))
}
