import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  collectExternalFilePathsFromArgv,
  formatExternalOpenError,
  isCandidateExternalFileArg,
  partitionExternalOpenResults,
} from '../electron/externalFileIntake'

describe('external file intake routing', () => {
  it('accepts markdown and text argv paths and skips flags', () => {
    expect(isCandidateExternalFileArg('/tmp/note.md')).toBe(true)
    expect(isCandidateExternalFileArg('/tmp/note.markdown')).toBe(true)
    expect(isCandidateExternalFileArg('/tmp/note.txt')).toBe(true)
    expect(isCandidateExternalFileArg('--enable-logging')).toBe(false)
    expect(isCandidateExternalFileArg('-psn_0_123')).toBe(false)
    expect(isCandidateExternalFileArg('/tmp/photo.png')).toBe(false)
  })

  it('collects unique supported paths from cold-start and second-instance argv', () => {
    const argv = [
      '/Applications/Electron.app/Contents/MacOS/Electron',
      '.',
      '--inspect',
      '/Users/me/Docs/one.md',
      '/Users/me/Docs/one.md',
      '/Users/me/Docs/two.markdown',
      '/Users/me/Docs/three.txt',
      '/Users/me/Docs/ignore.png',
      '-psn_0_857362',
    ]

    expect(
      collectExternalFilePathsFromArgv(argv, {
        resolvePath: (filePath) => filePath,
      }),
    ).toEqual([
      '/Users/me/Docs/one.md',
      '/Users/me/Docs/two.markdown',
      '/Users/me/Docs/three.txt',
    ])
  })

  it('ignores known runtime paths when collecting argv files', () => {
    const entry = '/Users/me/Line/node_modules/electron/cli.js'
    expect(
      collectExternalFilePathsFromArgv([entry, '/tmp/from-dock.md'], {
        resolvePath: (filePath) => filePath,
        ignorePaths: new Set([entry]),
      }),
    ).toEqual(['/tmp/from-dock.md'])
  })
})

describe('external open error surfacing', () => {
  it('formats a single failure with the file name and reason', () => {
    expect(
      formatExternalOpenError([
        {
          filePath: '/tmp/huge.markdown',
          message: 'The selected file is larger than the 10 MB limit.',
        },
      ]),
    ).toBe(
      'Could not open huge.markdown: The selected file is larger than the 10 MB limit.',
    )
  })

  it('formats multiple failures without inventing a new surface string shape', () => {
    expect(
      formatExternalOpenError([
        { filePath: '/tmp/a.md', message: 'missing' },
        { filePath: '/tmp/b.txt', message: 'unsupported' },
        { filePath: '/tmp/c.markdown', message: 'unreadable' },
        { filePath: '/tmp/d.md', message: 'too big' },
      ]),
    ).toBe('Could not open 4 files (a.md, b.txt, c.markdown, and 1 more).')
  })

  it('partitions successful reads from failures for honest reporting', () => {
    const document = {
      id: '/tmp/ok.md',
      path: '/tmp/ok.md',
      name: 'ok.md',
      content: '# ok',
      modifiedAt: null,
      revision: 'rev',
    }

    expect(
      partitionExternalOpenResults([
        { filePath: '/tmp/ok.md', document },
        {
          filePath: '/tmp/missing.txt',
          error: new Error('ENOENT: no such file or directory'),
        },
        {
          filePath: path.join('/tmp', 'bad.markdown'),
          error: 'Line supports .md, .markdown, and .txt files.',
        },
      ]),
    ).toEqual({
      documents: [document],
      failures: [
        {
          filePath: '/tmp/missing.txt',
          message: 'ENOENT: no such file or directory',
        },
        {
          filePath: '/tmp/bad.markdown',
          message: 'Line supports .md, .markdown, and .txt files.',
        },
      ],
    })
  })
})
