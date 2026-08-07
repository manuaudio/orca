import { readFile, stat } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import type {
  ArtifactCloudOperation,
  ArtifactCloudOptions,
  ArtifactListItem,
  ArtifactWriteRequest
} from '../../shared/artifacts'
import { ARTIFACT_CLI_MAX_RPC_BYTES } from '../../shared/artifacts'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { RuntimeClientError } from '../runtime-client'
import { formatArtifactList, formatArtifactShared } from '../artifact-format'
import { printResult } from '../format'

function stringFlag(ctx: HandlerContext, name: string): string | undefined {
  const value = ctx.flags.get(name)
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function requireStringFlag(ctx: HandlerContext, name: string): string {
  const value = stringFlag(ctx, name)
  if (!value) {
    throw new RuntimeClientError('invalid_argument', `Missing required ${name}.`)
  }
  return value
}

function cloudOptions(ctx: HandlerContext): ArtifactCloudOptions {
  const apiUrl = stringFlag(ctx, 'api-url') ?? process.env.ORCA_ARTIFACTS_API_URL?.trim()
  const authToken = stringFlag(ctx, 'auth-token') ?? process.env.ORCA_CLOUD_AUTH_TOKEN?.trim()
  return {
    ...(apiUrl ? { apiUrl } : {}),
    ...(authToken ? { authToken } : {})
  }
}

async function readArtifactRequest(ctx: HandlerContext): Promise<ArtifactWriteRequest> {
  const sourceKey = resolve(ctx.cwd, requireStringFlag(ctx, 'file'))
  const fileStats = await stat(sourceKey).catch(() => null)
  if (!fileStats?.isFile()) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Artifact file was not found or is not a file.'
    )
  }
  const extension = extname(sourceKey).toLowerCase()
  const contentType = ['.html', '.htm'].includes(extension)
    ? 'text/html'
    : ['.md', '.markdown'].includes(extension)
      ? 'text/markdown'
      : null
  if (!contentType) {
    throw new RuntimeClientError('invalid_argument', 'Artifacts must be HTML or Markdown files.')
  }
  const content = await readFile(sourceKey, 'utf8')
  if (!content) {
    throw new RuntimeClientError('invalid_argument', 'Artifact file is empty.')
  }
  const request: ArtifactWriteRequest = {
    sourceKey,
    content,
    contentType,
    fileName: basename(sourceKey),
    ...cloudOptions(ctx)
  }
  if (Buffer.byteLength(JSON.stringify(request), 'utf8') > ARTIFACT_CLI_MAX_RPC_BYTES) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Artifact is too large for the Orca CLI transport. Use the browser upload page instead.'
    )
  }
  return request
}

function requireOperation<T>(operation: ArtifactCloudOperation<T>): T {
  if (operation.status === 'ok') {
    return operation.value
  }
  if (operation.status === 'reconnect-required') {
    throw new RuntimeClientError('authentication_required', 'Sign in to Orca and try again.')
  }
  throw new RuntimeClientError('authentication_unconfigured', operation.message)
}

export const ARTIFACT_HANDLERS: Record<string, CommandHandler> = {
  'artifacts list': async (ctx) => {
    const response = await ctx.client.call<ArtifactCloudOperation<readonly ArtifactListItem[]>>(
      'artifacts.list',
      cloudOptions(ctx)
    )
    const value = requireOperation(response.result)
    printResult({ ...response, result: value }, ctx.json, formatArtifactList)
  },
  'artifacts share': async (ctx) => {
    const response = await ctx.client.call<ArtifactCloudOperation<ArtifactListItem>>(
      'artifacts.share',
      await readArtifactRequest(ctx)
    )
    const value = requireOperation(response.result)
    printResult({ ...response, result: value }, ctx.json, formatArtifactShared)
  },
  'artifacts update': async (ctx) => {
    const response = await ctx.client.call<ArtifactCloudOperation<ArtifactListItem>>(
      'artifacts.update',
      await readArtifactRequest(ctx)
    )
    const value = requireOperation(response.result)
    printResult({ ...response, result: value }, ctx.json, formatArtifactShared)
  },
  'artifacts unshare': async (ctx) => {
    const sourceKey = resolve(ctx.cwd, requireStringFlag(ctx, 'file'))
    const response = await ctx.client.call<ArtifactCloudOperation<void>>('artifacts.unshare', {
      sourceKey,
      ...cloudOptions(ctx)
    })
    requireOperation(response.result)
    printResult({ ...response, result: { deleted: true } }, ctx.json, () => 'Artifact deleted.')
  },
  'artifacts delete': async (ctx) => {
    const response = await ctx.client.call<ArtifactCloudOperation<void>>('artifacts.delete', {
      id: requireStringFlag(ctx, 'id'),
      ...cloudOptions(ctx)
    })
    requireOperation(response.result)
    printResult({ ...response, result: { deleted: true } }, ctx.json, () => 'Artifact deleted.')
  }
}
