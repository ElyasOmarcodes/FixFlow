import { getFixFlowConfig } from '@/config'
import { localStorageAdapter } from './localStorageAdapter'
import type { ProjectStorageAdapter } from './types'

export function getProjectStorage(): ProjectStorageAdapter {
  return getFixFlowConfig().projectStorage ?? localStorageAdapter
}

export * from './types'
