import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArtifactListItem } from '../../shared/artifacts'
import { ARTIFACT_HANDLERS } from './artifacts'

const item: ArtifactListItem = {
  artifact: {
    version: 1,
    slug: 'artifact-1',
    title: null,
    originalFileName: 'report.html',
    sourceContentType: 'text/html',
    renderedContentType: 'text/html',
    createdAt: '2026-08-06T00:00:00.000Z',
    updatedAt: '2026-08-06T00:00:00.000Z',
    expiresAt: '2026-09-06T00:00:00.000Z',
    byteSize: 12,
    deletedAt: null
  },
  shareUrl: 'https://share.onorca.dev/a/artifact-1'
}

afterEach(() => vi.restoreAllMocks())

describe('artifact CLI handlers', () => {
  it('reads a relative HTML file and sends sanitized content to the runtime', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'orca-artifact-cli-'))
    await writeFile(join(cwd, 'report.html'), '<h1>Hi</h1>', 'utf8')
    const call = vi.fn().mockResolvedValue({
      id: 'request-1',
      ok: true,
      result: { status: 'ok', value: item },
      _meta: { runtimeId: 'runtime-1' }
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await ARTIFACT_HANDLERS['artifacts share']!({
      client: { call } as never,
      cwd,
      flags: new Map([['file', 'report.html']]),
      json: false
    })

    expect(call).toHaveBeenCalledWith(
      'artifacts.share',
      expect.objectContaining({
        sourceKey: join(cwd, 'report.html'),
        content: '<h1>Hi</h1>',
        contentType: 'text/html',
        fileName: 'report.html'
      })
    )
    expect(log).toHaveBeenCalledWith(item.shareUrl)
  })

  it('rejects unsupported file extensions before calling the runtime', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'orca-artifact-cli-'))
    await writeFile(join(cwd, 'report.txt'), 'hello', 'utf8')
    const call = vi.fn()

    await expect(
      ARTIFACT_HANDLERS['artifacts share']!({
        client: { call } as never,
        cwd,
        flags: new Map([['file', 'report.txt']]),
        json: false
      })
    ).rejects.toThrow(/HTML or Markdown/)
    expect(call).not.toHaveBeenCalled()
  })
})
