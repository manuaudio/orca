// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  openArtifactsPage: vi.fn()
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      connectCurrentOrcaProfile: mocks.connect,
      openArtifactsPage: mocks.openArtifactsPage,
      orcaProfileAuthStatus: { configured: true, state: 'connected' },
      orcaProfileConnecting: false
    })
}))

import { ArtifactsSettingsPane } from './ArtifactsSettingsPane'

describe('ArtifactsSettingsPane', () => {
  beforeEach(() => {
    mocks.connect.mockReset()
    mocks.openArtifactsPage.mockReset()
  })

  afterEach(cleanup)

  it('explains the complete sharing workflow', () => {
    render(
      <ArtifactsSettingsPane
        settings={{ ...getDefaultSettings('/tmp'), artifactsEnabled: true }}
        updateSettings={vi.fn()}
      />
    )

    expect(screen.getByText('How to use Artifacts')).toBeInTheDocument()
    expect(screen.getByText('Ask your agent to share it')).toBeInTheDocument()
    expect(
      screen.getByText('For example: “Share this HTML mock as an artifact.”')
    ).toBeInTheDocument()
    expect(screen.getByText('Share the public link')).toBeInTheDocument()
    expect(
      screen.getByText('Your agent returns a link that anyone with the URL can view.')
    ).toBeInTheDocument()
    expect(screen.getByText('Manage it in Orca')).toBeInTheDocument()
    expect(
      screen.getByText('View and delete links shared through your account.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Uploads require sign-in; public links do not.')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Orca account')).not.toBeInTheDocument()
  })

  it('opens the Artifacts page without exposing CLI controls', async () => {
    const user = userEvent.setup()
    render(
      <ArtifactsSettingsPane
        settings={{ ...getDefaultSettings('/tmp'), artifactsEnabled: true }}
        updateSettings={vi.fn()}
      />
    )

    expect(screen.queryByText(/orca artifacts share/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy command' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Open Artifacts/ }))
    expect(mocks.openArtifactsPage).toHaveBeenCalledOnce()
  })
})
