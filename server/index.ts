import 'dotenv/config'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response as ExpressResponse } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

type Mode = 'text-to-image' | 'image-to-image'
type BackgroundTaskStatus = 'queued' | 'running' | 'uploading' | 'completed' | 'failed' | 'partial_failed'
type Ratio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9'
type AspectRatio = 'auto' | Ratio
type ResolutionTier = 'auto' | 'standard' | '2k' | '4k'

interface InputImagePayload {
  name?: string
  type?: string
  dataUrl?: string
  size?: number
}

interface BackgroundInputImage {
  name?: string
  type?: string
  url: string
  thumbUrl?: string
  size?: number
}

interface GeneratePayload {
  mode?: Mode
  prompt?: string
  ratio?: AspectRatio
  resolution?: ResolutionTier
  model?: string
  baseUrl?: string
  apiKey?: string
  timeoutSec?: number
  count?: number
  concurrency?: number
  inputImages?: InputImagePayload[]
  inputImage?: InputImagePayload | null
}

interface RetryPayload {
  apiKey?: string
  baseUrl?: string
  timeoutSec?: number
  concurrency?: number
  model?: string
}

interface PixhostUploadPayload {
  image?: string
  fileName?: string
}

interface NormalizedPayload {
  mode: Mode
  prompt: string
  ratio: AspectRatio
  resolution: ResolutionTier
  size: string
  model: string
  baseUrl: string
  apiKey: string
  timeoutSec: number
  count: number
  concurrency: number
  inputImages: InputImagePayload[]
}

interface WorkflowPayload extends Omit<NormalizedPayload, 'inputImages'> {
  inputImages: BackgroundInputImage[]
}

interface ResultItem {
  index: number
  ok: boolean
  image?: string
  mime?: string
  error?: string
  status?: number
  elapsedMs?: number
  remoteUrl?: string
  remoteThumbUrl?: string
  localImageUrl?: string
  localImageBytes?: number
  uploading?: boolean
  uploadError?: string
}

interface PublicTask {
  id: string
  status: BackgroundTaskStatus
  mode: Mode
  prompt: string
  ratio: AspectRatio
  resolution: ResolutionTier
  size: string
  model: string
  count: number
  concurrency: number
  results: ResultItem[]
  error?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
  elapsedMs?: number
  retryOf?: string
}

interface TaskRow {
  id: string
  status: string
  mode: Mode
  prompt: string
  ratio: AspectRatio
  resolution: ResolutionTier
  size: string
  model: string
  count: number
  concurrency: number
  request_json: string
  results_json: string
  error: string | null
  workflow_id: string | null
  retry_of: string | null
  created_at: number
  updated_at: number
  completed_at: number | null
}

interface TaskImageChunkRow {
  data: string
  mime: string
  total_chunks: number
  byte_size: number
}

interface AppConfig {
  port: number
  accessPassword: string
  allowHttpApi: boolean
  allowPrivateHosts: boolean
  dbPath: string
}

const SIZE_MAP: Record<Exclude<ResolutionTier, 'auto'>, Record<Ratio, string>> = {
  standard: {
    '1:1': '1024x1024',
    '2:3': '1024x1536',
    '3:2': '1536x1024',
    '3:4': '768x1024',
    '4:3': '1024x768',
    '9:16': '1008x1792',
    '16:9': '1792x1008',
  },
  '2k': {
    '1:1': '2048x2048',
    '2:3': '1344x2016',
    '3:2': '2016x1344',
    '3:4': '1536x2048',
    '4:3': '2048x1536',
    '9:16': '1152x2048',
    '16:9': '2048x1152',
  },
  '4k': {
    '1:1': '2880x2880',
    '2:3': '2336x3504',
    '3:2': '3504x2336',
    '3:4': '2448x3264',
    '4:3': '3264x2448',
    '9:16': '2160x3840',
    '16:9': '3840x2160',
  },
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Access-Password, Authorization',
}

const PIXHOST_UPLOAD_URL = 'https://api.pixhost.to/images'
const PIXHOST_MAX_BYTES = 10 * 1024 * 1024
const PIXHOST_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif'])

const taskPayloadCache = new Map<string, WorkflowPayload>()
const pendingTaskQueue: string[] = []
const pendingTaskSet = new Set<string>()
let queueRunning = false

const config = loadConfig()
const db = createDatabase(config.dbPath)
setupSchema(db)
markInterruptedTasksAsFailed(db)

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: true }))
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.status(204).set(CORS_HEADERS).end()
    return
  }
  next()
})
app.use('/api', express.json({ limit: '120mb' }))

app.get('/api/health', (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)
  return json(res, { ok: true, message: 'Server is ready', background: true })
})

app.post('/api/generate-stream', async (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  let payload: GeneratePayload
  try {
    payload = req.body as GeneratePayload
  } catch {
    return jsonError(res, 'bad_request', '请求体不是有效 JSON', 400)
  }

  let data: NormalizedPayload
  try {
    data = normalizePayload(payload, config)
  } catch (error) {
    return jsonError(res, 'invalid_config', error instanceof Error ? error.message : '参数无效', 400)
  }

  res.status(200)
  res.set({
    ...CORS_HEADERS,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  })

  let closed = false
  req.on('close', () => { closed = true })

  const send = (event: string, payloadData: unknown) => {
    if (closed) return
    res.write(`event: ${event}\ndata: ${JSON.stringify(payloadData)}\n\n`)
  }

  const pingTimer = setInterval(() => send('ping', { time: Date.now() }), 10_000)
  const startedAt = Date.now()

  try {
    send('start', { mode: data.mode, ratio: data.ratio, resolution: data.resolution, size: data.size, model: data.model, count: data.count })
    const tasks = Array.from({ length: data.count }, (_, index) => () => generateOne(data, index))
    await runPoolWithEmit(tasks, data.concurrency, async (result) => {
      send('result', result)
    })
    send('done', { ok: true, elapsedMs: Date.now() - startedAt })
  } catch (error) {
    send('error', { ok: false, type: 'internal_error', message: error instanceof Error ? error.message : '流式生成失败', status: 500 })
  } finally {
    clearInterval(pingTimer)
    if (!closed) res.end()
  }
})

