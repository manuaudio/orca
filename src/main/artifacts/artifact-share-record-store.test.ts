import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearArtifactShareRecords,
  getArtifactShareRecord,
  removeArtifactShareRecords,
  saveArtifactShareRecord,
  type ArtifactShareScope
} from './artifact-share-record-store'

const createdPaths: string[] = []
const scopeA: ArtifactShareScope = {
  cloudUserId: 'user-a',
  cloudProfileId: 'cloud-a',
  apiOrigin: 'https://share.onorca.dev'
}

async function userDataPath(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'orca-artifact-records-'))
  createdPaths.push(path)
  return path
}

afterEach(async () => {
  await Promise.all(
    createdPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('artifact share record store', () => {
  it('isolates edit tokens by cloud identity and API origin', async () => {
    const path = await userDataPath()
    saveArtifactShareRecord('local-profile', path, '/repo/report.html', {
      ...scopeA,
      slug: 'artifact-a',
      editToken: 'secret-a',
      shareUrl: 'https://share.onorca.dev/a/artifact-a'
    })

    expect(
      getArtifactShareRecord('local-profile', path, '/repo/report.html', scopeA)?.editToken
    ).toBe('secret-a')
    expect(
      getArtifactShareRecord('local-profile', path, '/repo/report.html', {
        ...scopeA,
        cloudUserId: 'user-b'
      })
    ).toBeNull()
    expect(
      getArtifactShareRecord('local-profile', path, '/repo/report.html', {
        ...scopeA,
        apiOrigin: 'http://localhost:3000'
      })
    ).toBeNull()
  })

  it('removes every source mapping for a deleted slug in the matching scope', async () => {
    const path = await userDataPath()
    for (const sourceKey of ['/repo/report.html', '/repo/report-copy.html']) {
      saveArtifactShareRecord('local-profile', path, sourceKey, {
        ...scopeA,
        slug: 'artifact-a',
        editToken: 'secret-a',
        shareUrl: 'https://share.onorca.dev/a/artifact-a'
      })
    }

    removeArtifactShareRecords('local-profile', path, scopeA, { slug: 'artifact-a' })

    expect(getArtifactShareRecord('local-profile', path, '/repo/report.html', scopeA)).toBeNull()
    expect(
      getArtifactShareRecord('local-profile', path, '/repo/report-copy.html', scopeA)
    ).toBeNull()
  })

  it('discards unscoped version-one records instead of assigning them to a new login', async () => {
    const path = await userDataPath()
    clearArtifactShareRecords('local-profile', path)
    const recordsPath = join(path, 'profiles', 'local-profile', 'artifact-shares.json')
    await writeFile(
      recordsPath,
      JSON.stringify({
        version: 1,
        shares: {
          '/repo/report.html': {
            slug: 'artifact-a',
            editToken: 'legacy-secret',
            shareUrl: 'https://share.onorca.dev/a/artifact-a'
          }
        }
      })
    )

    expect(getArtifactShareRecord('local-profile', path, '/repo/report.html', scopeA)).toBeNull()
    expect(await readFile(recordsPath, 'utf8')).toContain('legacy-secret')
  })
})
