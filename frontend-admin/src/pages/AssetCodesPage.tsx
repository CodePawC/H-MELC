import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { EyeOutlined, LinkOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

import {
  fetchAssetLabelTemplates,
  fetchAssetPrintLabel,
  type AssetLabelTemplatePreset,
  type AssetPrintLabelPayload,
} from '../api/assets'
import { postScanAsset } from '../api/scan'
import { ApiClientError } from '../lib/api'
import { JcPrinterClient, type JcPrinterInfo } from '../lib/jcPrinter'
import { renderAssetLabelPreview } from '../lib/labelPreview'
import {
  buildPrintOptions,
  JC_PRINT_LABEL_TYPE_OPTIONS,
  JC_PRINT_MODE_OPTIONS,
  printLabelTypeName,
  settingsFromTemplate,
  type LabelPrintSettings,
} from '../lib/printSettings'

/** docs/06_接口设计/01 §一·6 扫码解析；PC 侧手工录入 qr_token 解析并跳转台账详情 */

export function AssetCodesPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<{
    asset_id: string
    asset_code: string
    asset_name: string
    main_status: string
  } | null>(null)
  const [assetIdForPrint, setAssetIdForPrint] = useState('')
  const [labelTemplates, setLabelTemplates] = useState<AssetLabelTemplatePreset[]>([])
  const [selectedTemplateCode, setSelectedTemplateCode] = useState('ASSET_QR_50X30_V1')
  const [templateLoading, setTemplateLoading] = useState(false)
  const [printLabel, setPrintLabel] = useState<AssetPrintLabelPayload | null>(null)
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

  const printerMap = useMemo(() => {
    return new Map(printers.map((printer) => [printerKey(printer), printer]))
  }, [printers])

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

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    const qr_token = token.trim()
    if (qr_token.length < 8) {
      setErr('qr_token 长度至少 8 位')
      setResult(null)
      return
    }
    setLoading(true)
    setErr(null)
    setResult(null)
    try {
      const data = await postScanAsset(qr_token)
      setResult(data)
      setAssetIdForPrint(data.asset_id)
      setPrintLabel(null)
      setPreviewImage(null)
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function getClient() {
    const url = printLabel?.sdk.service_ws_url ?? 'ws://127.0.0.1:37989'
    if (!clientRef.current || clientRef.current.url !== url) {
      clientRef.current?.client.close()
      clientRef.current = { url, client: new JcPrinterClient(url) }
    }
    return clientRef.current.client
  }

  async function loadPrintLabel() {
    const assetId = assetIdForPrint.trim()
    if (!assetId) {
      setPrintErr('请先解析二维码，或输入设备 UUID')
      return
    }
    setLabelLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    setPreviewImage(null)
    try {
      const payload = await fetchAssetPrintLabel(assetId, selectedTemplateCode)
      setPrintLabel(payload)
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
      const client = getClient()
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

  async function previewLabel() {
    if (!printLabel) {
      setPrintErr('请先加载资产标签')
      return
    }
    setPrintErr(null)
    setPrintOk(null)
    setProgress(null)
    try {
      setPreviewImage(await renderAssetLabelPreview(printLabel))
      setPrintOk('预览图已生成')
    } catch (e) {
      setPrintErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function printAssetLabel() {
    if (!printLabel) {
      setPrintErr('请先加载资产标签')
      return
    }
    if (!selectedPrinter) {
      setPrintErr('请先连接打印机')
      return
    }
    setPrinterLoading(true)
    setPrintErr(null)
    setPrintOk(null)
    setProgress('正在提交打印任务')
    setPrintTrace([])
    try {
      const client = getClient()
      await client.print(printLabel, quantity, setProgress, selectedPrinter, (message) =>
        setPrintTrace((items) => [...items.slice(-11), message]),
        buildPrintOptions(printSettings),
      )
      setPrintOk(`已提交 ${quantity} 份资产标签`)
      setProgress(null)
    } catch (e) {
      setPrintErr(e instanceof Error ? e.message : String(e))
      setProgress(null)
    } finally {
      setPrinterLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>一机一码管理</h2>
      </div>

      <div className="asset-code-grid">
        <div className="asset-code-panel">
          <div className="section-title-row">
            <h3>二维码解析</h3>
          </div>
          <form className="inline-search" onSubmit={onSubmit} style={{ flexWrap: 'wrap' }}>
            <input
              placeholder="qr_token（≥8 字符）"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ minWidth: 320 }}
              autoComplete="off"
            />
            <button type="submit" className="btn primary" disabled={loading}>
              <SearchOutlined /> {loading ? '解析中' : '解析'}
            </button>
          </form>

          {err && <div className="banner danger">{err}</div>}

          {result && (
            <div className="table-wrap compact-table">
              <table className="data-table">
                <tbody>
                  <tr>
                    <th scope="row">资产编码</th>
                    <td>{result.asset_code}</td>
                  </tr>
                  <tr>
                    <th scope="row">设备名称</th>
                    <td>
                      <Link className="link-inline" to={`/lifecycle/assets/${result.asset_id}`}>
                        {result.asset_name}
                      </Link>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">运行状态</th>
                    <td>{result.main_status}</td>
                  </tr>
                  <tr>
                    <th scope="row">操作</th>
                    <td>
                      <Link className="btn primary" to={`/lifecycle/assets/${result.asset_id}`}>
                        <LinkOutlined /> 打开设备详情
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="asset-code-panel">
          <div className="section-title-row">
            <h3>精臣标签打印（PC USB/有线）</h3>
            <span className={`status-pill ${serviceStatus}`}>
              {serviceStatus === 'connected' ? '服务已连接' : serviceStatus === 'error' ? '服务异常' : '待连接'}
            </span>
          </div>

          <div className="asset-print-toolbar">
            <input
              placeholder="设备 UUID"
              value={assetIdForPrint}
              onChange={(e) => setAssetIdForPrint(e.target.value)}
              autoComplete="off"
            />
            <select
              value={selectedTemplateCode}
              onChange={(e) => {
                setSelectedTemplateCode(e.target.value)
                const template = labelTemplates.find((item) => item.template_code === e.target.value)
                if (template) setPrintSettings(settingsFromTemplate(template))
                setPrintLabel(null)
                setPreviewImage(null)
                setPrintOk(null)
              }}
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
            <button type="button" className="btn" onClick={loadPrintLabel} disabled={labelLoading}>
              <ReloadOutlined /> {labelLoading ? '加载中' : '加载标签'}
            </button>
            <button type="button" className="btn" onClick={searchPrinters} disabled={printerLoading}>
              <SearchOutlined /> 搜索 USB/WiFi
            </button>
          </div>

          {printLabel && (
            <div className="label-summary">
              <strong>{printLabel.asset.asset_name}</strong>
              <span>{printLabel.asset.asset_code}</span>
              <span>{printLabel.template.template_name}</span>
              <span>{printLabel.template.paper_type_name}</span>
              <span>
                {printSettings.mode === 2 ? '热转印' : '热敏'} · {printLabelTypeName(printSettings.labelType)} · 浓度 {printSettings.density}
              </span>
              <span>
                {printLabel.template.label_width_mm}×{printLabel.template.label_height_mm}mm
              </span>
            </div>
          )}

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
              份数
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
            <button type="button" className="btn" onClick={previewLabel} disabled={!printLabel || printerLoading}>
              <EyeOutlined /> 预览
            </button>
            <button type="button" className="btn primary" onClick={printAssetLabel} disabled={!printLabel || !selectedPrinter || printerLoading}>
              <PrinterOutlined /> 打印
            </button>
          </div>

          {printErr && <div className="banner danger">{printErr}</div>}
          {printOk && <div className="banner success">{printOk}</div>}
          {progress && <div className="banner ok">{progress}</div>}
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
              <img src={previewImage} alt={`${printLabel?.asset.asset_code ?? 'asset'} 标签预览`} />
            ) : (
              <span className="muted tiny">暂无预览</span>
            )}
          </div>
        </div>
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
