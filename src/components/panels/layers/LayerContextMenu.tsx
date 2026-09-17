import { useT } from '@/i18n'
import type { Layer } from '@/types'
import type { ContextMenu } from './constants'

interface LayerContextMenuProps {
  contextMenu: ContextMenu
  layers: Layer[]
  clipboard: Layer[] | null
  onMenuAction: (action: string, layerId: string) => void
}

export function LayerContextMenu({ contextMenu, layers, clipboard, onMenuAction }: LayerContextMenuProps) {
  const t = useT()
  const ctxLayer = layers.find((l) => l.id === contextMenu.layerId)
  const menuItems = [
    { action: 'copy', label: t('layerUi.copy') },
    { action: 'cut', label: t('layerUi.cut') },
    ...(clipboard ? [{ action: 'paste', label: t('layerUi.paste') }] : []),
    { action: 'duplicate', label: t('workspace.duplicate') },
    { action: 'up', label: t('layerUi.up') },
    { action: 'down', label: t('layerUi.down') },
    ...(ctxLayer?.type === 'group' ? [{ action: 'dissolve', label: t('layerUi.ungroup') }] : []),
    { action: 'delete', label: t('workspace.delete') },
  ]

  return (
    <div
      role="menu" className="pd-layer-context fixed z-[var(--pd-z-popover)] py-1 rounded shadow-2xl border"
      style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 208)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 370)), background: 'var(--pd-c-18181f)', borderColor: 'rgba(255,255,255,0.08)', width: 200, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map(({ action, label }) => (
        <button
          role="menuitem" key={action}
          className="w-full text-start px-3 py-2 text-xs text-[var(--pd-c-e8e8f0)] hover:bg-[var(--pd-fill)] transition-colors"
          style={action === 'delete' ? { color: '#f87171' } : undefined}
          onClick={() => onMenuAction(action, contextMenu.layerId)}
        >{label}</button>
      ))}
    </div>
  )
}
