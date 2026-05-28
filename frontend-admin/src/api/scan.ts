/** 对齐 docs/06_接口设计/01 §一·6 POST /api/v1/scan/asset */

import { apiRequest } from '../lib/api'

export type ScanAssetResult = {
  asset_id: string
  asset_code: string
  asset_name: string
  main_status: string
}

export function postScanAsset(qr_token: string) {
  return apiRequest<ScanAssetResult>('/api/v1/scan/asset', {
    method: 'POST',
    body: JSON.stringify({ qr_token }),
  })
}
