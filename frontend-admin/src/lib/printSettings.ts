import type { AssetLabelTemplatePreset, AssetPrintLabelPayload } from '../api/assets'
import type { JcPrinterPrintOptions } from './jcPrinter'

type PrintableTemplate = Pick<AssetLabelTemplatePreset, 'print_density' | 'print_label_type' | 'print_mode'>

export type LabelPrintSettings = {
  density: number
  labelType: number
  mode: 1 | 2
}

export const JC_PRINT_MODE_OPTIONS = [
  { value: 1, label: '热敏' },
  { value: 2, label: '热转印' },
] as const

export const JC_PRINT_LABEL_TYPE_OPTIONS = [
  { value: 1, label: '间隙纸' },
  { value: 2, label: '黑标纸' },
  { value: 3, label: '连续纸' },
  { value: 4, label: '过孔纸' },
  { value: 5, label: '透明纸' },
  { value: 6, label: '标牌' },
  { value: 10, label: '黑标间隙纸' },
] as const

export function settingsFromTemplate(template?: PrintableTemplate | AssetPrintLabelPayload['template'] | null): LabelPrintSettings {
  return {
    density: clampInt(template?.print_density ?? 3, 1, 15),
    labelType: Number.isFinite(template?.print_label_type) ? Number(template?.print_label_type) : 1,
    mode: template?.print_mode === 2 ? 2 : 1,
  }
}

export function buildPrintOptions(settings: LabelPrintSettings): JcPrinterPrintOptions {
  return {
    density: clampInt(settings.density, 1, 15),
    labelType: Number.isFinite(settings.labelType) ? settings.labelType : 1,
    mode: settings.mode === 2 ? 2 : 1,
  }
}

export function printLabelTypeName(value: number): string {
  return JC_PRINT_LABEL_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? `类型 ${value}`
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.min(max, Math.max(min, n))
}
