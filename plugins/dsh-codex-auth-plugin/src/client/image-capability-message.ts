import type { CodexAuthLocaleKey } from './locales.ts'

export function formatImageGenerationHelp(
  t: (key: CodexAuthLocaleKey) => string,
  dshVersion: string | undefined,
): string {
  return t('imageGenerationUnavailableHelp').replace('{version}', dshVersion ?? 'unknown')
}
