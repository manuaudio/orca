import { ExternalLink, Loader2, Trash2 } from 'lucide-react'
import type { ArtifactListItem } from '../../../../shared/artifacts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

type ArtifactListRowActionsProps = {
  deleting: boolean
  item: ArtifactListItem
  onDelete: (item: ArtifactListItem) => void
}

export function ArtifactListRowActions({
  deleting,
  item,
  onDelete
}: ArtifactListRowActionsProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="border border-border/50 bg-transparent hover:bg-muted/50"
            onClick={() => void window.api.shell.openUrl(item.shareUrl)}
            aria-label={translate(
              'auto.components.artifacts.ArtifactsPage.openArtifact',
              'Open artifact'
            )}
          >
            <ExternalLink />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {translate('auto.components.artifacts.ArtifactsPage.openArtifact', 'Open artifact')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="border border-border/50 bg-transparent text-destructive hover:bg-muted/50 hover:text-destructive"
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
    </div>
  )
}
