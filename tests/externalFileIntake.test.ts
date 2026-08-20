import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  collectExternalFilePathsFromArgv,
  formatExternalOpenError,
  isCandidateExternalFileArg,
  partitionExternalOpenResults,
  settleDocumentReads,
  toOpenFilesResult,
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

describe('File → Open batch settle', () => {
  it('keeps good files when one read fails and does not abort the batch', async () => {
    const ok = { id: 'ok', content: '# ok' }
    const { documents, failures } = await settleDocumentReads(
      ['/tmp/ok.md', '/tmp/bad.md', '/tmp/also-ok.txt'],
      async (filePath) => {
        if (filePath.endsWith('bad.md')) {
          throw new Error('The selected file is larger than the 10 MB limit.')
        }
        if (filePath.endsWith('ok.md')) return ok
        return { id: 'also', content: 'text' }
      },
    )

    expect(documents).toEqual([ok, { id: 'also', content: 'text' }])
    expect(failures).toEqual([
      {
        filePath: '/tmp/bad.md',
        message: 'The selected file is larger than the 10 MB limit.',
      },
    ])
  })

  it('aggregates failures onto the open result without dropping successes', async () => {
    const document = { id: '/tmp/ok.md', content: '# ok' }
    const settled = await settleDocumentReads(['/tmp/ok.md', '/tmp/gone.md'], async (filePath) => {
      if (filePath.endsWith('gone.md')) {
        throw new Error('ENOENT: no such file or directory')
      }
      return document
    })

    expect(toOpenFilesResult(settled.documents, settled.failures)).toEqual({
      documents: [document],
      error: 'Could not open gone.md: ENOENT: no such file or directory',
    })
  })

  it('returns documents only when every read succeeds', () => {
    expect(toOpenFilesResult([{ id: 'a' }], [])).toEqual({
      documents: [{ id: 'a' }],
    })
  })

  it('still reports an error when every selected file fails', async () => {
    const settled = await settleDocumentReads(['/tmp/a.md', '/tmp/b.md'], async () => {
      throw new Error('permission denied')
    })

    expect(toOpenFilesResult(settled.documents, settled.failures)).toEqual({
      documents: [],
      error: 'Could not open 2 files (a.md, b.md).',
    })
  })
})
