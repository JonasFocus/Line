export type EditorMode = 'edit' | 'split' | 'preview'

export function resolveMenuLayoutAction(action: string): EditorMode | null {
  if (action === 'edit-mode') return 'edit'
  if (action === 'split-mode') return 'split'
  if (action === 'preview-mode') return 'preview'
  return null
}
