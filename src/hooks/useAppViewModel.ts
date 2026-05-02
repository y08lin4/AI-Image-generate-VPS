import { useAppDataFlow } from './useAppDataFlow'
import { useAppUiBindings } from './useAppUiBindings'

export function useAppViewModel() {
  const flow = useAppDataFlow()
  return useAppUiBindings(flow)
}
