import { useEffect, useMemo, useRef, useState } from 'react'
import { EyeOutlined, LinkOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'

import {
  fetchAssetLabelTemplates,
  fetchAssetPrintLabel,
  type AssetLabelTemplatePreset,
  type AssetPrintLabelPayload,
} from '../../api/assets'
import { ApiClientError } from '../../lib/api'
import { JcPrinterClient, type JcPrinterInfo } from '../../lib/jcPrinter'
import { renderAssetLabelPreview } from '../../lib/labelPreview'
import {
  buildPrintOptions,
  JC_PRINT_LABEL_TYPE_OPTIONS,
  JC_PRINT_MODE_OPTIONS,
  printLabelTypeName,
  settingsFromTemplate,
  type LabelPrintSettings,
} from '../../lib/printSettings'

export type AssetLabelPrintTarget = {
  asset_id: string
  asset_code: string
  asset_name: string
  main_status?: string | null
}

type Props = {
  targets: AssetLabelPrintTarget[]
  title?: string
}

const DEFAULT_TEMPLATE_CODE = 'ASSET_QR_50X30_V1'
const DEFAULT_SERVICE_URL = 'ws://127.0.0.1:37989'

export function AssetLabelPrintPanel({ targets, title = '资产标签打印' }: Props) {
  const [activeTargetId, setActiveTargetId] = useState(targets[0]?.asset_id ?? '')
  const [labelTemplates, setLabelTemplates] = useState<AssetLabelTemplatePreset[]>([])
  const [selectedTemplateCode, setSelectedTemplateCode] = useState(DEFAULT_TEMPLATE_CODE)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [previewLabel, setPreviewLabel] = useState<AssetPrintLabelPayload | null>(null)
  const [labelLoading, setLabelLoading] = useState(false)
  const [serviceStatus, setServiceStatus] = useState<'idle' | 'connected' | 'error'>('idle')
  const [printers, setPrinters] = useState<JcPrinterInfo[]>([])
  const [selectedPrinterKey, setSelectedPrinterKey] = useState('')
  const [selectedPrinter, setSelectedPrinter] = useState<JcPrinterInfo | null>(null)
  const [printerLoading, setPrinterLoading] = useState(false)
  const [printErr, setPrintErr] = useState<string | null>(null)
  const [printOk, setPrintOk] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [printSettings, setPrintSettings] = useState<LabelPrintSettings>(() => settingsFromTemplate())
  const [progress, setProgress] = useState<string | null>(null)
  const [printTrace, setPrintTrace] = useState<string[]>([])
  const clientRef = useRef<{ url: string; client: JcPrinterClient } | null>(null)

  const activeTarget = useMemo(() => {
    return targets.find((target) => target.asset_id === activeTargetId) ?? targets[0] ?? null
  }, [activeTargetId, targets])

  const printerMap = useMemo(() => {
    return new Map(printers.map((printer) => [printerKey(printer), printer]))
  }, [printers])

  useEffect(() => {
    if (!targets.length) {
      setActiveTargetId('')
      return
    }
    if (!targets.some((target) => target.asset_id === activeTargetId)) {
      setActiveTargetId(targets[0].asset_id)
    }
  }, [activeTargetId, targets])

  useEffect(() => {
    setPreviewLabel(null)
    setPreviewImage(null)
    setPrintOk(null)
  }, [activeTargetId, selectedTemplateCode])

  useEffect(() => {
    let disposed = false
    setTemplateLoading(true)
    fetchAssetLabelTemplates()
      .then((data) => {
        if (disposed) return
        setLabelTemplates(data.items)
        setSelectedTemplateCode(data.default_template_code)
        setPrintSettings(settingsFromTemplate(data.items.find((item) => item.template_code === data.default_template_code)))
      })
      .catch((e) => {
        if (!disposed) setPrintErr(e instanceof ApiClientError ? e.message : String(e))
      })
      .finally(() => {
        if (!disposed) setTemplateLoading(false)
      })
    return () => {
      disposed = true
      clientRef.current?.client.close()
    }
  }, [])

  function getClient(url = DEFAULT_SERVICE_URL) {
    if (!clientRef.current || clientRef.current.url !== url) {
      clientRef.current?.client.close()
      clientRef.current = { url, client: new JcPrinterClient(url) }
    }
    return clientRef.current.client
  }

  async function loadLabel(target: AssetLabelPrintTarget) {
    return fetchAssetPrintLabel(target.asset_id, selectedTemplateCode)
  }

  function updateTemplate(templateCode: string) {
    setSelectedTemplateCode(templateCode)
    const template = labelTemplates.find((item) => item.template_code === templateCode)
    if (template) setPrintSettings(settingsFromTemplate(template))
  }

  async function loadPreviewLabel() {
    if (!activeTarget) {
      setPrintErr('请选择需要打印标签的资产')
      return
    }
    setLabelLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    setPreviewImage(null)
    try {
      const payload = await loadLabel(activeTarget)
      setPreviewLabel(payload)
      setPrintSettings(settingsFromTemplate(payload.template))
      setPreviewImage(await renderAssetLabelPreview(payload))
      setPrintOk(`已加载 ${payload.asset.asset_code} · ${payload.template.template_name}`)
    } catch (e) {
      setPrintErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setLabelLoading(false)
    }
  }

  async function searchPrinters() {
    setPrinterLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    setProgress(null)
    try {
      const client = getClient()
      await client.connect()
      setServiceStatus('connected')
      const usb = await client.getAllPrinters()
      let wifi: JcPrinterInfo[] = []
      try {
        wifi = await client.scanWifiPrinters()
      } catch {
        wifi = []
      }
      const nextPrinters = [...usb, ...wifi]
      setPrinters(nextPrinters)
      const nextSelected = nextPrinters[0]
      setSelectedPrinterKey(nextSelected ? printerKey(nextSelected) : '')
      setSelectedPrinter(null)
      setPrintOk(nextPrinters.length ? `发现 ${nextPrinters.length} 台打印机` : '打印服务已连接，未发现 USB/有线或 WiFi 在线打印机')
    } catch (e) {
      setServiceStatus('error')
      setPrinters([])
      setSelectedPrinter(null)
      setSelectedPrinterKey('')
      setPrintErr(e instanceof Error ? e.message : String(e))
    } finally {
      setPrinterLoading(false)
    }
  }

  async function connectSelectedPrinter() {
    const printer = printerMap.get(selectedPrinterKey)
    if (!printer) {
      setPrintErr('请选择打印机')
      return
    }
    setPrinterLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    try {
      const client = getClient(previewLabel?.sdk.service_ws_url ?? DEFAULT_SERVICE_URL)
      await client.connect()
      await client.selectPrinter(printer)
      await client.initSdk()
      setSelectedPrinter(printer)
      setServiceStatus('connected')
      setPrintOk(`已连接 ${printer.name}`)
    } catch (e) {
      setPrintErr(e instanceof Error ? e.message : String(e))
    } finally {
      setPrinterLoading(false)
    }
  }

  async function previewActiveLabel() {
    if (!activeTarget) {
      setPrintErr('请选择需要预览的资产')
      return
    }
    setLabelLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    setProgress(null)
    try {
      const label = await loadLabel(activeTarget)
      setPreviewLabel(label)
      setPrintSettings(settingsFromTemplate(label.template))
      setPreviewImage(await renderAssetLabelPreview(label))
      setPrintOk('预览图已生成')
    } catch (e) {
      setPrintErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLabelLoading(false)
    }
  }

  async function printTargets() {
    if (!targets.length) {
      setPrintErr('请选择需要打印标签的资产')
      return
    }
    if (!selectedPrinter) {
      setPrintErr('请先连接打印机')
      return
    }
    setPrinterLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    setProgress(`准备打印 ${targets.length} 台资产`)
    setPrintTrace([])
    try {
      let printed = 0
      let currentUrl = ''
      let client = getClient()
      for (const target of targets) {
        setProgress(`正在生成 ${target.asset_code} 标签`)
        const label = await loadLabel(target)
        if (!previewLabel) setPreviewLabel(label)
        if (label.sdk.service_ws_url !== currentUrl) {
          currentUrl = label.sdk.service_ws_url
          client = getClient(currentUrl)
          await client.connect()
          await client.selectPrinter(selectedPrinter)
          await client.initSdk()
        }
        if (!previewImage && printed === 0) {
          setProgress(`正在生成 ${target.asset_code} 标签预览`)
          setPreviewImage(await renderAssetLabelPreview(label))
        }
        await client.print(
          label,
          quantity,
          (message) => setProgress(`${target.asset_code}：${message}`),
          selectedPrinter,
          (message) => setPrintTrace((items) => [...items.slice(-11), `${target.asset_code} ${message}`]),
          buildPrintOptions(printSettings),
        )
        printed += 1
        setProgress(`已打印 ${printed}/${targets.length}：${target.asset_code}`)
      }
      setPrintOk(`已提交 ${targets.length} 台资产，共 ${targets.length * quantity} 张标签`)
      setProgress(null)
    } catch (e) {
      setPrintErr(e instanceof Error ? e.message : String(e))
      setProgress(null)
    } finally {
      setPrinterLoading(false)
    }
  }

  if (!targets.length) {
    return (
      <div className="asset-label-print-panel">
        <p className="muted tiny">请选择需要打印标签的资产。</p>
      </div>
    )
  }

  return (
    <div className="asset-label-print-panel">
      <div className="section-title-row">
        <h3>{title}</h3>
        <span className={`status-pill ${serviceStatus}`}>
          {serviceStatus === 'connected' ? '服务已连接' : serviceStatus === 'error' ? '服务异常' : '待连接'}
        </span>
      </div>

      <div className="asset-label-target-strip">
        {targets.slice(0, 6).map((target) => (
          <button
            key={target.asset_id}
            type="button"
            className={`asset-label-target${target.asset_id === activeTarget?.asset_id ? ' active' : ''}`}
            onClick={() => setActiveTargetId(target.asset_id)}
          >
            <strong>{target.asset_name}</strong>
            <span>{target.asset_code}</span>
          </button>
        ))}
        {targets.length > 6 ? <span className="status-pill">+{targets.length - 6}</span> : null}
      </div>

      <div className="asset-print-toolbar">
        <select value={activeTarget?.asset_id ?? ''} onChange={(e) => setActiveTargetId(e.target.value)} disabled={targets.length <= 1}>
          {targets.map((target) => (
            <option key={target.asset_id} value={target.asset_id}>
              {target.asset_name} · {target.asset_code}
            </option>
          ))}
        </select>
        <select
          value={selectedTemplateCode}
          onChange={(e) => updateTemplate(e.target.value)}
          disabled={templateLoading || !labelTemplates.length}
        >
          {labelTemplates.length ? (
            labelTemplates.map((template) => (
              <option key={template.template_code} value={template.template_code}>
                {template.template_name} · {template.paper_type_name}
              </option>
            ))
          ) : (
            <option value={selectedTemplateCode}>模板加载中</option>
          )}
        </select>
        <button type="button" className="btn" onClick={loadPreviewLabel} disabled={labelLoading}>
          <ReloadOutlined /> {labelLoading ? '加载中' : '加载标签'}
        </button>
        <button type="button" className="btn" onClick={searchPrinters} disabled={printerLoading}>
          <SearchOutlined /> 搜索 USB/WiFi
        </button>
      </div>

      {previewLabel ? (
        <div className="label-summary">
          <strong>{previewLabel.asset.asset_name}</strong>
          <span>{previewLabel.asset.asset_code}</span>
          <span>{previewLabel.template.template_name}</span>
          <span>{previewLabel.template.paper_type_name}</span>
          <span>
            {printSettings.mode === 2 ? '热转印' : '热敏'} · {printLabelTypeName(printSettings.labelType)} · 浓度 {printSettings.density}
          </span>
          <span>
            {previewLabel.template.label_width_mm}×{previewLabel.template.label_height_mm}mm
          </span>
        </div>
      ) : null}

      <div className="print-settings-grid">
        <label>
          打印模式
          <select
            value={printSettings.mode}
            onChange={(e) => setPrintSettings((current) => ({ ...current, mode: Number(e.target.value) === 2 ? 2 : 1 }))}
          >
            {JC_PRINT_MODE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          纸张类型
          <select
            value={printSettings.labelType}
            onChange={(e) => setPrintSettings((current) => ({ ...current, labelType: Number(e.target.value) || 1 }))}
          >
            {JC_PRINT_LABEL_TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          打印浓度
          <input
            type="number"
            min={1}
            max={15}
            value={printSettings.density}
            onChange={(e) =>
              setPrintSettings((current) => ({
                ...current,
                density: Math.min(15, Math.max(1, Math.floor(Number(e.target.value) || 1))),
              }))
            }
          />
        </label>
      </div>

      <div className="asset-print-toolbar">
        <select
          value={selectedPrinterKey}
          onChange={(e) => {
            setSelectedPrinterKey(e.target.value)
            setSelectedPrinter(null)
          }}
          disabled={!printers.length}
        >
          <option value="">选择打印机</option>
          {printers.map((printer) => (
            <option key={printerKey(printer)} value={printerKey(printer)}>
              {printerConnectionLabel(printer)} · {printer.name} · {printer.port}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={connectSelectedPrinter} disabled={!selectedPrinterKey || printerLoading}>
          <LinkOutlined /> 连接
        </button>
        <label className="quantity-field">
          每台份数
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      <div className="asset-print-actions">
        <button type="button" className="btn" onClick={previewActiveLabel} disabled={printerLoading || labelLoading}>
          <EyeOutlined /> 预览当前
        </button>
        <button type="button" className="btn primary" onClick={printTargets} disabled={!selectedPrinter || printerLoading}>
          <PrinterOutlined /> 打印所选 {targets.length} 台
        </button>
      </div>

      {printErr ? <div className="banner danger">{printErr}</div> : null}
      {printOk ? <div className="banner success">{printOk}</div> : null}
      {progress ? <div className="banner ok">{progress}</div> : null}
      {printTrace.length ? (
        <pre className="printer-trace" aria-label="精臣打印服务回执">
          {printTrace.join('\n')}
        </pre>
      ) : null}
      <p className="printer-hint">
        如果 60×40 纸仓走出两张纸，请直接使用“资产二维码 60×40 单张适配”。
      </p>

      <div className="print-preview">
        {previewImage ? (
          <img src={previewImage} alt={`${previewLabel?.asset.asset_code ?? 'asset'} 标签预览`} />
        ) : (
          <span className="muted tiny">暂无预览</span>
        )}
      </div>
    </div>
  )
}

function printerKey(printer: JcPrinterInfo): string {
  return `${printer.connection}:${printer.name}:${printer.port}`
}

function printerConnectionLabel(printer: JcPrinterInfo): string {
  return printer.connection === 'USB' ? 'USB/有线' : 'WiFi'
}
