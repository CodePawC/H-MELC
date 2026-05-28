export type Envelope<T> = {
  code?: number | string
  success?: boolean
  message?: string
  data?: T
  detail?: unknown
}

export type LoginResult = {
  access_token: string
  token_type?: string
  expires_in?: number
}

export type CurrentUser = {
  id: string
  username: string
  display_name?: string | null
  roles?: string[]
  permissions?: string[]
}

export type ScanAssetResult = {
  asset_id: string
  asset_code: string
  asset_name: string
  main_status: string
}

export type JcPrinterDrawingBoard = {
  width: number
  height: number
  rotate: 0 | 90 | 180 | 270
  path: string
  verticalShift: number
  HorizontalShift: number
}

export type JcPrinterElement = {
  type: 'text' | 'qrCode' | 'barCode' | 'line' | 'graph' | 'image'
  json?: Record<string, unknown>
  payload?: Record<string, unknown>
}

export type JcPrinterPrintData = {
  InitDrawingBoardParam: JcPrinterDrawingBoard
  elements: JcPrinterElement[]
}

export type AssetPrintLabelPayload = {
  asset: {
    asset_id: string
    asset_code: string
    asset_name: string
    main_status: string
  }
  qr: {
    asset_id: string
    asset_code: string
    qr_token: string
    status: string
    version: number
  }
  sdk: {
    package_version: string
    service_ws_url: string
    service_required: boolean
    service_installer_hint: string
    integration_mode: string
  }
  template: {
    template_code: string
    template_name: string
    paper_type_code: string
    paper_type_name: string
    layout_code: string
    layout_name: string
    label_width_mm: number
    label_height_mm: number
    display_scale: number
    print_density: number
    print_label_type: number
    print_mode: number
  }
  print_data: JcPrinterPrintData
}

export type AssetLabelTemplatePreset = AssetPrintLabelPayload['template'] & {
  description: string
  is_default: boolean
}

export type AssetLabelTemplateListPayload = {
  items: AssetLabelTemplatePreset[]
  default_template_code: string
}

export type MobilePrinterConnectionMode = 'BLUETOOTH' | 'WIFI'

export type MobilePrinterInfo = {
  id: string
  name: string
  mode: MobilePrinterConnectionMode
  address?: string
  port?: number
  model?: string
  rssi?: number
  online?: boolean
  bridgeRequired?: boolean
}

export type MobilePrinterCapabilities = {
  bluetooth?: boolean
  wifi?: boolean
  systemPrint?: boolean
}

export type MobilePrintJob = {
  source: 'h-melc'
  payload: AssetPrintLabelPayload
  previewDataUrl?: string
  quantity?: number
  connection?: {
    mode: MobilePrinterConnectionMode
    printer: MobilePrinterInfo
  }
}

export type DetectedBarcode = {
  rawValue: string
  format?: string
}

export type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): {
    detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<DetectedBarcode[]>
  }
  getSupportedFormats?: () => Promise<string[]>
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
    JcMobilePrinter?: {
      capabilities?: MobilePrinterCapabilities | (() => MobilePrinterCapabilities | Promise<MobilePrinterCapabilities>)
      scanPrinters?: (options: { mode: MobilePrinterConnectionMode }) => Promise<MobilePrinterInfo[] | { items?: MobilePrinterInfo[] }> | MobilePrinterInfo[] | { items?: MobilePrinterInfo[] }
      connectPrinter?: (options: { mode: MobilePrinterConnectionMode; printer: MobilePrinterInfo }) => Promise<MobilePrinterInfo | { connected?: boolean; printer?: MobilePrinterInfo; message?: string }> | MobilePrinterInfo | { connected?: boolean; printer?: MobilePrinterInfo; message?: string }
      disconnectPrinter?: (options?: { printer?: MobilePrinterInfo }) => Promise<unknown> | unknown
      printLabel?: (job: MobilePrintJob) => Promise<unknown> | unknown
    }
  }

  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        acceptAllDevices?: boolean
        filters?: Array<Record<string, unknown>>
        optionalServices?: Array<string | number>
      }): Promise<{ id?: string; name?: string | null; gatt?: unknown }>
    }
  }
}
