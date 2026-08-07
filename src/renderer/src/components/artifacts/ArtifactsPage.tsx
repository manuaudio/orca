import { useCallback, useEffect, useRef, useState } from 'react'
import { Files, Loader2, RefreshCw, X } from 'lucide-react'
import type { ArtifactCloudOperation, ArtifactListItem } from '../../../../shared/artifacts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { ArtifactCollection } from './ArtifactCollection'

const LOCAL_RUNTIME = { kind: 'local' } as const
const EMPTY_ARTIFACTS: readonly ArtifactListItem[] = []

export default function ArtifactsPage(): React.JSX.Element {
  const closePage = useAppStore((state) => state.closeArtifactsPage)
  const authStatus = useAppStore((state) => state.orcaProfileAuthStatus)
  const connecting = useAppStore((state) => state.orcaProfileConnecting)
  const connect = useAppStore((state) => state.connectCurrentOrcaProfile)
  const refreshAuth = useAppStore((state) => state.refreshCurrentOrcaProfileAuth)
  const confirm = useConfirmationDialog()
  const [artifactState, setArtifactState] = useState<{
    identity: string | null
    items: readonly ArtifactListItem[]
  }>({ identity: null, items: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ identity: string; slug: string } | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const loadSequence = useRef(0)
  const signedIn = authStatus?.state === 'connected'
  const accountIdentity = signedIn
    ? `${authStatus.activeProfileId}:${authStatus.cloud?.userId ?? ''}:${authStatus.cloud?.cloudProfileId ?? ''}`
    : null
  const accountIdentityRef = useRef(accountIdentity)
  accountIdentityRef.current = accountIdentity
  const artifacts =
    artifactState.identity === accountIdentity ? artifactState.items : EMPTY_ARTIFACTS
  const deletingId = deleting?.identity === accountIdentity ? deleting.slug : null
  const selectedArtifact =
    artifacts.find(({ artifact }) => artifact.slug === selectedSlug) ?? artifacts[0] ?? null

  const loadArtifacts = useCallback(async (): Promise<void> => {
    const sequence = ++loadSequence.current
    if (!accountIdentity) {
      setArtifactState({ identity: null, items: [] })
      setSelectedSlug(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await callRuntimeRpc<ArtifactCloudOperation<readonly ArtifactListItem[]>>(
        LOCAL_RUNTIME,
        'artifacts.list',
        {}
      )
      if (sequence !== loadSequence.current) {
        return
      }
      if (result.status === 'ok') {
        setArtifactState({ identity: accountIdentity, items: result.value })
      } else {
        await refreshAuth()
        setError(
          translate(
            'auto.components.artifacts.ArtifactsPage.signInAgain',
            'Sign in to Orca again to load artifacts.'
          )
        )
      }
    } catch (loadError) {
      if (sequence !== loadSequence.current) {
        return
      }
      console.error('Failed to load artifacts:', loadError)
      setError(
        translate('auto.components.artifacts.ArtifactsPage.loadFailed', 'Could not load artifacts.')
      )
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false)
      }
    }
  }, [accountIdentity, refreshAuth])

  useEffect(() => {
    void loadArtifacts()
    return () => {
      loadSequence.current += 1
    }
  }, [loadArtifacts])

  useEffect(() => {
    setSelectedSlug((current) => {
      if (current && artifacts.some(({ artifact }) => artifact.slug === current)) {
        return current
      }
      return artifacts[0]?.artifact.slug ?? null
    })
  }, [artifacts])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }
      event.preventDefault()
      closePage()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closePage])

  const deleteArtifact = async (item: ArtifactListItem): Promise<void> => {
    const requestedIdentity = accountIdentity
    if (!requestedIdentity) {
      return
    }
    const name = item.artifact.title || item.artifact.originalFileName || item.artifact.slug
    const accepted = await confirm({
      title: translate('auto.components.artifacts.ArtifactsPage.deleteTitle', 'Delete artifact?'),
      description: translate(
        'auto.components.artifacts.ArtifactsPage.deleteDescription',
        '“{{name}}” will no longer be available at its public link.',
        { name }
      ),
      confirmLabel: translate('auto.components.artifacts.ArtifactsPage.delete', 'Delete'),
      confirmVariant: 'destructive'
    })
    if (!accepted || accountIdentityRef.current !== requestedIdentity) {
      return
    }
    setDeleting({ identity: requestedIdentity, slug: item.artifact.slug })
    try {
      const result = await callRuntimeRpc<ArtifactCloudOperation<void>>(
        LOCAL_RUNTIME,
        'artifacts.delete',
        { id: item.artifact.slug }
      )
      if (accountIdentityRef.current !== requestedIdentity) {
        return
      }
      if (result.status !== 'ok') {
        await refreshAuth()
        throw new Error(result.status)
      }
      setArtifactState((current) =>
        current.identity === requestedIdentity
          ? {
              ...current,
              items: current.items.filter(({ artifact }) => artifact.slug !== item.artifact.slug)
            }
          : current
      )
    } catch (deleteError) {
      console.error('Failed to delete artifact:', deleteError)
      if (accountIdentityRef.current === requestedIdentity) {
        setError(
          translate(
            'auto.components.artifacts.ArtifactsPage.deleteFailed',
            'Could not delete the artifact.'
          )
        )
      }
    } finally {
      setDeleting((current) =>
        current?.identity === requestedIdentity && current.slug === item.artifact.slug
          ? null
          : current
      )
    }
  }

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1.5 md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-full"
                onClick={closePage}
                aria-label={translate(
                  'auto.components.artifacts.ArtifactsPage.closeArtifacts',
                  'Close artifacts'
                )}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate('auto.components.artifacts.ArtifactsPage.closeTooltip', 'Close · Esc')}
            </TooltipContent>
          </Tooltip>
          <div className="mx-1 h-5 w-px bg-border/50" aria-hidden />
          <Files className="size-4 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-sm font-semibold">
            {translate('auto.components.artifacts.ArtifactsPage.title', 'Artifacts')}
          </h1>
        </div>
        {signedIn ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="border border-border/50 bg-transparent hover:bg-muted/50"
                onClick={() => void loadArtifacts()}
                disabled={loading}
                aria-label={translate('auto.components.artifacts.ArtifactsPage.refresh', 'Refresh')}
              >
                <RefreshCw className={loading ? 'animate-spin' : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate('auto.components.artifacts.ArtifactsPage.refresh', 'Refresh')}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 border-t border-border/50 px-5 py-5 md:px-8">
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
          {!signedIn ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
              <Files className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">
                  {translate(
                    'auto.components.artifacts.ArtifactsPage.signInHeading',
                    'Sign in to Orca'
                  )}
                </h2>
                <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                  {translate(
                    'auto.components.artifacts.ArtifactsPage.signInCopy',
                    'Artifacts are private to your account until you create a public share link.'
                  )}
                </p>
              </div>
              <Button
                size="sm"
                disabled={connecting || authStatus?.configured !== true}
                onClick={() => void connect()}
              >
                {connecting
                  ? translate('auto.components.artifacts.ArtifactsPage.signingIn', 'Signing in…')
                  : translate('auto.components.artifacts.ArtifactsPage.signIn', 'Sign in to Orca')}
              </Button>
            </div>
          ) : loading && artifacts.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : artifacts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Files className="size-8 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                {translate('auto.components.artifacts.ArtifactsPage.empty', 'No shared artifacts')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.artifacts.ArtifactsPage.emptyCopy',
                  'Ask your agent to share an HTML or Markdown file, and it will appear here.'
                )}
              </p>
            </div>
          ) : (
            selectedArtifact && (
              <ArtifactCollection
                artifacts={artifacts}
                deletingId={deletingId}
                selectedArtifact={selectedArtifact}
                selectArtifact={setSelectedSlug}
                deleteArtifact={(target) => void deleteArtifact(target)}
              />
            )
          )}
          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </main>
  )
}
