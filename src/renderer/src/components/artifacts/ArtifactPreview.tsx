import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE } from '../../../../shared/browser-guest-web-preferences'
import { moveFocusToRendererBeforeWebviewDetach } from '@/components/browser-pane/webview-registry'
import { translate } from '@/i18n/i18n'

type PreviewState = 'loading' | 'ready' | 'unavailable'

function attachArtifactWebview({
  container,
  partition,
  shareUrl,
  onLoadStarted,
  onLoadStopped,
  onLoadFailed
}: {
  container: HTMLDivElement
  partition: string
  shareUrl: string
  onLoadStarted: () => void
  onLoadStopped: () => void
  onLoadFailed: () => void
}): () => void {
  const webview = document.createElement('webview') as Electron.WebviewTag
  webview.setAttribute('partition', partition)
  webview.setAttribute('webpreferences', ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE)
  webview.setAttribute(
    'aria-label',
    translate('auto.components.artifacts.preview', 'Artifact preview')
  )
  webview.style.width = '100%'
  webview.style.height = '100%'
  webview.style.border = 'none'
  webview.style.background = '#ffffff'
  webview.addEventListener('did-start-loading', onLoadStarted)
  webview.addEventListener('did-stop-loading', onLoadStopped)
  webview.addEventListener('did-fail-load', onLoadFailed)
  container.appendChild(webview)
  webview.setAttribute('src', shareUrl)

  return () => {
    webview.removeEventListener('did-start-loading', onLoadStarted)
    webview.removeEventListener('did-stop-loading', onLoadStopped)
    webview.removeEventListener('did-fail-load', onLoadFailed)
    moveFocusToRendererBeforeWebviewDetach(webview)
    webview.remove()
  }
}

export function ArtifactPreview({ shareUrl }: { shareUrl: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PreviewState>('loading')

  useEffect(() => {
    let disposed = false
    let detachPreview: (() => void) | undefined
    let loadFailed = false
    const onLoadStarted = (): void => {
      loadFailed = false
      setState('loading')
    }
    const onLoadStopped = (): void => {
      if (!loadFailed) {
        setState('ready')
      }
    }
    const onLoadFailed = (): void => {
      loadFailed = true
      setState('unavailable')
    }

    setState('loading')
    void window.api.browser
      .sessionResolvePartition({ profileId: null })
      .then((partition) => {
        if (disposed || !partition || !containerRef.current) {
          if (!disposed) {
            setState('unavailable')
          }
          return
        }

        detachPreview = attachArtifactWebview({
          container: containerRef.current,
          partition,
          shareUrl,
          onLoadStarted,
          onLoadStopped,
          onLoadFailed
        })
      })
      .catch(() => {
        if (!disposed) {
          setState('unavailable')
        }
      })

    return () => {
      disposed = true
      detachPreview?.()
    }
  }, [shareUrl])

  return (
    <div className="relative min-h-64 flex-1 overflow-hidden bg-white" ref={containerRef}>
      {state === 'loading' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {state === 'unavailable' ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background px-6 text-center">
          <AlertCircle className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">
            {translate('auto.components.artifacts.previewUnavailable', 'Preview unavailable')}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {translate(
              'auto.components.artifacts.previewUnavailableDescription',
              'Open this artifact in your browser to view it.'
            )}
          </p>
        </div>
      ) : null}
    </div>
  )
}
