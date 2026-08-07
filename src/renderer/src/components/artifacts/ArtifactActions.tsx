import { Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ArtifactListItem } from '../../../../shared/artifacts'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

type ArtifactActionsProps = {
  deleting: boolean
  item: ArtifactListItem
  onDelete: (item: ArtifactListItem) => void
}

export function ArtifactActions({
  deleting,
  item,
  onDelete
}: ArtifactActionsProps): React.JSX.Element {
  const copyLink = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(item.shareUrl)
      toast.success(translate('auto.components.artifacts.copySuccess', 'Artifact link copied'))
    } catch {
      toast.error(translate('auto.components.artifacts.copyFailed', 'Could not copy artifact link'))
    }
  }

  return (
    <ButtonGroup
      className="shrink-0 shadow-xs"
      aria-label={translate('auto.components.artifacts.actions', 'Artifact actions')}
    >
      <Button size="sm" onClick={() => void copyLink()}>
        <Copy />
        {translate('auto.components.artifacts.copyLink', 'Copy link')}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => void window.api.shell.openUrl(item.shareUrl)}
            aria-label={translate('auto.components.artifacts.openInBrowser', 'Open in browser')}
          >
            <ExternalLink />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {translate('auto.components.artifacts.openInBrowser', 'Open in browser')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={deleting}
            onClick={() => onDelete(item)}
            aria-label={translate(
              'auto.components.artifacts.ArtifactsPage.deleteArtifact',
              'Delete artifact'
            )}
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {translate('auto.components.artifacts.ArtifactsPage.deleteArtifact', 'Delete artifact')}
        </TooltipContent>
      </Tooltip>
    </ButtonGroup>
  )
}
