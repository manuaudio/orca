import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false } }))

import type { OrcaProfileCloudSummary } from '../../shared/orca-profiles'
import { ensureActiveOrcaProfile } from '../orca-profiles/profile-index-store'
import {
  linkOrcaProfileToCloud,
  unlinkOrcaProfileFromCloud
} from '../orca-profiles/profile-cloud-index'
import {
  cloudSessionIdentity,
  recordSuccessfulCloudSessionLogin,
  tombstoneCloudSession
} from '../orca-profiles/profile-cloud-session-mutation'
import { ArtifactCloudService } from './artifact-cloud-service'

const createdPaths: string[] = []
const apiUrl = 'http://localhost:3000'
const cloudA: OrcaProfileCloudSummary = {
  cloudProfileId: 'cloud-a',
  userId: 'user-a',
  email: 'a@example.com',
  linkedAt: 1
}
const cloudB: OrcaProfileCloudSummary = {
  cloudProfileId: 'cloud-b',
  userId: 'user-b',
  email: 'b@example.com',
  linkedAt: 2
}

function createResponse(slug = 'artifact-a'): Response {
  return new Response(
    JSON.stringify({
      artifact: {
        version: 1,
        slug,
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
      shareUrl: `https://share.onorca.dev/a/${slug}`,
      editToken: 'edit-secret'
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

async function setup(): Promise<{
  userDataPath: string
  profileId: string
  service: ArtifactCloudService
}> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'orca-artifact-service-'))
  createdPaths.push(userDataPath)
  const active = ensureActiveOrcaProfile(userDataPath)
  linkOrcaProfileToCloud(active.profile.id, cloudA, userDataPath)
  recordSuccessfulCloudSessionLogin(cloudSessionIdentity(active.profile.id, cloudA), userDataPath)
  return {
    userDataPath,
    profileId: active.profile.id,
    service: new ArtifactCloudService(userDataPath)
  }
}

const writeRequest = {
  sourceKey: '/repo/report.html',
  content: '<h1>Hi</h1>',
  contentType: 'text/html' as const,
  fileName: 'report.html',
  apiUrl,
  authToken: 'token-a'
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await Promise.all(
    createdPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('ArtifactCloudService record authorization', () => {
  it('refuses account B update and unshare after account A signs out', async () => {
    const { userDataPath, profileId, service } = await setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createResponse()))
    await service.share(writeRequest)

    tombstoneCloudSession(cloudSessionIdentity(profileId, cloudA), userDataPath)
    unlinkOrcaProfileFromCloud(profileId, userDataPath)
    linkOrcaProfileToCloud(profileId, cloudB, userDataPath)
    recordSuccessfulCloudSessionLogin(cloudSessionIdentity(profileId, cloudB), userDataPath)

    await expect(service.update({ ...writeRequest, authToken: 'token-b' })).rejects.toThrow(
      /has not been shared/
    )
    await expect(
      service.unshare({ sourceKey: writeRequest.sourceKey, apiUrl, authToken: 'token-b' })
    ).rejects.toThrow(/has not been shared/)
  })

  it('does not persist an edit token when a POST completes after relink', async () => {
    const { userDataPath, profileId, service } = await setup()
    let resolvePost: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolvePost = resolve
          })
      )
    )
    const pending = service.share(writeRequest)
    await vi.waitFor(() => expect(resolvePost).toBeTypeOf('function'))

    tombstoneCloudSession(cloudSessionIdentity(profileId, cloudA), userDataPath)
    unlinkOrcaProfileFromCloud(profileId, userDataPath)
    linkOrcaProfileToCloud(profileId, cloudB, userDataPath)
    recordSuccessfulCloudSessionLogin(cloudSessionIdentity(profileId, cloudB), userDataPath)
    resolvePost?.(createResponse())

    await expect(pending).rejects.toThrow(/account changed/)
    await expect(service.update({ ...writeRequest, authToken: 'token-b' })).rejects.toThrow(
      /has not been shared/
    )
  })

  it('allows a POST to finish across a same-account metadata refresh', async () => {
    const { userDataPath, profileId, service } = await setup()
    let resolvePost: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolvePost = resolve
          })
      )
    )
    const pending = service.share(writeRequest)
    await vi.waitFor(() => expect(resolvePost).toBeTypeOf('function'))

    linkOrcaProfileToCloud(
      profileId,
      { ...cloudA, displayName: 'Updated name', linkedAt: 99 },
      userDataPath
    )
    resolvePost?.(createResponse())

    await expect(pending).resolves.toMatchObject({ status: 'ok' })
  })

  it('never scopes an explicit token to the profile linked in the UI', async () => {
    const { service } = await setup()
    const fetchMock = vi.fn().mockResolvedValue(createResponse())
    vi.stubGlobal('fetch', fetchMock)
    await service.share(writeRequest)

    await expect(service.update({ ...writeRequest, authToken: 'token-b' })).rejects.toThrow(
      /has not been shared/
    )
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('cleans all matching source mappings after delete by slug', async () => {
    const { service } = await setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await service.share(writeRequest)
    await service.delete('artifact-a', { apiUrl, authToken: 'token-a' })

    await expect(service.update(writeRequest)).rejects.toThrow(/has not been shared/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
