import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeSecureJsonFile } from '../../shared/secure-file'
import { getOrcaProfileDirectory } from '../orca-profiles/profile-storage-paths'

export type ArtifactShareScope = {
  cloudUserId: string
  cloudProfileId: string
  apiOrigin: string
}

type ArtifactShareRecord = ArtifactShareScope & {
  slug: string
  editToken: string
  shareUrl: string
}

type ArtifactShareRecordFile = {
  version: 2
  lifecycleGeneration: number
  shares: Record<string, ArtifactShareRecord>
}

function recordPath(profileId: string, userDataPath: string): string {
  return join(getOrcaProfileDirectory(profileId, userDataPath), 'artifact-shares.json')
}

function isRecord(value: unknown): value is ArtifactShareRecord {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Partial<ArtifactShareRecord>
  return [
    record.slug,
    record.editToken,
    record.shareUrl,
    record.cloudUserId,
    record.cloudProfileId,
    record.apiOrigin
  ].every((field) => typeof field === 'string' && field.length > 0)
}

function readRecords(profileId: string, userDataPath: string): ArtifactShareRecordFile {
  const path = recordPath(profileId, userDataPath)
  if (!existsSync(path)) {
    return { version: 2, lifecycleGeneration: 0, shares: {} }
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ArtifactShareRecordFile>
    if (parsed.version !== 2 || !parsed.shares || typeof parsed.shares !== 'object') {
      return { version: 2, lifecycleGeneration: 0, shares: {} }
    }
    return {
      version: 2,
      lifecycleGeneration:
        Number.isSafeInteger(parsed.lifecycleGeneration) && Number(parsed.lifecycleGeneration) >= 0
          ? Number(parsed.lifecycleGeneration)
          : 0,
      shares: Object.fromEntries(
        Object.entries(parsed.shares).filter((entry): entry is [string, ArtifactShareRecord] =>
          isRecord(entry[1])
        )
      )
    }
  } catch {
    return { version: 2, lifecycleGeneration: 0, shares: {} }
  }
}

function matchesScope(record: ArtifactShareRecord, scope: ArtifactShareScope): boolean {
  return (
    record.cloudUserId === scope.cloudUserId &&
    record.cloudProfileId === scope.cloudProfileId &&
    record.apiOrigin === scope.apiOrigin
  )
}

export function getArtifactShareRecord(
  profileId: string,
  userDataPath: string,
  sourceKey: string,
  scope: ArtifactShareScope
): ArtifactShareRecord | null {
  const record = readRecords(profileId, userDataPath).shares[sourceKey]
  return record && matchesScope(record, scope) ? record : null
}

export function saveArtifactShareRecord(
  profileId: string,
  userDataPath: string,
  sourceKey: string,
  record: ArtifactShareRecord
): void {
  const records = readRecords(profileId, userDataPath)
  records.shares[sourceKey] = record
  writeSecureJsonFile(recordPath(profileId, userDataPath), records)
}

export function removeArtifactShareRecords(
  profileId: string,
  userDataPath: string,
  scope: ArtifactShareScope,
  match: { sourceKey?: string; slug?: string }
): void {
  const records = readRecords(profileId, userDataPath)
  for (const [sourceKey, record] of Object.entries(records.shares)) {
    if (
      matchesScope(record, scope) &&
      (match.sourceKey === sourceKey || match.slug === record.slug)
    ) {
      delete records.shares[sourceKey]
    }
  }
  writeSecureJsonFile(recordPath(profileId, userDataPath), records)
}

export function clearArtifactShareRecords(profileId: string, userDataPath: string): void {
  const records = readRecords(profileId, userDataPath)
  writeSecureJsonFile(recordPath(profileId, userDataPath), {
    version: 2,
    lifecycleGeneration: records.lifecycleGeneration + 1,
    shares: {}
  })
}

export function captureArtifactShareLifecycle(profileId: string, userDataPath: string): number {
  return readRecords(profileId, userDataPath).lifecycleGeneration
}

export function isArtifactShareLifecycleCurrent(
  profileId: string,
  userDataPath: string,
  lifecycleGeneration: number
): boolean {
  return readRecords(profileId, userDataPath).lifecycleGeneration === lifecycleGeneration
}
