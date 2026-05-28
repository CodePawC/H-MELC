import { type FormEvent, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  createAiTask,
  fetchAiGatewayMeta,
  fetchAiResult,
  fetchAiTask,
  type AiGatewayMeta,
  type AiTaskType,
} from '../api/aiGateway'

import { ApiClientError } from '../lib/api'

const AI_ROUTE_TITLE: Record<string, string> = {
  '/ai/ops': 'AI助手',
  '/ai/decision': 'AI运营决策',
  '/ai/risk': 'AI风险预测',
  '/ai/predictive-maintenance': 'AI预测性维护',
  '/ai/repair': 'AI维修助手',
  '/ai/voice-dispatch': 'AI语音派单',
  '/ai/task': 'AI自动任务',
  '/ai/qa': 'AI知识问答',
  '/ai/analysis': 'AI运营分析',
  '/ai/rca': 'AI根因分析',
  '/ai/meeting': 'AI会议纪要',
  '/ai/report': 'AI报告生成',
  '/ai/executive-report': 'AI院长简报',
  '/ai/learning': 'AI知识学习',
  '/ai/agents': 'AI智能体中心',
  '/ai/repair-assistant': 'AI维修助手',
  '/ai/invoice-ocr': 'AI票据识别',
  '/ai/payment-analysis': 'AI付款分析',
  '/ai/benefit-analysis': 'AI效益分析',
  '/ai/adverse-analysis': 'AI不良事件分析',
  '/ai/report-generation': 'AI报告生成',
  '/ai/task-log': 'AI任务记录',
}

const TASK_TYPES: AiTaskType[] = [
  'REPAIR_TRIAGE',
  'REPAIR_REPORT',
  'INVOICE_OCR',
  'DELIVERY_OCR',
  'PAYMENT_PRIORITY',
  'INCIDENT_ANALYSIS',
  'ROI_ANALYSIS',
]

/** docs/06 §六：模块说明 + 创建占位任务 + 按 ID 查询任务/结果 */

export function AiGatewayPage() {
  const { pathname } = useLocation()
  const menuTitle = AI_ROUTE_TITLE[pathname] ?? 'AI助手'

  const [meta, setMeta] = useState<AiGatewayMeta | null>(null)

  const [taskType, setTaskType] = useState<AiTaskType>('REPAIR_TRIAGE')
  const [payloadJson, setPayloadJson] = useState('{}\n')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [createOut, setCreateOut] = useState<string | null>(null)

  const [taskId, setTaskId] = useState('')
  const [taskJson, setTaskJson] = useState<string | null>(null)

  const [resultId, setResultId] = useState('')
  const [resultJson, setResultJson] = useState<string | null>(null)

  const [lookupErr, setLookupErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    fetchAiGatewayMeta()
      .then((m) => {
        if (!c) setMeta(m)
      })
      .catch(() => {})
    return () => {
      c = true
    }
  }, [])

  async function onCreate(ev: FormEvent) {
    ev.preventDefault()
    setCreateErr(null)
    setCreateOut(null)
    let payload: Record<string, unknown> = {}
    const raw = payloadJson.trim()
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('须为 JSON 对象')
        }
      } catch (e) {
        setCreateErr(e instanceof Error ? e.message : 'payload 无效')
        return
      }
    }
    setCreateBusy(true)
    try {
      const data = await createAiTask({ task_type: taskType, payload })
      setCreateOut(JSON.stringify(data, null, 2))
    } catch (e) {
      setCreateErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setCreateBusy(false)
    }
  }

  async function loadTask(ev: FormEvent) {
    ev.preventDefault()
    setLookupErr(null)
    setTaskJson(null)
    const id = taskId.trim()
    if (!id) return
    try {
      const d = await fetchAiTask(id)
      setTaskJson(JSON.stringify(d, null, 2))
    } catch (e) {
      setLookupErr(e instanceof ApiClientError ? e.message : String(e))
    }
  }

  async function loadResult(ev: FormEvent) {
    ev.preventDefault()
    setLookupErr(null)
    setResultJson(null)
    const id = resultId.trim()
    if (!id) return
    try {
      const d = await fetchAiResult(id)
      setResultJson(JSON.stringify(d, null, 2))
    } catch (e) {
      setLookupErr(e instanceof ApiClientError ? e.message : String(e))
    }
  }

  return (
    <div className="page ai-gateway-page">
      <h2>{menuTitle}</h2>
      <p className="muted tiny">
        各菜单入口共用网关调试页：<code>POST /api/v1/ai/tasks</code> 创建占位任务；可按 ID 拉取任务/结果。需{' '}
        <code>e007_ai_knowledge</code> 及相应 RBAC。
      </p>

      {meta?.paths && (
        <details className="wf-meta-details tiny muted">
          <summary>网关路径摘要</summary>
          <ul className="bullet">
            {Object.entries(meta.paths).map(([k, v]) => (
              <li key={k}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="wf-panel">
        <h3>创建任务</h3>
        {createErr && <div className="banner danger">{createErr}</div>}
        <form className="wf-start-form card-like" onSubmit={onCreate}>
          <label>
            task_type
            <select value={taskType} onChange={(e) => setTaskType(e.target.value as AiTaskType)}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            payload JSON
            <textarea rows={5} value={payloadJson} onChange={(e) => setPayloadJson(e.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={createBusy}>
            {createBusy ? '创建中…' : '提交'}
          </button>
        </form>
        {createOut && (
          <pre className="mono tiny json-pre">{createOut}</pre>
        )}
      </section>

      <section className="wf-panel">
        <h3>按 ID 查询</h3>
        {lookupErr && <div className="banner danger">{lookupErr}</div>}
        <form className="inline-search wf-inline-stack" onSubmit={loadTask}>
          <input
            placeholder="task_id UUID"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <button type="submit" className="btn">
            加载任务
          </button>
        </form>
        {taskJson && <pre className="mono tiny json-pre">{taskJson}</pre>}

        <form className="inline-search wf-inline-stack" style={{ marginTop: '1rem' }} onSubmit={loadResult}>
          <input
            placeholder="result_id UUID"
            value={resultId}
            onChange={(e) => setResultId(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <button type="submit" className="btn">
            加载结果
          </button>
        </form>
        {resultJson && <pre className="mono tiny json-pre">{resultJson}</pre>}
      </section>

      <p className="muted tiny">产出仅供参考；医疗业务结论须经人工确认。</p>
    </div>
  )
}
