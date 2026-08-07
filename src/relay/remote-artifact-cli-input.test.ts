import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ARTIFACT_CLI_MAX_RPC_BYTES } from '../shared/artifacts'
import { prepareRemoteArtifactCliInput } from './remote-artifact-cli-input'

const createdPaths: string[] = []

async function remoteFolder(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'orca-remote-artifact-'))
  createdPaths.push(path)
  return path
}

afterEach(async () => {
  await Promise.all(
    createdPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('prepareRemoteArtifactCliInput', () => {
  it('reads a folder-workspace file on the SSH host and preserves its source path', async () => {
    const cwd = await remoteFolder()
    await writeFile(join(cwd, 'report.md'), '# Remote report', 'utf8')

    await expect(
      prepareRemoteArtifactCliInput(['artifacts', 'share', 'report.md'], cwd)
    ).resolves.toEqual({
      stdin: '# Remote report',
      artifactInput: {
        sourceKey: join(cwd, 'report.md'),
        fileName: 'report.md',
        contentType: 'text/markdown'
      }
    })
  })

  it('rejects a sparse oversized file from stat metadata before reading its contents', async () => {
    const cwd = await remoteFolder()
    const path = join(cwd, 'sparse.html')
    const handle = await open(path, 'w')
    await handle.truncate(ARTIFACT_CLI_MAX_RPC_BYTES + 1)
    await handle.close()

    await expect(
      prepareRemoteArtifactCliInput(['artifacts', 'share', 'sparse.html'], cwd)
    ).rejects.toThrow(/too large/)
  })

  it('transfers source identity without reading content for unshare', async () => {
    const cwd = await remoteFolder()

    await expect(
      prepareRemoteArtifactCliInput(['artifacts', 'unshare', 'missing.html'], cwd)
    ).resolves.toEqual({
      artifactInput: { sourceKey: join(cwd, 'missing.html'), fileName: 'missing.html' }
    })
  })

  it('keeps worst-case JSON escaping under the relay frame limit', async () => {
    const cwd = await remoteFolder()
    const content = '\u0000'.repeat(ARTIFACT_CLI_MAX_RPC_BYTES)
    await writeFile(join(cwd, 'escaped.md'), content, 'utf8')

    await expect(
      prepareRemoteArtifactCliInput(['artifacts', 'share', 'escaped.md'], cwd)
    ).resolves.toMatchObject({ stdin: content })
  })
})
