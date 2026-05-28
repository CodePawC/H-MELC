import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as THREE from 'three'

import { fetchPublicScreen } from '../../api/operationCenter'
import type { PublicScreenPayload } from '../../api/operationCenter'
import { API_BASE_URL } from '../../config'

function maxValue(items: { value: number }[]) {
  return Math.max(...items.map((x) => Number(x.value) || 0), 1)
}

const DEPARTMENTS = [
  { name: 'ICU', level: 'F8', x: 47, y: 19, heat: 92, online: 99.1 },
  { name: '手术室', level: 'F7', x: 58, y: 30, heat: 87, online: 98.7 },
  { name: 'MRI', level: 'F5', x: 37, y: 42, heat: 73, online: 96.4 },
  { name: 'CT', level: 'F4', x: 65, y: 48, heat: 79, online: 97.8 },
  { name: 'DSA', level: 'F6', x: 49, y: 57, heat: 83, online: 98.2 },
  { name: '内镜中心', level: 'F3', x: 29, y: 66, heat: 68, online: 95.6 },
  { name: '急诊', level: 'F1', x: 57, y: 75, heat: 95, online: 99.4 },
]

const IOC_KPIS = [
  { label: '设备资产总值', value: '12.86', unit: '亿元' },
  { label: '在线率', value: '98.72', unit: '%' },
  { label: '急救设备完好率', value: '99.36', unit: '%' },
  { label: '今日维修', value: '37', unit: '单' },
  { label: '当前报警', value: '12', unit: '条' },
  { label: '大型设备运行数', value: '86', unit: '台' },
]

const ALERTS = [
  ['10:42:18', 'ICU 7床呼吸机电池健康度低于阈值', '高'],
  ['10:41:53', 'DSA 机房温湿度联动策略已触发', '中'],
  ['10:40:27', '急诊除颤仪巡检超时自动派单', '高'],
  ['10:38:11', 'MRI 液氦监测数据回传延迟', '中'],
  ['10:35:46', '内镜中心清洗追溯终端恢复在线', '低'],
  ['10:32:04', 'CT 高压发生器完成预防性维护', '低'],
]

function buildDemoPayload(screenCode: string): PublicScreenPayload {
  return {
    screen: { code: screenCode, name: '医学装备数字孪生运营中心' },
    generated_at: new Date().toISOString(),
    refresh_interval_seconds: 15,
    carousel_interval_seconds: 15,
    desensitized: true,
    watermark: 'DEV PREVIEW · IOC DIGITAL TWIN',
    kpis: IOC_KPIS,
    charts: [
      { title: '重点科室在线率', type: 'bar', items: DEPARTMENTS.slice(0, 4).map((x) => ({ name: x.name, value: x.online })) },
      { title: '告警处置闭环', type: 'bar', items: [{ name: '5分钟响应', value: 96 }, { name: '30分钟到场', value: 91 }, { name: '当日闭环', value: 88 }] },
      { title: '大型设备运行负载', type: 'bar', items: DEPARTMENTS.slice(2).map((x) => ({ name: x.name, value: x.heat })) },
      { title: '工单实时吞吐', type: 'bar', items: [{ name: '新建', value: 37 }, { name: '派单', value: 31 }, { name: '维修中', value: 18 }, { name: '验收', value: 26 }] },
    ],
    tables: [{ title: '联动数据', rows: [{ source: 'IoT Gateway', status: '在线', latency: '38ms' }] }],
  }
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function formatClock(d: Date) {
  return d.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function ThreeTechScene() {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 1000)
    camera.position.set(0, 5.2, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const grid = new THREE.GridHelper(13, 28, 0x2dd4bf, 0x0ea5e9)
    grid.position.y = -1.8
    scene.add(grid)

    const building = new THREE.Group()
    Array.from({ length: 8 }).forEach((_, i) => {
      const geometry = new THREE.BoxGeometry(5.6 - i * 0.22, 0.16, 2.6 - i * 0.06)
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x1d9bf0 : 0x2dd4bf,
        transparent: true,
        opacity: 0.16,
        wireframe: true,
      })
      const floor = new THREE.Mesh(geometry, material)
      floor.position.y = i * 0.42
      floor.position.x = Math.sin(i * 0.8) * 0.16
      building.add(floor)
    })
    building.rotation.x = -0.08
    scene.add(building)

    const particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(420 * 3)
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 12
      positions[i + 1] = Math.random() * 7 - 2
      positions[i + 2] = (Math.random() - 0.5) * 7
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.025, transparent: true, opacity: 0.8 }),
    )
    scene.add(particles)

    const lightRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.01, 12, 160),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.62 }),
    )
    lightRing.rotation.x = Math.PI / 2
    lightRing.position.y = -1.72
    scene.add(lightRing)

    let frame = 0
    let animationId = 0
    const animate = () => {
      frame += 0.01
      building.rotation.y = frame * 0.34
      particles.rotation.y = frame * 0.12
      lightRing.scale.setScalar(1 + Math.sin(frame * 2.4) * 0.08)
      renderer.render(scene, camera)
      animationId = window.requestAnimationFrame(animate)
    }
    animate()

    const resize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', resize)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      particleGeometry.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div className="public-screen__three" ref={mountRef} aria-hidden />
}

