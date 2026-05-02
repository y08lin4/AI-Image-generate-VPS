import type { ComponentProps } from 'react'
import { getRequestModeLabel } from '../lib/appTask'
import { getResolutionLabel } from '../lib/ratios'
import type { AspectRatio, Mode, RequestMode, ResolutionTier } from '../types'
import { TaskQueue } from './TaskQueue'
import { WorksSquare } from './WorksSquare'

interface Props {
  mode: Mode
  ratio: AspectRatio
  resolution: ResolutionTier
  size: string
  requestMode: RequestMode
  concurrency: number
  worksProps: ComponentProps<typeof WorksSquare>
  taskQueueProps: ComponentProps<typeof TaskQueue>
}

export function CanvasWorkspace({
  mode,
  ratio,
  resolution,
  size,
  requestMode,
  concurrency,
  worksProps,
  taskQueueProps,
}: Props) {
  return (
    <section className="canvas-area">
      <div className="canvas-header">
        <div>
          <h2>生成结果</h2>
          <p>
            {mode === 'image-to-image' ? '图生图' : '文生图'} · {ratio} · {getResolutionLabel(resolution)} · {size} · {getRequestModeLabel(requestMode)} · 并发 {concurrency}
          </p>
        </div>
      </div>
      <WorksSquare {...worksProps} />
      <TaskQueue {...taskQueueProps} />
    </section>
  )
}
