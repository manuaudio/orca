import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getArtifactsSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.artifacts.enable', 'Enable Artifacts'),
    description: translate(
      'auto.components.settings.artifacts.enableDescription',
      'Share HTML and Markdown files and manage their public links from Orca.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.artifacts.keywordArtifacts', 'artifacts'),
      ...translateSearchKeyword('auto.components.settings.artifacts.keywordShare', 'share'),
      ...translateSearchKeyword('auto.components.settings.artifacts.keywordHtml', 'HTML'),
      ...translateSearchKeyword('auto.components.settings.artifacts.keywordMarkdown', 'Markdown'),
      ...translateSearchKeyword('auto.components.settings.artifacts.keywordUpload', 'upload')
    ]
  }
])