function FlipNumber({ value }: { value: string | number }) {
  return (
    <strong className="public-screen__flip" key={String(value)}>
      {String(value).split('').map((ch, idx) => <span key={`${ch}-${idx}`}>{ch}</span>)}
    </strong>
  )
}

function DashboardView({ data }: { data: PublicScreenPayload }) {
  const charts = data.charts ?? []
  const tables = data.tables ?? []
  const now = useClock()
  const kpis = IOC_KPIS.map((fallback) => {
    const live = data.kpis?.find((x) => x.label.includes(fallback.label) || fallback.label.includes(x.label))
    return live ? { ...fallback, ...live } : fallback
  })
  const leftCharts = charts.slice(0, 2)
  const rightCharts = charts.slice(2, 4)

  return (
    <div className="public-screen__canvas">
      <div className="public-screen__grid-bg" />
      <div className="public-screen__radar-scan" />
      <div className="public-screen__particles" />
      <header className="public-screen__header">
        <div className="public-screen__title-block">
          <span>智慧医院 IOC</span>
          <h1>{data.screen.name || '医学装备数字孪生运营中心'}</h1>
          <p>Hospital Equipment Digital Twin Command Center</p>
        </div>
        <div className="public-screen__clock">
          <b>{formatClock(now)}</b>
          <span>WebSocket 实时刷新 · {data.refresh_interval_seconds}s 容灾轮询</span>
        </div>
      </header>

      <section className="public-screen__kpis">
        {kpis.map((x) => (
          <div className="public-screen__kpi" key={x.label}>
            <span>{x.label}</span>
            <FlipNumber value={x.value} />
            <em>{x.unit ?? ''}</em>
          </div>
        ))}
      </section>

      <section className="public-screen__ioc-layout">
        <aside className="public-screen__side">
          {(leftCharts.length ? leftCharts : [{ title: '重点科室在线率', type: 'bar', items: DEPARTMENTS.slice(0, 4).map((x) => ({ name: x.name, value: x.online })) }]).map((chart) => {
          const max = maxValue(chart.items)
          return (
            <div className="public-screen__panel" key={chart.title}>
              <h2>{chart.title}</h2>
              <div className="public-screen__bars">
                {chart.items.map((item) => (
                  <div className="public-screen__bar-row" key={item.name}>
                    <span>{item.name}</span>
                    <div><i style={{ width: `${Math.max(8, (Number(item.value) / max) * 100)}%` }} /></div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
          <div className="public-screen__panel">
            <h2>设备健康指数</h2>
            <div className="public-screen__donut"><b>96.8</b><span>综合健康</span></div>
          </div>
        </aside>

        <section className="public-screen__twin">
          <ThreeTechScene />
          <svg className="public-screen__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d="M50 54 C43 48 40 42 37 42" />
            <path d="M50 54 C57 49 61 48 65 48" />
            <path d="M50 54 C51 45 55 35 58 30" />
            <path d="M50 54 C49 39 48 26 47 19" />
            <path d="M50 54 C43 61 35 64 29 66" />
            <path d="M50 54 C55 61 57 70 57 75" />
          </svg>
          <div className="public-screen__hospital-map">
            <div className="public-screen__heat" />
            {DEPARTMENTS.map((dept) => (
              <div
                className="public-screen__dept"
                key={dept.name}
                style={{ left: `${dept.x}%`, top: `${dept.y}%`, ['--heat' as string]: `${dept.heat}%` }}
              >
                <i />
                <b>{dept.name}</b>
                <span>{dept.level} · 在线 {dept.online}%</span>
              </div>
            ))}
            <div className="public-screen__tower">
              {Array.from({ length: 8 }).map((_, idx) => <span key={idx}>F{8 - idx}</span>)}
            </div>
            <div className="public-screen__flow public-screen__flow--a" />
            <div className="public-screen__flow public-screen__flow--b" />
            <div className="public-screen__flow public-screen__flow--c" />
          </div>
        </section>

        <aside className="public-screen__side">
          {(rightCharts.length ? rightCharts : [{ title: '大型设备运行负载', type: 'bar', items: DEPARTMENTS.slice(2).map((x) => ({ name: x.name, value: x.heat })) }]).map((chart) => {
            const max = maxValue(chart.items)
            return (
              <div className="public-screen__panel" key={chart.title}>
                <h2>{chart.title}</h2>
                <div className="public-screen__bars">
                  {chart.items.map((item) => (
                    <div className="public-screen__bar-row" key={item.name}>
                      <span>{item.name}</span>
                      <div><i style={{ width: `${Math.max(8, (Number(item.value) / max) * 100)}%` }} /></div>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="public-screen__panel public-screen__orders">
            <h2>工单流动画</h2>
            <div><span>报修</span><i /><span>派单</span><i /><span>维修</span><i /><span>验收</span></div>
          </div>
        </aside>
      </section>

      <section className="public-screen__alarm-stream">
        <h2>实时告警流</h2>
        <div className="public-screen__ticker">
          {[...ALERTS, ...ALERTS].map((row, idx) => (
            <div className="public-screen__alarm" key={`${row[0]}-${idx}`}>
              <span>{row[0]}</span>
              <b className={`level-${row[2]}`}>{row[2]}</b>
              <em>{row[1]}</em>
            </div>
          ))}
        </div>
        {tables[0]?.rows?.[0] ? <small>联动数据源：{Object.values(tables[0].rows[0]).slice(0, 3).join(' · ')}</small> : null}
      </section>

      <div className="public-screen__watermark">{data.watermark}</div>
    </div>
  )
}

export function PublicScreenPage() {
  const { screenCode, accessKey } = useParams()
  const [payload, setPayload] = useState<PublicScreenPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  useEffect(() => {
    if (!screenCode || !accessKey) return undefined
    let alive = true
    let timer: number | undefined
    const load = async () => {
      try {
        const data = await fetchPublicScreen(screenCode, accessKey)
        if (!alive) return
        setPayload(data)
        setError(null)
        timer = window.setTimeout(load, Math.max(10, data.refresh_interval_seconds || 60) * 1000)
      } catch (e) {
        if (!alive) return
        if (import.meta.env.DEV) {
          setPayload(buildDemoPayload(screenCode))
          setError(null)
          timer = window.setTimeout(load, 30000)
          return
        }
        setError(e instanceof Error ? e.message : String(e))
        timer = window.setTimeout(load, 30000)
      }
    }
    load()
    return () => {
      alive = false
      if (timer) window.clearTimeout(timer)
    }
  }, [accessKey, screenCode])

  const activePayload = useMemo(() => {
    if (!payload?.carousel_items?.length) return payload
    return payload.carousel_items[carouselIndex % payload.carousel_items.length]
  }, [payload, carouselIndex])

  useEffect(() => {
    if (!payload?.carousel_items?.length) return undefined
    const ms = Math.max(5, payload.carousel_interval_seconds || 15) * 1000
    const id = window.setInterval(() => setCarouselIndex((x) => x + 1), ms)
    return () => window.clearInterval(id)
  }, [payload])

  useEffect(() => {
    if (!screenCode || !accessKey) return undefined
    const wsBase = API_BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')
    const ws = new WebSocket(`${wsBase}/screen-ws/${encodeURIComponent(screenCode)}?accessKey=${encodeURIComponent(accessKey)}`)
    ws.onmessage = (event) => {
      try {
        const body = JSON.parse(event.data)
        const next = body?.code === 0 ? body.data : body
        if (next?.screen) setPayload(next as PublicScreenPayload)
      } catch {
        // Ignore non-JSON heartbeat frames; polling remains the fallback refresh path.
      }
    }
    ws.onerror = () => ws.close()
    return () => ws.close()
  }, [accessKey, screenCode])

  if (error && !activePayload) {
    return (
      <div className="public-screen public-screen--error">
        <div>
          <h1>大屏访问失败</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="public-screen">
      {activePayload ? <DashboardView data={activePayload} /> : <div className="public-screen__loading">数字运营中心加载中...</div>}
    </main>
  )
}
