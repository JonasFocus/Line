# Line

Line is a focused macOS Markdown editor built with Electron, React, TypeScript, and Vite.

## MVP features

- Four-pane library, document list, editor, and outline layout
- Create, import, edit, save, and Save As for `.md`, `.markdown`, and `.txt` files
- Editor, split, and rendered preview modes
- Full-library search, folder filters, tags, and starred documents
- Live heading outline with click-to-navigate behavior
- Local recovery for in-progress edits
- Native macOS menu commands and keyboard shortcuts
- Secure context-isolated Electron file bridge

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Package for macOS

```bash
npm run dist
```

The DMG, ZIP, and unpacked application are written to `release/`. Public distribution still requires a Developer ID Application certificate and Apple notarization.
