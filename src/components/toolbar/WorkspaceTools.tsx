import { useRef } from 'react'
import { useEditorStore } from '@/store'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'

export function WorkspaceTools({ onProperties }: { onProperties: () => void }) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const selection = useEditorStore((s) => s.selection)
  const addText = () => {
    const store = useEditorStore.getState()
    store.addText()
    const id = useEditorStore.getState().selection?.layerId
    if (id) store.startTextEdit(id)
  }
  return <nav className="pd-workspace-tools" aria-label={t('workspace.tools')}>
    <button title={t('workspace.fit')} onClick={() => window.dispatchEvent(new Event('pixeldeck:fit'))}><Icon name="maximize" size={20} /><span>{t('workspace.fit')}</span></button>
    <button title={t('workspace.addText')} onClick={addText}><Icon name="text" size={20} /><span>{t('workspace.addText')}</span></button>
    <button title={t('workspace.image')} onClick={() => input.current?.click()}><Icon name="image" size={20} /><span>{t('workspace.image')}</span></button>
    <button title={t('workspace.shape')} onClick={() => { useEditorStore.getState().addShape(); onProperties() }}><Icon name="shape" size={20} /><span>{t('workspace.shape')}</span></button>
    <div className="pd-tool-divider" />
    <button title={t('workspace.duplicate')} disabled={!selection?.layerId} onClick={() => { if (selection?.layerId) useEditorStore.getState().duplicateLayer(selection.layerId) }}><Icon name="copy" size={20} /><span>{t('workspace.duplicate')}</span></button>
    <button title={t('workspace.delete')} disabled={!selection?.layerId} onClick={() => { if (selection?.layerId) useEditorStore.getState().removeLayer(selection.layerId) }}><Icon name="trash" size={20} /><span>{t('workspace.delete')}</span></button>
    <input hidden ref={input} type="file" accept="image/*" onChange={(event) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const image = new Image()
        image.onload = () => { useEditorStore.getState().addImage(reader.result as string, image.naturalWidth, image.naturalHeight); onProperties() }
        image.src = reader.result as string
      }
      reader.readAsDataURL(file)
      event.target.value = ''
    }} />
  </nav>
}
