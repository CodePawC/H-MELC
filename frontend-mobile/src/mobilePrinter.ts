import type {
  AssetPrintLabelPayload,
  MobilePrintJob,
  MobilePrinterCapabilities,
  MobilePrinterConnectionMode,
  MobilePrinterInfo,
} from './types'

export type PrintCapabilities = {
  browserPrint: boolean
  webBluetooth: boolean
  nativeBridge: boolean
  nativeBluetooth: boolean
  nativeWifi: boolean
}

export function getPrintCapabilities(): PrintCapabilities {
  const native = window.JcMobilePrinter
  const declared = readDeclaredCapabilities(native?.capabilities)
  return {
    browserPrint: typeof window.print === 'function',
    webBluetooth: typeof navigator.bluetooth?.requestDevice === 'function',
    nativeBridge: Boolean(native),
    nativeBluetooth: Boolean(declared.bluetooth ?? native?.scanPrinters ?? native?.connectPrinter ?? native?.printLabel),
    nativeWifi: Boolean(declared.wifi ?? native?.scanPrinters ?? native?.connectPrinter ?? native?.printLabel),
  }
}

function readDeclaredCapabilities(
  capabilities: MobilePrinterCapabilities | (() => MobilePrinterCapabilities | Promise<MobilePrinterCapabilities>) | undefined,
): MobilePrinterCapabilities {
  return capabilities && typeof capabilities === 'object' ? capabilities : {}
}

function normalizePrinter(raw: unknown, mode: MobilePrinterConnectionMode, index: number): MobilePrinterInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = String(item.id ?? item.deviceId ?? item.address ?? item.name ?? `${mode}:${index}`)
  const name = String(item.name ?? item.deviceName ?? item.printerName ?? item.address ?? `打印机 ${index + 1}`)
  return {
    id,
    name,
    mode: (item.mode === 'BLUETOOTH' || item.mode === 'WIFI' ? item.mode : mode) as MobilePrinterConnectionMode,
    address: typeof item.address === 'string' ? item.address : typeof item.ipAddress === 'string' ? item.ipAddress : undefined,
    port: typeof item.port === 'number' ? item.port : typeof item.tcpPort === 'number' ? item.tcpPort : undefined,
    model: typeof item.model === 'string' ? item.model : undefined,
    rssi: typeof item.rssi === 'number' ? item.rssi : undefined,
    online: typeof item.online === 'boolean' ? item.online : undefined,
    bridgeRequired: typeof item.bridgeRequired === 'boolean' ? item.bridgeRequired : undefined,
  }
}

function normalizePrinterList(raw: unknown, mode: MobilePrinterConnectionMode): MobilePrinterInfo[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
      ? ((raw as { items: unknown[] }).items)
      : []
  return items
    .map((item, index) => normalizePrinter(item, mode, index))
    .filter((item): item is MobilePrinterInfo => Boolean(item))
}

export async function scanMobilePrinters(mode: MobilePrinterConnectionMode): Promise<MobilePrinterInfo[]> {
  const native = window.JcMobilePrinter
  if (native?.scanPrinters) {
    const raw = await native.scanPrinters({ mode })
    return normalizePrinterList(raw, mode)
  }

  if (mode === 'BLUETOOTH' && navigator.bluetooth?.requestDevice) {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [],
    })
    return [
      {
        id: device.id || device.name || 'browser-bluetooth',
        name: device.name || '已选择蓝牙设备',
        mode,
        bridgeRequired: true,
      },
    ]
  }

  throw new Error(mode === 'WIFI' ? '未检测到移动端 WiFi 打印桥接' : '未检测到移动端蓝牙打印桥接')
}

export async function connectMobilePrinter(printer: MobilePrinterInfo): Promise<MobilePrinterInfo> {
  const native = window.JcMobilePrinter
  if (!native?.connectPrinter) {
    if (printer.bridgeRequired) {
      throw new Error('浏览器只能发现设备，精臣蓝牙/WiFi 打印仍需 App 或小程序桥接')
    }
    throw new Error('未检测到移动端打印机连接桥接')
  }

  const raw = await native.connectPrinter({ mode: printer.mode, printer })
  if (raw && typeof raw === 'object' && 'connected' in raw && raw.connected === false) {
    throw new Error(typeof raw.message === 'string' ? raw.message : '打印机连接失败')
  }
  if (raw && typeof raw === 'object' && 'connected' in raw) {
    return 'printer' in raw && raw.printer ? normalizePrinter(raw.printer, printer.mode, 0) ?? printer : printer
  }
  return normalizePrinter(raw, printer.mode, 0) ?? printer
}

export async function probeBluetoothPrinter(): Promise<string> {
  if (!navigator.bluetooth?.requestDevice) {
    throw new Error('当前浏览器不支持蓝牙设备探测')
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [],
  })
  return device.name || device.id || '已选择蓝牙设备'
}

export async function printViaMobilePrinter(
  payload: AssetPrintLabelPayload,
  printer: MobilePrinterInfo,
  previewDataUrl?: string,
  quantity = 1,
): Promise<void> {
  const printLabel = window.JcMobilePrinter?.printLabel
  if (!printLabel) {
    throw new Error('未检测到移动端原生打印桥接')
  }
  const job: MobilePrintJob = {
    source: 'h-melc',
    payload,
    previewDataUrl,
    quantity,
    connection: {
      mode: printer.mode,
      printer,
    },
  }
  await printLabel(job)
}

export function printViaBrowser(): void {
  window.print()
}
