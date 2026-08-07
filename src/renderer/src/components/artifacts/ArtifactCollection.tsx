import { Files } from 'lucide-react'
import type { ArtifactListItem } from '../../../../shared/artifacts'
import { cn } from '@/lib/utils'
import { ArtifactActions } from './ArtifactActions'
import { ArtifactPreview } from './ArtifactPreview'

function formatArtifactDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  )
}

function formatByteSize(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function artifactName(item: ArtifactListItem): string {
  return item.artifact.title || item.artifact.originalFileName || item.artifact.slug
}

export function ArtifactCollection({
  artifacts,
  deletingId,
  selectedArtifact,
  selectArtifact,
  deleteArtifact
}: {
  artifacts: readonly ArtifactListItem[]
  deletingId: string | null
  selectedArtifact: ArtifactListItem
  selectArtifact: (slug: string) => void
  deleteArtifact: (item: ArtifactListItem) => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/50 bg-muted/20 md:flex-row">
      <div className="max-h-48 shrink-0 overflow-y-auto border-b border-border/50 scrollbar-sleek md:max-h-none md:w-72 md:border-r md:border-b-0">
        {artifacts.map((item) => {
          const selected = item.artifact.slug === selectedArtifact.artifact.slug
          return (
            <button
              type="button"
              key={item.artifact.slug}
              data-current={selected ? 'true' : undefined}
              onClick={() => selectArtifact(item.artifact.slug)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/50',
                selected && 'bg-accent'
              )}
            >
              <Files className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{artifactName(item)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatArtifactDate(item.artifact.updatedAt)} ·{' '}
                  {formatByteSize(item.artifact.byteSize)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{artifactName(selectedArtifact)}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {formatArtifactDate(selectedArtifact.artifact.updatedAt)} ·{' '}
              {formatByteSize(selectedArtifact.artifact.byteSize)}
            </p>
          </div>
          <ArtifactActions
            deleting={deletingId === selectedArtifact.artifact.slug}
            item={selectedArtifact}
            onDelete={deleteArtifact}
          />
        </div>
        <ArtifactPreview shareUrl={selectedArtifact.shareUrl} />
      </section>
    </div>
  )
}
