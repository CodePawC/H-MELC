import QRCode from 'qrcode'

import type { AssetPrintLabelPayload, JcPrinterElement } from '../api/assets'

function elementPayload(element: JcPrinterElement): Record<string, unknown> {
  return element.json ?? element.payload ?? {}
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let next = text
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1)
  }
  return `${next}...`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('二维码预览生成失败'))
    image.src = src
  })
}

async function drawQrCode(ctx: CanvasRenderingContext2D, element: JcPrinterElement, scale: number): Promise<void> {
  const data = elementPayload(element)
  const value = asString(data.value)
  if (!value) return
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#020617', light: '#ffffff' },
  })
  const image = await loadImage(dataUrl)
  ctx.drawImage(
    image,
    asNumber(data.x) * scale,
    asNumber(data.y) * scale,
    asNumber(data.width, 10) * scale,
    asNumber(data.height, 10) * scale,
  )
}

function drawText(ctx: CanvasRenderingContext2D, element: JcPrinterElement, scale: number): void {
  const data = elementPayload(element)
  const x = asNumber(data.x) * scale
  const y = asNumber(data.y) * scale
  const width = asNumber(data.width, 20) * scale
  const height = asNumber(data.height, 8) * scale
  const fontSize = Math.max(9, asNumber(data.fontSize, 2.5) * scale * 0.88)
  const lineSpacing = Math.max(0, asNumber(data.lineSpacing, 1) * scale * 0.2)
  const fontStyle = Array.isArray(data.fontStyle) ? data.fontStyle : []
  const weight = fontStyle[0] ? 700 : 600
  const lines = asString(data.value).split('\n')
  if (!lines.length) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.fillStyle = '#0f172a'
  ctx.textBaseline = 'top'
  ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif`

  let cursorY = y
  const step = fontSize * 1.18 + lineSpacing
  for (const line of lines) {
    if (cursorY + fontSize > y + height + 1) break
    ctx.fillText(truncateText(ctx, line, width), x, cursorY)
    cursorY += step
  }
  ctx.restore()
}

function drawLine(ctx: CanvasRenderingContext2D, element: JcPrinterElement, scale: number): void {
  const data = elementPayload(element)
  const x = asNumber(data.x) * scale
  const y = asNumber(data.y) * scale
  const width = asNumber(data.width, 0) * scale
  const height = asNumber(data.height, 0) * scale
  ctx.save()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = Math.max(1, asNumber(data.lineWidth, 0.2) * scale)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y + height)
  ctx.stroke()
  ctx.restore()
}

function drawGraph(ctx: CanvasRenderingContext2D, element: JcPrinterElement, scale: number): void {
  const data = elementPayload(element)
  const x = asNumber(data.x) * scale
  const y = asNumber(data.y) * scale
  const width = asNumber(data.width, 0) * scale
  const height = asNumber(data.height, 0) * scale
  ctx.save()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = Math.max(1, asNumber(data.lineWidth, 0.2) * scale)
  ctx.strokeRect(x, y, width, height)
  ctx.restore()
}

export async function renderAssetLabelPreview(payload: AssetPrintLabelPayload): Promise<string> {
  const board = payload.print_data.InitDrawingBoardParam
  const scale = 12
  const width = Math.max(board.width * scale, 280)
  const height = Math.max(board.height * scale, 180)
  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, width - 2, height - 2)

  for (const element of payload.print_data.elements) {
    if (element.type === 'qrCode') await drawQrCode(ctx, element, scale)
    if (element.type === 'text') drawText(ctx, element, scale)
    if (element.type === 'line') drawLine(ctx, element, scale)
    if (element.type === 'graph') drawGraph(ctx, element, scale)
  }

  return canvas.toDataURL('image/png')
}
