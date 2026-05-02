import { AuthPanel } from './AuthPanel'
import { ImageUploader } from './ImageUploader'
import { RatioPicker } from './RatioPicker'
import { ResolutionPicker } from './ResolutionPicker'
import { getAvailableRatios, getResolutionLabel, normalizeRatioForResolution } from '../lib/ratios'
import type { AppSettings, AspectRatio, AuthUser, InputImage, Mode, ResolutionTier } from '../types'

interface Props {
  mode: Mode
  prompt: string
  inputImages: InputImage[]
  settings: AppSettings
  ratio: AspectRatio
  resolution: ResolutionTier
  size: string
  me: AuthUser | null
  authLoading: boolean
  onModeChange: (next: Mode) => void
  onPromptChange: (next: string) => void
  onInputImagesChange: (next: InputImage[]) => void
  onInputImageError: (text: string) => void
  onPatchSettings: (patch: Partial<AppSettings>) => void
  onRatioChange: (next: AspectRatio) => void
  onResolutionChange: (next: ResolutionTier) => void
  onGenerate: () => void
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function GenerateSidebar({
  mode,
  prompt,
  inputImages,
  settings,
  ratio,
  resolution,
  size,
  me,
  authLoading,
  onModeChange,
  onPromptChange,
  onInputImagesChange,
  onInputImageError,
  onPatchSettings,
  onRatioChange,
  onResolutionChange,
  onGenerate,
  onLogin,
  onRegister,
  onLogout,
}: Props) {
  return (
    <aside className="sidebar">
      <section className="panel">
        <label className="label">模式</label>
        <div className="mode-tabs">
          <button type="button" className={mode === 'text-to-image' ? 'active' : ''} onClick={() => onModeChange('text-to-image')}>文生图</button>
          <button type="button" className={mode === 'image-to-image' ? 'active' : ''} onClick={() => onModeChange('image-to-image')}>图生图</button>
        </div>
      </section>

      <section className="panel">
        <label className="label" htmlFor="prompt">提示词</label>
        <textarea
          id="prompt"
          className="prompt-input"
          placeholder={mode === 'text-to-image' ? '描述你想生成的内容...' : '描述你希望如何修改这张图...'}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
      </section>

      {mode === 'image-to-image' ? (
        <section className="panel">
          <label className="label">参考图片</label>
          <ImageUploader images={inputImages} onChange={onInputImagesChange} onError={onInputImageError} />
        </section>
      ) : null}

      <section className="panel">
        <label className="label">模型</label>
        <input
          className="text-input"
          value={settings.model}
          onChange={(e) => onPatchSettings({ model: e.target.value })}
          placeholder="gpt-image-2"
        />
      </section>

      <section className="panel">
        <div className="label-row">
          <label className="label">分辨率档位</label>
          <span>{getResolutionLabel(resolution)}</span>
        </div>
        <ResolutionPicker
          value={resolution}
          onChange={(next) => {
            const nextRatio = normalizeRatioForResolution(ratio, next)
            onResolutionChange(next)
            onRatioChange(nextRatio)
            onPatchSettings({ defaultResolution: next, defaultRatio: nextRatio })
          }}
        />
        <small className="hint-text">先选分辨率，再选比例。分辨率选「自动」时，比例也可以固定；固定比例会按标准档尺寸传给接口。</small>
      </section>

      <section className="panel">
        <div className="label-row">
          <label className="label">比例</label>
          <span>{ratio === 'auto' ? '自动' : ratio}</span>
        </div>
        <RatioPicker
          value={ratio}
          ratios={getAvailableRatios(resolution)}
          onChange={(next) => {
            onRatioChange(next)
            onPatchSettings({ defaultRatio: next })
          }}
        />
        <small className="hint-text">
          当前请求尺寸：{size}。只有「分辨率=自动」且「比例=自动」时才不传 size；只要选择具体比例就会传实际尺寸，避免 16:9 变成竖图。
        </small>
      </section>

      <section className="panel split-2">
        <label className="field compact">
          <span>张数</span>
          <input type="number" min={1} max={12} value={settings.count} onChange={(e) => onPatchSettings({ count: Number(e.target.value) })} />
        </label>
        <label className="field compact">
          <span>超时</span>
          <input type="number" min={10} max={900} value={settings.timeoutSec} onChange={(e) => onPatchSettings({ timeoutSec: Number(e.target.value) })} />
        </label>
      </section>

      <button type="button" className="generate-btn" onClick={onGenerate}>
        提交任务（{settings.count} 张）
      </button>

      <AuthPanel
        me={me}
        loading={authLoading}
        onLogin={onLogin}
        onRegister={onRegister}
        onLogout={onLogout}
      />
    </aside>
  )
}
