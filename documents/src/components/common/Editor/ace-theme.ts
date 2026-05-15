import type { IAceEditorProps } from 'react-ace'

/** Ace theme ids — pair matches GitHub-style light/dark in ace-builds */
export const ACE_THEME_LIGHT = 'github' satisfies IAceEditorProps['theme']
export const ACE_THEME_DARK = 'github_dark' satisfies IAceEditorProps['theme']

export function aceEditorTheme(resolved: 'Light' | 'Dark'): NonNullable<IAceEditorProps['theme']> {
	return resolved === 'Dark' ? ACE_THEME_DARK : ACE_THEME_LIGHT
}
