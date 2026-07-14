export type UnsavedCloseAction = 'save' | 'cancel' | 'close'

export const UNSAVED_CLOSE_BUTTONS = ['Save', 'Cancel', 'Close and Keep Changes'] as const

export function resolveUnsavedCloseAction(response: number): UnsavedCloseAction {
  if (response === 0) return 'save'
  if (response === 2) return 'close'
  return 'cancel'
}