app.post('/api/upload-pixhost', async (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  const payload = req.body as PixhostUploadPayload
  try {
    const uploaded = await uploadDataUrlToPixhost(payload?.image || '', payload?.fileName)
    return json(res, { ok: true, name: uploaded.name, showUrl: uploaded.showUrl, thumbUrl: uploaded.thumbUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : '图床上传失败'
    return jsonError(res, message.includes('10MB') ? 'bad_request' : 'upstream_error', message, message.includes('10MB') ? 413 : 400)
  }
})

app.get('/api/image-proxy', async (req, res) => {
  const target = String(req.query.url || '')
  let imageUrl: URL

  try {
    imageUrl = new URL(normalizePublicUrl(target))
  } catch {
    return jsonError(res, 'bad_request', '图片代理 URL 无效', 400)
  }

  if (!isAllowedPixhostUrl(imageUrl)) {
    return jsonError(res, 'bad_request', '图片代理仅允许 PiXhost 图片域名', 400)
  }

  try {
    const upstream = await fetch(imageUrl.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*,*/*;q=0.8',
        'User-Agent': 'AI-Image-Generate-VPS/1.0',
      },
    })

    if (!upstream.ok) return jsonError(res, 'upstream_error', `图片代理下载失败：HTTP ${upstream.status}`, upstream.status)

    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream'
    if (!contentType.toLowerCase().startsWith('image/')) return jsonError(res, 'upstream_error', '图片代理只允许图片响应', 415)

    const bytes = Buffer.from(await upstream.arrayBuffer())
    res.status(upstream.status)
    res.set({
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    })
    return res.end(bytes)
  } catch (error) {
    return jsonError(res, 'upstream_error', error instanceof Error ? error.message : '图片代理失败', 502)
  }
})

app.get('/api/stats', (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  const today = getBeijingDateKey(Date.now())
  const todayGenerated = getStatValue(db, `daily_${today}`)
  const totalGenerated = getStatValue(db, 'total_generated')
  return json(res, { ok: true, stats: { today, todayGenerated, totalGenerated } })
})

app.post('/api/background-tasks', async (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  let payload: GeneratePayload
  try {
    payload = req.body as GeneratePayload
  } catch {
    return jsonError(res, 'bad_request', '请求体不是有效 JSON', 400)
  }

  let data: NormalizedPayload
  try {
    data = normalizePayload(payload, config)
  } catch (error) {
    return jsonError(res, 'invalid_config', error instanceof Error ? error.message : '参数无效', 400)
  }

  try {
    const inputImages = data.mode === 'image-to-image' ? await uploadReferenceImages(data.inputImages) : []
    const taskId = createTaskId()
    const now = Date.now()
    const workflowPayload: WorkflowPayload = { ...data, inputImages }

    insertTask(db, {
      id: taskId,
      status: 'queued',
      payload: workflowPayload,
      requestJson: JSON.stringify(toStoredRequest(workflowPayload)),
      createdAt: now,
    })

    taskPayloadCache.set(taskId, workflowPayload)
    enqueueTask(taskId)

    const task = getPublicTaskById(db, taskId)
    return json(res, { ok: true, task })
  } catch (error) {
    return jsonError(res, 'internal_error', error instanceof Error ? error.message : '创建后台任务失败', 500)
  }
})

app.get('/api/background-tasks', (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  const limit = clamp(Number(req.query.limit || 20), 1, 100, 20)
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?').all(limit) as unknown as TaskRow[]
  return json(res, { ok: true, tasks: rows.map(taskFromRow) })
})

app.get('/api/background-tasks/:taskId', (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  const taskId = decodeURIComponent(req.params.taskId)
  const task = getPublicTaskById(db, taskId)
  if (!task) return jsonError(res, 'bad_request', '后台任务不存在', 404)
  return json(res, { ok: true, task })
})

app.post('/api/background-tasks/:taskId/retry', async (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  const taskId = decodeURIComponent(req.params.taskId)
  const row = getTaskRow(db, taskId)
  if (!row) return jsonError(res, 'bad_request', '后台任务不存在', 404)

  const payload = req.body as RetryPayload
  const stored = parseStoredRequest(row.request_json)
  const apiKey = String(payload.apiKey || '').trim()
  if (!apiKey) {
    return jsonError(res, 'invalid_config', '重试后台任务需要当前浏览器重新提供 API Key，服务端不会把 Key 持久化到数据库', 400)
  }

  try {
    const retryId = createTaskId('retry')
    const now = Date.now()
    const workflowPayload: WorkflowPayload = {
      mode: stored.mode,
      prompt: stored.prompt,
      ratio: stored.ratio,
      resolution: stored.resolution,
      size: getImageSize(stored.ratio, stored.resolution),
      model: String(payload.model || stored.model || '').trim(),
      baseUrl: normalizeBaseUrl(String(payload.baseUrl || stored.baseUrl || '').trim(), config),
      apiKey,
      timeoutSec: clamp(Number(payload.timeoutSec ?? stored.timeoutSec), 10, 900, stored.timeoutSec || 420),
      count: clamp(Number(stored.count), 1, 12, 1),
      concurrency: clamp(Number(payload.concurrency ?? stored.concurrency), 1, 6, stored.concurrency || 2),
      inputImages: stored.inputImages || [],
    }

    if (!workflowPayload.model) throw new Error('模型不能为空')
    if (workflowPayload.mode === 'image-to-image' && workflowPayload.inputImages.length === 0) {
      throw new Error('图生图重试缺少已上传的参考图 URL')
    }

    insertTask(db, {
      id: retryId,
      status: 'queued',
      payload: workflowPayload,
      requestJson: JSON.stringify({ ...toStoredRequest(workflowPayload), retryOf: taskId }),
      createdAt: now,
      retryOf: taskId,
    })

    taskPayloadCache.set(retryId, workflowPayload)
    enqueueTask(retryId)

    const task = getPublicTaskById(db, retryId)
    return json(res, { ok: true, task })
  } catch (error) {
    return jsonError(res, 'internal_error', error instanceof Error ? error.message : '创建重试任务失败', 500)
  }
})

app.get('/api/background-tasks/:taskId/images/:index', (req, res) => {
  const authError = requireAccessPassword(req, config)
  if (authError) return jsonError(res, authError.type, authError.message, authError.status)

  const taskId = decodeURIComponent(req.params.taskId)
  const index = Number(req.params.index)
  if (!Number.isInteger(index) || index < 0) return jsonError(res, 'bad_request', '图片序号无效', 400)

  const task = getTaskRow(db, taskId)
  if (!task) return jsonError(res, 'bad_request', '后台任务不存在', 404)

  const first = db
    .prepare('SELECT data, mime, total_chunks, byte_size FROM task_image_chunks WHERE task_id = ? AND result_index = ? AND chunk_index = 0')
    .get(taskId, index) as TaskImageChunkRow | undefined

  if (!first) return jsonError(res, 'bad_request', '本地回传图片不存在或已清理', 404)

  const totalChunks = Number(first.total_chunks)
  const chunks = new Array<string>(totalChunks)
  chunks[0] = first.data

  const chunkStmt = db.prepare('SELECT data FROM task_image_chunks WHERE task_id = ? AND result_index = ? AND chunk_index = ?')
  for (let chunkIndex = 1; chunkIndex < totalChunks; chunkIndex += 1) {
    const row = chunkStmt.get(taskId, index, chunkIndex) as { data: string } | undefined
    if (!row) return jsonError(res, 'internal_error', '本地回传图片分片不完整', 500)
    chunks[chunkIndex] = row.data
  }

  const bytes = base64ToBytes(chunks.join(''))
  res.status(200)
  res.set({
    ...CORS_HEADERS,
    'Content-Type': first.mime || 'image/png',
    'Content-Length': String(bytes.byteLength),
    'Cache-Control': 'private, max-age=86400',
    'Content-Disposition': `inline; filename="ai-image-${taskId}-${index + 1}.${mimeToExtension(first.mime)}"`,
  })
  return res.end(bytes)
})

app.use((err: unknown, _req: Request, res: ExpressResponse, _next: NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    return jsonError(res, 'bad_request', '请求体不是有效 JSON', 400)
  }
  const message = err instanceof Error ? err.message : '服务器内部错误'
  return jsonError(res, 'internal_error', message, 500)
})

const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(config.port, () => {
  console.log(`[server] AI-Image-generate-VPS started on http://0.0.0.0:${config.port}`)
  console.log(`[server] sqlite: ${config.dbPath}`)
  if (!config.accessPassword || config.accessPassword === 'change-me') {
    console.warn('[server] ACCESS_PASSWORD 尚未配置，受保护 API 将返回 503')
  }
})

function enqueueTask(taskId: string) {
  if (pendingTaskSet.has(taskId)) return
  pendingTaskSet.add(taskId)
  pendingTaskQueue.push(taskId)
  void processQueue()
}

async function processQueue() {
  if (queueRunning) return
  queueRunning = true
  try {
    while (pendingTaskQueue.length > 0) {
      const taskId = pendingTaskQueue.shift() as string
      pendingTaskSet.delete(taskId)
      await runBackgroundTask(taskId)
    }
  } finally {
    queueRunning = false
    if (pendingTaskQueue.length > 0) void processQueue()
  }
}

async function runBackgroundTask(taskId: string) {
  const payload = taskPayloadCache.get(taskId)
  if (!payload) {
    markTaskFailed(db, taskId, '任务执行上下文已失效（服务重启或进程重载），请重试并重新提供 API Key')
    return
  }

  const startedAt = Date.now()
  try {
    updateTaskStatus(db, taskId, 'running')

    const generatedResults: ResultItem[] = []
    const tasks = Array.from({ length: payload.count }, (_, index) => async () => {
      const result = await generateOneAndUpload(payload, index, taskId)
      generatedResults[index] = result
      updateTaskResults(db, taskId, 'uploading', generatedResults.filter(Boolean))
      return result
    })

    const results = await runPoolWithEmit(tasks, payload.concurrency, () => undefined)
    const okCount = results.filter((item) => item.ok && (item.remoteUrl || item.localImageUrl)).length

    const status: BackgroundTaskStatus = okCount === payload.count ? 'completed' : okCount > 0 ? 'partial_failed' : 'failed'
    const error =
      status === 'failed'
        ? results
            .map((item) => item.error || item.uploadError)
            .filter(Boolean)
            .join('；')
            .slice(0, 800) || '后台任务失败'
        : undefined

    const completedAt = Date.now()
    finishTask(db, taskId, status, results, error, completedAt)
    if (okCount > 0) incrementGeneratedStats(db, okCount, completedAt)
  } catch (error) {
    const message = error instanceof Error ? error.message : '后台任务执行失败'
    markTaskFailed(db, taskId, message)
  } finally {
    taskPayloadCache.delete(taskId)
    const elapsedMs = Date.now() - startedAt
    console.log(`[background] task ${taskId} done in ${elapsedMs}ms`)
  }
}

function requireAccessPassword(request: Request, appConfig: AppConfig) {
  const expected = appConfig.accessPassword
  if (!expected || expected === 'change-me') {
    return {
      type: 'invalid_config',
      message: '服务端访问密码尚未配置，请先设置 ACCESS_PASSWORD',
      status: 503,
    }
  }

  const header = request.headers['x-access-password']
  const headerPassword = Array.isArray(header) ? header[0] : header
  const authorization = request.headers.authorization || ''
  const bearerPassword = authorization.replace(/^Bearer\s+/i, '').trim()
  const provided = String(headerPassword || bearerPassword || '').trim()

  if (provided !== expected) {
    return {
      type: 'auth_error',
      message: '服务端访问密码错误或缺失',
      status: 401,
    }
  }

  return null
}

function normalizePayload(payload: GeneratePayload, appConfig: AppConfig): NormalizedPayload {
  const mode = payload.mode === 'image-to-image' ? 'image-to-image' : 'text-to-image'
  const prompt = String(payload.prompt || '').trim()
  const resolution = isResolution(payload.resolution) ? payload.resolution : 'standard'
  const rawRatio = isRatio(payload.ratio) ? payload.ratio : 'auto'
  const ratio = resolution === 'auto' ? rawRatio : rawRatio === 'auto' ? '1:1' : rawRatio
  const size = getImageSize(ratio, resolution)
  const model = String(payload.model || '').trim()
  const baseUrl = normalizeBaseUrl(String(payload.baseUrl || '').trim(), appConfig)
  const apiKey = String(payload.apiKey || '').trim()
  const timeoutSec = clamp(Number(payload.timeoutSec), 10, 900, 420)
  const count = clamp(Number(payload.count), 1, 12, 1)
  const concurrency = clamp(Number(payload.concurrency), 1, 6, 2)
  const inputImages = normalizeInputImages(payload)

  if (!prompt) throw new Error('提示词不能为空')
  if (!model) throw new Error('模型不能为空')
  if (!apiKey) throw new Error('API Key 不能为空')
  if (mode === 'image-to-image' && inputImages.length === 0) throw new Error('图生图模式缺少参考图')

  return { mode, prompt, ratio, resolution, size, model, baseUrl, apiKey, timeoutSec, count, concurrency, inputImages }
}

function normalizeInputImages(payload: GeneratePayload) {
  const fromArray = Array.isArray(payload.inputImages) ? payload.inputImages : []
  const legacy = payload.inputImage ? [payload.inputImage] : []
  return [...fromArray, ...legacy].filter((image): image is InputImagePayload => Boolean(image?.dataUrl)).slice(0, 8)
}

function normalizeBaseUrl(value: string, appConfig: AppConfig) {
  if (!value) throw new Error('API URL 不能为空')

  let trimmed = value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/images\/generations$/i, '')
    .replace(/\/images\/edits$/i, '')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('API URL 格式无效')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('API URL 仅支持 http 或 https')
  if (url.protocol === 'http:' && !appConfig.allowHttpApi) throw new Error('当前服务端未允许 HTTP API；如需开启请设置 ALLOW_HTTP_API=true')
  if (!appConfig.allowPrivateHosts && isBlockedHost(url.hostname)) throw new Error('出于安全考虑，默认不允许代理 localhost、内网或 metadata 地址')

  trimmed = url.toString().replace(/\/+$/, '')
  return trimmed
}

function isRatio(value: unknown): value is AspectRatio {
  return value === 'auto' || (typeof value === 'string' && Object.prototype.hasOwnProperty.call(SIZE_MAP.standard, value))
}

function isResolution(value: unknown): value is ResolutionTier {
  return value === 'auto' || value === 'standard' || value === '2k' || value === '4k'
}

function getImageSize(ratio: AspectRatio, resolution: ResolutionTier) {
  if (!isFixedRatio(ratio)) return '自动'
  return SIZE_MAP[isFixedResolution(resolution) ? resolution : 'standard'][ratio]
}

function isFixedRatio(ratio: AspectRatio): ratio is Ratio {
  return ratio !== 'auto'
}

function isFixedResolution(resolution: ResolutionTier): resolution is Exclude<ResolutionTier, 'auto'> {
  return resolution !== 'auto'
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'metadata.google.internal' || host === '169.254.169.254') return true

  const parts = host.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false

  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

async function runPoolWithEmit<T>(tasks: Array<() => Promise<T>>, limit: number, onResult: (result: T) => Promise<void> | void): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let next = 0

  async function worker() {
    while (next < tasks.length) {
      const index = next++
      const result = await tasks[index]()
      results[index] = result
      await onResult(result)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

async function generateOne(payload: NormalizedPayload | WorkflowPayload, index: number): Promise<ResultItem> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('timeout'), payload.timeoutSec * 1000)

  try {
    const upstream = payload.mode === 'image-to-image' ? await callImageEdit(payload, controller.signal) : await callTextImage(payload, controller.signal)

    if (!upstream.ok) {
      return { index, ok: false, status: upstream.status, error: await readUpstreamError(upstream), elapsedMs: Date.now() - startedAt }
    }

    const parsed = await parseImageResponse(upstream, controller.signal)
    if (!parsed.image) return { index, ok: false, error: '上游没有返回可用图片', elapsedMs: Date.now() - startedAt }

    return { index, ok: true, image: parsed.image, mime: parsed.mime, elapsedMs: Date.now() - startedAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { index, ok: false, error: formatFetchError(message), elapsedMs: Date.now() - startedAt }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function generateOneAndUpload(payload: WorkflowPayload, index: number, taskId: string): Promise<ResultItem> {
  const startedAt = Date.now()
  const generated = await generateOne(payload, index)
  if (!generated.ok || !generated.image) return stripImage(generated)

  try {
    const uploaded = await uploadDataUrlToPixhost(generated.image, `ai-image-task-${payload.mode}-${Date.now()}-${index + 1}.png`)
    return {
      index,
      ok: true,
      mime: generated.mime,
      elapsedMs: Date.now() - startedAt,
      remoteUrl: uploaded.showUrl,
      remoteThumbUrl: uploaded.thumbUrl,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PiXhost 上传失败'
    if (/10MB|最大\s*10/i.test(message)) {
      const stored = storeTaskImageForLocalFetch(db, taskId, index, generated.image, generated.mime || 'image/png')
      return {
        index,
        ok: true,
        mime: stored.mime,
        elapsedMs: Date.now() - startedAt,
        localImageUrl: `/api/background-tasks/${encodeURIComponent(taskId)}/images/${index}`,
        localImageBytes: stored.byteSize,
        uploadError: message,
      }
    }
    return {
      index,
      ok: false,
      mime: generated.mime,
      elapsedMs: Date.now() - startedAt,
      error: `生成成功但上传 PiXhost 失败：${message}`,
      uploadError: message,
    }
  }
}

function stripImage(result: ResultItem): ResultItem {
  const { image: _image, ...rest } = result
  return rest
}

function buildUpstreamUrl(baseUrl: string, routePath: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${routePath.replace(/^\/+/, '')}`
}

function normalizeUploadFileName(value: unknown, mime: string) {
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] || 'png'
  const raw = typeof value === 'string' && value.trim() ? value.trim() : `ai-image.${ext}`
  const safe = raw.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 96)
  return /\.[a-z0-9]{2,5}$/i.test(safe) ? safe : `${safe}.${ext}`
}

function normalizePublicUrl(value: string) {
  return value.startsWith('//') ? `https:${value}` : value
}

function isAllowedPixhostUrl(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host !== 'pixhost.to' && !host.endsWith('.pixhost.to')) return false

  return (
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/show/') ||
    url.pathname.startsWith('/thumbs/') ||
    /\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)
  )
}

function toPixhostDirectImageUrl(value: string) {
  const normalized = normalizePublicUrl(value)
  try {
    const url = new URL(normalized)
    const match = url.pathname.match(/^\/show\/([^/]+)\/(.+)$/)
    if (match && /(^|\.)pixhost\.to$/i.test(url.hostname)) return `https://img2.pixhost.to/images/${match[1]}/${match[2]}`
  } catch {
    // ignore
  }
  return normalized
}

async function uploadReferenceImages(inputImages: InputImagePayload[]): Promise<BackgroundInputImage[]> {
  const uploaded: BackgroundInputImage[] = []
  for (let index = 0; index < inputImages.length; index += 1) {
    const inputImage = inputImages[index]
    const result = await uploadDataUrlToPixhost(inputImage.dataUrl || '', inputImage.name || `reference-${index + 1}.png`)
    uploaded.push({
      name: inputImage.name || result.name,
      type: inputImage.type,
      size: inputImage.size,
      url: result.showUrl,
      thumbUrl: result.thumbUrl,
    })
  }
  return uploaded
}

async function uploadDataUrlToPixhost(dataUrl: string, fileName?: string) {
  const { blob, mime } = dataUrlToBlob(dataUrl)
  return uploadBlobToPixhost(blob, mime, fileName)
}

async function uploadBlobToPixhost(blob: Blob, mime: string, fileName?: string) {
  const normalizedMime = mime || blob.type || 'image/png'
  if (!PIXHOST_IMAGE_TYPES.has(normalizedMime)) throw new Error('PiXhost 仅支持 JPG、PNG、GIF 图片')
  if (blob.size > PIXHOST_MAX_BYTES) throw new Error('PiXhost 单张图片最大 10MB')

  const safeFileName = normalizeUploadFileName(fileName, normalizedMime)
  const form = new FormData()
  form.append('img', blob, safeFileName)
  form.append('content_type', '0')
  form.append('max_th_size', '420')

  const upstream = await fetch(PIXHOST_UPLOAD_URL, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  })

  if (!upstream.ok) throw new Error(await readUpstreamError(upstream))

  const data = (await upstream.json()) as Record<string, unknown>
  const showUrl = typeof data.show_url === 'string' ? data.show_url : ''
  const thumbUrl = typeof data.th_url === 'string' ? data.th_url : ''

  if (!showUrl) throw new Error('PiXhost 未返回图片 URL')

  return {
    name: typeof data.name === 'string' ? data.name : safeFileName,
    showUrl: toPixhostDirectImageUrl(showUrl),
    thumbUrl: thumbUrl ? normalizePublicUrl(thumbUrl) : undefined,
  }
}

async function callTextImage(payload: NormalizedPayload | WorkflowPayload, signal: AbortSignal) {
  const body: { model: string; prompt: string; n: number; response_format: string; size?: string } = {
    model: payload.model,
    prompt: payload.prompt,
    n: 1,
    response_format: 'b64_json',
  }

  if (payload.size !== '自动') body.size = payload.size

  return fetch(buildUpstreamUrl(payload.baseUrl, 'images/generations'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.apiKey}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
    signal,
  })
}

async function callImageEdit(payload: NormalizedPayload | WorkflowPayload, signal: AbortSignal) {
  if (!payload.inputImages.length) throw new Error('缺少参考图')

  const form = new FormData()
  form.append('model', payload.model)
  form.append('prompt', payload.prompt)
  if (payload.size !== '自动') form.append('size', payload.size)
  form.append('n', '1')
  form.append('response_format', 'b64_json')

  for (let index = 0; index < payload.inputImages.length; index += 1) {
    const inputImage = payload.inputImages[index]
    const { blob, mime } = await inputImageToBlob(inputImage, signal)
    form.append('image[]', blob, inputImage.name || `input-${index + 1}.${mime.split('/')[1] || 'png'}`)
  }

  return fetch(buildUpstreamUrl(payload.baseUrl, 'images/edits'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.apiKey}`,
      'Cache-Control': 'no-store',
    },
    body: form,
    signal,
  })
}

async function inputImageToBlob(inputImage: InputImagePayload | BackgroundInputImage, signal: AbortSignal): Promise<{ blob: Blob; mime: string }> {
  if ('dataUrl' in inputImage && inputImage.dataUrl) return dataUrlToBlob(inputImage.dataUrl)
  if ('url' in inputImage && inputImage.url) {
    const response = await fetch(inputImage.url, { signal })
    if (!response.ok) throw new Error(`参考图下载失败：HTTP ${response.status}`)
    const mime = response.headers.get('Content-Type') || inputImage.type || 'image/png'
    return { blob: await response.blob(), mime }
  }
  throw new Error('参考图无效')
}

async function readUpstreamError(response: Response) {
  const detail = await readResponseErrorDetail(response)
  return formatHttpError(response.status, detail)
}

async function readResponseErrorDetail(response: Response) {
  const contentType = response.headers.get('Content-Type') || ''
  try {
    if (contentType.includes('application/json')) {
      const data = (await response.json()) as Record<string, unknown>
      const error = data.error as Record<string, unknown> | undefined
      if (typeof error?.message === 'string') return error.message
      if (typeof data.message === 'string') return data.message
      return JSON.stringify(data).slice(0, 800)
    }
    const text = await response.text()
    return text.slice(0, 800)
  } catch {
    return ''
  }
}

function formatFetchError(message: string) {
  if (/abort|timeout|operation was aborted/i.test(message)) return '请求超时：生图通常需要 100-300 秒，请调高超时时间，或使用后台任务模式避免 App 切后台断流'
  if (/524|cloudflare/i.test(message)) return formatCloudflare524Error()
  return message || '请求失败'
}

function formatHttpError(status: number, detail?: string) {
  if (status === 401) return appendErrorDetail('HTTP 401：API Key 错误或额度问题，请检查 Key、账户余额和接口权限', detail)
  if (status === 403) return appendErrorDetail('HTTP 403：无权限访问该接口或模型，模型可能不可用', detail)
  if (status === 413) return appendErrorDetail('HTTP 413：图片太大，请压缩图片、减少参考图或降低分辨率后重试', detail)
  if (status === 429) return appendErrorDetail('HTTP 429：请求过多触发限流，请降低并发、减少张数或稍后重试', detail)
  if (status === 524) return formatCloudflare524Error()
  const fallback = detail?.trim()
  return fallback || `请求失败：HTTP ${status}`
}

function appendErrorDetail(base: string, detail?: string) {
  const clean = detail?.trim()
  if (!clean || clean === base || /^HTTP\s+\d+$/i.test(clean)) return base
  if (/524|cloudflare/i.test(clean)) return formatCloudflare524Error()
  return `${base}；上游详情：${clean.slice(0, 300)}`
}

function formatCloudflare524Error() {
  return 'HTTP 524：Cloudflare 100 秒自动熔断，可切换其他线路域名，或使用后台任务模式重试'
}

async function parseImageResponse(response: Response, signal: AbortSignal): Promise<{ image?: string; mime?: string }> {
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.startsWith('image/')) {
    const blob = await response.blob()
    return { image: await blobToDataUrl(blob, contentType), mime: contentType }
  }

  const payload = (await response.json()) as Record<string, unknown>
  const data = payload.data

  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (typeof record.b64_json === 'string' && record.b64_json.trim()) return { image: normalizeBase64Image(record.b64_json, 'image/png'), mime: 'image/png' }
      if (typeof record.url === 'string' && /^https?:\/\//i.test(record.url)) return fetchImageUrl(record.url, signal)
    }
  }

  return {}
}

async function fetchImageUrl(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`图片 URL 下载失败：HTTP ${res.status}`)
  const mime = res.headers.get('Content-Type') || 'image/png'
  const blob = await res.blob()
  return { image: await blobToDataUrl(blob, mime), mime }
}

function normalizeBase64Image(value: string, fallbackMime: string) {
  return value.startsWith('data:') ? value : `data:${fallbackMime};base64,${value}`
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('参考图 data URL 无效')
  const mime = match[1] || 'image/png'
  const isBase64 = Boolean(match[2])
  const payload = match[3] || ''
  const bytes = isBase64 ? base64ToBytes(payload) : Buffer.from(decodeURIComponent(payload), 'utf8')
  return { blob: new Blob([bytes], { type: mime }), mime }
}

function parseDataUrlParts(dataUrl: string, fallbackMime = 'image/png') {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('图片 data URL 无效')

  const mime = match[1] || fallbackMime
  const isBase64 = Boolean(match[2])
  const payload = match[3] || ''
  const base64 = isBase64 ? payload.replace(/\s/g, '') : bytesToBase64(Buffer.from(decodeURIComponent(payload), 'utf8'))
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const byteSize = Math.max(0, Math.floor((base64.length * 3) / 4) - padding)

  return { mime, base64, byteSize }
}

function bytesToBase64(bytes: Uint8Array | Buffer) {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(base64: string) {
  return Buffer.from(base64.replace(/\s/g, ''), 'base64')
}

async function blobToDataUrl(blob: Blob, fallbackMime: string) {
  const bytes = Buffer.from(await blob.arrayBuffer())
  return `data:${blob.type || fallbackMime};base64,${bytes.toString('base64')}`
}

function createDatabase(dbPath: string) {
  const dir = path.dirname(dbPath)
  fs.mkdirSync(dir, { recursive: true })
  const instance = new DatabaseSync(dbPath)
  instance.exec('PRAGMA journal_mode = WAL')
  instance.exec('PRAGMA busy_timeout = 5000')
  return instance
}

function setupSchema(database: DatabaseSync) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      prompt TEXT NOT NULL,
      ratio TEXT NOT NULL,
      resolution TEXT NOT NULL,
      size TEXT NOT NULL,
      model TEXT NOT NULL,
      count INTEGER NOT NULL,
      concurrency INTEGER NOT NULL,
      request_json TEXT NOT NULL,
      results_json TEXT NOT NULL DEFAULT '[]',
      error TEXT,
      workflow_id TEXT,
      retry_of TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    )`,
    'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
    `CREATE TABLE IF NOT EXISTS stats (
      stat_key TEXT PRIMARY KEY,
      stat_value INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS task_image_chunks (
      task_id TEXT NOT NULL,
      result_index INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      mime TEXT NOT NULL,
      total_chunks INTEGER NOT NULL,
      byte_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (task_id, result_index, chunk_index)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_task_image_chunks_created_at ON task_image_chunks(created_at)',
  ]

  for (const statement of statements) database.prepare(statement).run()
}

function insertTask(
  database: DatabaseSync,
  options: {
    id: string
    status: BackgroundTaskStatus
    payload: WorkflowPayload
    requestJson: string
    createdAt: number
    retryOf?: string
  },
) {
  database
    .prepare(`INSERT INTO tasks (
      id, status, mode, prompt, ratio, resolution, size, model, count, concurrency,
      request_json, results_json, workflow_id, retry_of, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)`)
    .run(
      options.id,
      options.status,
      options.payload.mode,
      options.payload.prompt,
      options.payload.ratio,
      options.payload.resolution,
      options.payload.size,
      options.payload.model,
      options.payload.count,
      options.payload.concurrency,
      options.requestJson,
      options.id,
      options.retryOf || null,
      options.createdAt,
      options.createdAt,
    )
}

function updateTaskStatus(database: DatabaseSync, taskId: string, status: BackgroundTaskStatus) {
  database.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), taskId)
}

function updateTaskResults(database: DatabaseSync, taskId: string, status: BackgroundTaskStatus, results: ResultItem[]) {
  database
    .prepare('UPDATE tasks SET status = ?, results_json = ?, updated_at = ? WHERE id = ?')
    .run(status, JSON.stringify(results.map(stripImage)), Date.now(), taskId)
}

function storeTaskImageForLocalFetch(database: DatabaseSync, taskId: string, index: number, dataUrl: string, fallbackMime: string) {
  const { mime, base64, byteSize } = parseDataUrlParts(dataUrl, fallbackMime)
  const chunkSize = 240 * 1024
  const totalChunks = Math.max(1, Math.ceil(base64.length / chunkSize))
  const now = Date.now()

  const deleteStmt = database.prepare('DELETE FROM task_image_chunks WHERE task_id = ? AND result_index = ?')
  const insertStmt = database.prepare(`INSERT INTO task_image_chunks (
      task_id, result_index, chunk_index, mime, total_chunks, byte_size, created_at, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

  database.exec('BEGIN')
  try {
    deleteStmt.run(taskId, index)
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const chunk = base64.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize)
      insertStmt.run(taskId, index, chunkIndex, mime, totalChunks, byteSize, now, chunk)
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return { mime, byteSize, totalChunks }
}

function finishTask(
  database: DatabaseSync,
  taskId: string,
  status: BackgroundTaskStatus,
  results: ResultItem[],
  error: string | undefined,
  completedAt: number,
) {
  database
    .prepare('UPDATE tasks SET status = ?, results_json = ?, error = ?, updated_at = ?, completed_at = ? WHERE id = ?')
    .run(status, JSON.stringify(results.map(stripImage)), error || null, completedAt, completedAt, taskId)
}

function markTaskFailed(database: DatabaseSync, taskId: string, message: string) {
  const now = Date.now()
  database.prepare('UPDATE tasks SET status = ?, error = ?, updated_at = ?, completed_at = ? WHERE id = ?').run('failed', message, now, now, taskId)
}

function getTaskRow(database: DatabaseSync, taskId: string) {
  return database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
}

function getPublicTaskById(database: DatabaseSync, taskId: string) {
  const row = getTaskRow(database, taskId)
  return row ? taskFromRow(row) : null
}

function taskFromRow(row: TaskRow): PublicTask {
  const results = safeJson<ResultItem[]>(row.results_json, [])
  return {
    id: row.id,
    status: normalizeTaskStatus(row.status),
    mode: row.mode,
    prompt: row.prompt,
    ratio: row.ratio,
    resolution: row.resolution,
    size: row.size,
    model: row.model,
    count: Number(row.count) || 1,
    concurrency: Number(row.concurrency) || 1,
    results,
    error: row.error || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: row.completed_at ? Number(row.completed_at) : undefined,
    elapsedMs: row.completed_at ? Number(row.completed_at) - Number(row.created_at) : Date.now() - Number(row.created_at),
    retryOf: row.retry_of || undefined,
  }
}

function normalizeTaskStatus(value: string): BackgroundTaskStatus {
  if (value === 'queued' || value === 'running' || value === 'uploading' || value === 'completed' || value === 'failed' || value === 'partial_failed') {
    return value
  }
  return 'failed'
}

function toStoredRequest(payload: WorkflowPayload) {
  return {
    mode: payload.mode,
    prompt: payload.prompt,
    ratio: payload.ratio,
    resolution: payload.resolution,
    size: payload.size,
    model: payload.model,
    baseUrl: payload.baseUrl,
    timeoutSec: payload.timeoutSec,
    count: payload.count,
    concurrency: payload.concurrency,
    inputImages: payload.inputImages,
  }
}

function parseStoredRequest(value: string): ReturnType<typeof toStoredRequest> & { retryOf?: string } {
  const parsed = safeJson<ReturnType<typeof toStoredRequest> & { retryOf?: string }>(value, {
    mode: 'text-to-image',
    prompt: '',
    ratio: 'auto',
    resolution: 'standard',
    size: '自动',
    model: '',
    baseUrl: '',
    timeoutSec: 420,
    count: 1,
    concurrency: 2,
    inputImages: [],
  })

  return {
    ...parsed,
    mode: parsed.mode === 'image-to-image' ? 'image-to-image' : 'text-to-image',
    ratio: isRatio(parsed.ratio) ? parsed.ratio : 'auto',
    resolution: isResolution(parsed.resolution) ? parsed.resolution : 'standard',
    inputImages: Array.isArray(parsed.inputImages)
      ? parsed.inputImages.filter((item) => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).slice(0, 8)
      : [],
  }
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function incrementGeneratedStats(database: DatabaseSync, count: number, now: number) {
  const today = getBeijingDateKey(now)
  incrementStat(database, 'total_generated', count, now)
  incrementStat(database, `daily_${today}`, count, now)
}

function incrementStat(database: DatabaseSync, key: string, value: number, now: number) {
  database
    .prepare(`INSERT INTO stats (stat_key, stat_value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(stat_key) DO UPDATE SET stat_value = stat_value + excluded.stat_value, updated_at = excluded.updated_at`)
    .run(key, value, now)
}

function getStatValue(database: DatabaseSync, key: string) {
  const row = database.prepare('SELECT stat_value FROM stats WHERE stat_key = ?').get(key) as { stat_value: number } | undefined
  return Number(row?.stat_value || 0)
}

function getBeijingDateKey(now: number) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function mimeToExtension(mime: string) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/avif') return 'avif'
  return 'png'
}

function createTaskId(prefix = 'task') {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function json(res: ExpressResponse, data: unknown, status = 200) {
  return res.status(status).set({ ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).json(data)
}

function jsonError(res: ExpressResponse, type: string, message: string, status: number) {
  return json(res, { ok: false, type, message, status }, status)
}

function loadConfig(): AppConfig {
  const defaultDbPath = path.join(process.cwd(), 'data', 'app.db')
  return {
    port: clamp(Number(process.env.PORT), 1, 65535, 8787),
    accessPassword: String(process.env.ACCESS_PASSWORD || '').trim(),
    allowHttpApi: parseBoolean(process.env.ALLOW_HTTP_API, true),
    allowPrivateHosts: parseBoolean(process.env.ALLOW_PRIVATE_HOSTS, false),
    dbPath: path.resolve(process.env.DB_PATH || defaultDbPath),
  }
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function markInterruptedTasksAsFailed(database: DatabaseSync) {
  const now = Date.now()
  database
    .prepare(`UPDATE tasks
      SET status = 'failed',
          error = COALESCE(error, '服务重启导致任务中断，请点击重试并重新填写 API Key'),
          updated_at = ?,
          completed_at = ?
      WHERE status IN ('queued', 'running', 'uploading')`)
    .run(now, now)
}
