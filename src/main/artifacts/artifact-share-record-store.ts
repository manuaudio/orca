import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeSecureJsonFile } from '../../shared/secure-file'
import { getOrcaProfileDirectory } from '../orca-profiles/profile-storage-paths'

type ArtifactShareRecord = {
  slug: string
  editToken: string
  shareUrl: string
}

type ArtifactShareRecordFile = {
  version: 1
  shares: Record<string, ArtifactShareRecord>
}

function recordPath(profileId: string, userDataPath: string): string {
  return join(getOrcaProfileDirectory(profileId, userDataPath), 'artifact-shares.json')
}

function readRecords(profileId: string, userDataPath: string): ArtifactShareRecordFile {
  const path = recordPath(profileId, userDataPath)
  if (!existsSync(path)) {
    return { version: 1, shares: {} }
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ArtifactShareRecordFile
    return parsed.version === 1 && parsed.shares ? parsed : { version: 1, shares: {} }
  } catch {
    return { version: 1, shares: {} }
  }
}

export function getArtifactShareRecord(
  profileId: string,
  userDataPath: string,
  sourceKey: string
): ArtifactShareRecord | null {
  return readRecords(profileId, userDataPath).shares[sourceKey] ?? null
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

export function removeArtifactShareRecord(
  profileId: string,
  userDataPath: string,
  sourceKey: string
): void {
  const records = readRecords(profileId, userDataPath)
  delete records.shares[sourceKey]
  writeSecureJsonFile(recordPath(profileId, userDataPath), records)
}
