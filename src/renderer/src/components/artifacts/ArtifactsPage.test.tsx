// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  closePage: vi.fn(),
  connect: vi.fn(),
  confirm: vi.fn(),
  refreshAuth: vi.fn(),
  rpc: vi.fn()
}))

vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => mocks.confirm
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: mocks.rpc
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      closeArtifactsPage: mocks.closePage,
      connectCurrentOrcaProfile: mocks.connect,
      orcaProfileAuthStatus: { configured: true, state: 'connected' },
      orcaProfileConnecting: false,
      refreshCurrentOrcaProfileAuth: mocks.refreshAuth
    })
}))

import ArtifactsPage from './ArtifactsPage'

describe('ArtifactsPage', () => {
  beforeEach(() => {
    mocks.closePage.mockReset()
    mocks.connect.mockReset()
    mocks.confirm.mockReset()
    mocks.refreshAuth.mockReset()
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({
      status: 'ok',
      value: [
        {
          artifact: {
            byteSize: 1024,
            createdAt: '2026-08-01T12:00:00.000Z',
            deletedAt: null,
            expiresAt: '2026-09-01T12:00:00.000Z',
            originalFileName: 'report.html',
            renderedContentType: 'text/html',
            slug: 'report-123',
            sourceContentType: 'text/html',
            title: 'Quarterly report',
            updatedAt: '2026-08-02T12:00:00.000Z',
            version: 1
          },
          shareUrl: 'https://share.onorca.dev/a/report-123'
        }
      ]
    })
  })

  afterEach(cleanup)

  it('uses the shared top-level page chrome and compact artifact actions', async () => {
    render(<ArtifactsPage />)

    expect(await screen.findByText('Quarterly report')).toBeInTheDocument()
    const closeButton = screen.getByRole('button', { name: 'Close artifacts' })
    expect(closeButton).toHaveClass('size-7', 'rounded-full')
    expect(closeButton.closest('header')).toHaveClass('px-5', 'pb-3', 'pt-1.5', 'md:px-8')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveClass(
      'border',
      'border-border/50'
    )
    expect(screen.getByRole('button', { name: 'Open artifact' })).toHaveClass('size-8')
    expect(screen.getByRole('button', { name: 'Delete artifact' })).toHaveClass('text-destructive')
  })

  it('closes from the header button and Escape', async () => {
    render(<ArtifactsPage />)
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: 'Close artifacts' }))
    expect(mocks.closePage).toHaveBeenCalledOnce()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(mocks.closePage).toHaveBeenCalledTimes(2)
  })

  it('explains the agent-first sharing workflow', async () => {
    mocks.rpc.mockResolvedValue({ status: 'ok', value: [] })
    render(<ArtifactsPage />)

    const heading = await screen.findByText('No shared artifacts')
    expect(heading.parentElement).toHaveClass('flex-1', 'justify-center')
    expect(
      screen.getByText('Ask your agent to share an HTML or Markdown file, and it will appear here.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/orca artifacts share/)).not.toBeInTheDocument()
  })
})
