import { useEffect, useState } from 'react'
import { normalizeRatioForResolution } from '../lib/ratios'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/storage'
import type { AppSettings, AspectRatio, ResolutionTier } from '../types'

const INITIAL_SETTINGS = loadSettings()

function normalizeSettings(next: AppSettings): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...next,
    count: Math.max(1, Math.min(12, Math.round(Number(next.count) || DEFAULT_SETTINGS.count))),
    concurrency: Math.max(1, Math.min(6, Math.round(Number(next.concurrency) || DEFAULT_SETTINGS.concurrency))),
    timeoutSec: Math.max(10, Math.min(900, Math.round(Number(next.timeoutSec) || DEFAULT_SETTINGS.timeoutSec))),
    defaultRatio: next.defaultRatio,
    defaultResolution: next.defaultResolution,
    autoUploadPixhost: next.autoUploadPixhost === true,
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ratio, setRatio] = useState<AspectRatio>(INITIAL_SETTINGS.defaultRatio)
  const [resolution, setResolution] = useState<ResolutionTier>(INITIAL_SETTINGS.defaultResolution)

  function updateSettings(next: AppSettings) {
    const normalized = normalizeSettings(next)
    setSettings(normalized)
    saveSettings(normalized)
  }

  function patchSettings(patch: Partial<AppSettings>) {
    updateSettings({ ...settings, ...patch })
  }

  useEffect(() => {
    setResolution(settings.defaultResolution)
    setRatio(normalizeRatioForResolution(settings.defaultRatio, settings.defaultResolution))
  }, [settings.defaultRatio, settings.defaultResolution])

  return {
    settings,
    settingsOpen,
    ratio,
    resolution,
    setSettingsOpen,
    setRatio,
    setResolution,
    updateSettings,
    patchSettings,
  }
}
