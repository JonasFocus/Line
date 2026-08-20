type ClassListLike = {
  contains: (token: string) => boolean
}

type ElementLike = {
  tagName: string
  classList: ClassListLike
}

function isElementLike(target: unknown): target is ElementLike {
  if (!target || typeof target !== 'object') return false
  if (!('tagName' in target) || !('classList' in target)) return false
  const { tagName, classList } = target
  if (typeof tagName !== 'string') return false
  if (!classList || typeof classList !== 'object' || !('contains' in classList)) return false
  return typeof classList.contains === 'function'
}

export function isMarkdownEditorTarget(target: unknown): boolean {
  return isElementLike(target) && target.tagName === 'TEXTAREA' && target.classList.contains('markdown-source')
}

/** Library search owns Cmd/Ctrl+F only when the markdown editor is not the focus or event target. */
export function shouldFocusLibrarySearchOnFind(
  target: unknown,
  activeElement: unknown = null,
): boolean {
  return !(isMarkdownEditorTarget(target) || isMarkdownEditorTarget(activeElement))
}
