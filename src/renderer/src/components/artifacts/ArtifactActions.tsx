import { ChevronDown, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ArtifactListItem } from '../../../../shared/artifacts'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
    <DropdownMenu modal={false}>
      <ButtonGroup
        className="shrink-0 shadow-xs"
        aria-label={translate('auto.components.artifacts.actions', 'Artifact actions')}
      >
        <Button size="sm" onClick={() => void copyLink()}>
          <Copy />
          {translate('auto.components.artifacts.copyLink', 'Copy link')}
        </Button>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            aria-label={translate('auto.components.artifacts.moreActions', 'More artifact actions')}
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
      </ButtonGroup>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void window.api.shell.openUrl(item.shareUrl)}>
          <ExternalLink />
          {translate('auto.components.artifacts.openInBrowser', 'Open in browser')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={deleting} onSelect={() => onDelete(item)}>
          {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {translate('auto.components.artifacts.ArtifactsPage.deleteArtifact', 'Delete artifact')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
