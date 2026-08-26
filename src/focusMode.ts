export function appShellClassName({
  inspectorOpen,
  focusMode,
}: {
  inspectorOpen: boolean
  focusMode: boolean
}): string {
  const classes = ['app-shell', inspectorOpen ? 'inspector-visible' : 'inspector-hidden']
  if (focusMode) classes.push('focus-mode')
  return classes.join(' ')
}
