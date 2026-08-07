import type {
  ArtifactCloudOperation,
  ArtifactCloudOptions,
  ArtifactListItem,
  ArtifactWriteRequest
} from '../../shared/artifacts'
import { ensureActiveOrcaProfile } from '../orca-profiles/profile-index-store'
import { getOrcaCloudAuthConfig } from '../orca-profiles/profile-cloud-auth-config'
import { OrcaCloudRequestError } from '../orca-profiles/profile-cloud-client'
import { runWithFreshOrcaCloudSession } from '../orca-profiles/profile-cloud-session-refresh'
import { resolveArtifactCloudApiUrl } from './artifact-cloud-config'
import {
  getArtifactShareRecord,
  removeArtifactShareRecord,
  saveArtifactShareRecord
} from './artifact-share-record-store'

type ArtifactCreateResponse = ArtifactListItem & { editToken: string }

export class ArtifactCloudService {
  constructor(private readonly userDataPath: string) {}

  list(
    options: ArtifactCloudOptions
  ): Promise<ArtifactCloudOperation<readonly ArtifactListItem[]>> {
    return this.withAuth(options, async (token, apiUrl) => {
      const response = await artifactRequest<{ artifacts: ArtifactListItem[] }>(apiUrl, token, '')
      return response.artifacts
    })
  }

  share(request: ArtifactWriteRequest): Promise<ArtifactCloudOperation<ArtifactListItem>> {
    return this.withAuth(request, async (token, apiUrl, profileId) => {
      const response = await artifactRequest<ArtifactCreateResponse>(apiUrl, token, '', {
        method: 'POST',
        body: writeBody(request)
      })
      saveArtifactShareRecord(profileId, this.userDataPath, request.sourceKey, {
        slug: response.artifact.slug,
        editToken: response.editToken,
        shareUrl: response.shareUrl
      })
      return { artifact: response.artifact, shareUrl: response.shareUrl }
    })
  }

  update(request: ArtifactWriteRequest): Promise<ArtifactCloudOperation<ArtifactListItem>> {
    return this.withAuth(request, async (token, apiUrl, profileId) => {
      const record = getArtifactShareRecord(profileId, this.userDataPath, request.sourceKey)
      if (!record) {
        throw new Error('This file has not been shared from the active Orca profile.')
      }
      const response = await artifactRequest<ArtifactListItem>(apiUrl, token, `/${record.slug}`, {
        method: 'PUT',
        editToken: record.editToken,
        body: writeBody(request)
      })
      return response
    })
  }

  unshare(
    request: ArtifactCloudOptions & { sourceKey: string }
  ): Promise<ArtifactCloudOperation<void>> {
    return this.withAuth(request, async (token, apiUrl, profileId) => {
      const record = getArtifactShareRecord(profileId, this.userDataPath, request.sourceKey)
      if (!record) {
        throw new Error('This file has not been shared from the active Orca profile.')
      }
      await artifactRequest<void>(apiUrl, token, `/${record.slug}`, {
        method: 'DELETE',
        editToken: record.editToken
      })
      removeArtifactShareRecord(profileId, this.userDataPath, request.sourceKey)
    })
  }

  delete(id: string, options: ArtifactCloudOptions): Promise<ArtifactCloudOperation<void>> {
    return this.withAuth(options, async (token, apiUrl) => {
      await artifactRequest<void>(apiUrl, token, `/${encodeURIComponent(id)}`, { method: 'DELETE' })
    })
  }

  private async withAuth<T>(
    options: ArtifactCloudOptions,
    operation: (token: string, apiUrl: string, profileId: string) => Promise<T>
  ): Promise<ArtifactCloudOperation<T>> {
    const apiUrl = resolveArtifactCloudApiUrl(options.apiUrl)
    const active = ensureActiveOrcaProfile(this.userDataPath)
    if (options.authToken?.trim()) {
      return {
        status: 'ok',
        value: await operation(options.authToken.trim(), apiUrl, active.profile.id)
      }
    }
    const config = getOrcaCloudAuthConfig()
    if (!config.configured) {
      return { status: 'unconfigured', message: config.setupMessage }
    }
    const result = await runWithFreshOrcaCloudSession(
      config.config,
      active,
      this.userDataPath,
      (session) => operation(session.accessToken, apiUrl, active.profile.id)
    )
    return result.status === 'ok'
      ? { status: 'ok', value: result.value }
      : { status: 'reconnect-required' }
  }
}

function writeBody(request: ArtifactWriteRequest): Record<string, string> {
  return {
    content: request.content,
    contentType: request.contentType,
    fileName: request.fileName,
    ...(request.title ? { title: request.title } : {})
  }
}

async function artifactRequest<T>(
  apiUrl: string,
  token: string,
  path: string,
  options: { method?: string; body?: unknown; editToken?: string } = {}
): Promise<T> {
  const response = await fetch(`${apiUrl}/v1/artifacts${path}`, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.editToken ? { 'x-orca-edit-token': options.editToken } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string } | null
    throw new OrcaCloudRequestError(response.status, body?.code)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
