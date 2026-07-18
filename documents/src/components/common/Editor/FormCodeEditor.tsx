import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import AceEditor, { type IAceEditorProps } from 'react-ace'
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-github'
import 'ace-builds/src-noconflict/theme-github_dark'
import 'ace-builds/src-noconflict/ext-language_tools'
import { useTheme } from '@components/ui/theme-provider'
import { aceEditorTheme } from '@components/common/Editor/ace-theme'
import _ from '@lib/translate'

const defaultEditorProps = {
	placeholder: _('Enter your sample code here…'),
	width: '100%',
	height: '100%',
	mode: 'python',
	fontSize: 14,
	showPrintMargin: true,
	showGutter: true,
	highlightActiveLine: true,
	enableBasicAutocompletion: true,
	enableLiveAutocompletion: true,
	enableSnippets: true,
	editorProps: { $blockScrolling: true },
	setOptions: {
		enableBasicAutocompletion: true,
		enableLiveAutocompletion: true,
		enableSnippets: true,
		showLineNumbers: true,
		tabSize: 2,
		useWorker: false,
	},
} as const

export interface AceEditorFieldProps extends IAceEditorProps {
	name: string
	/** When provided with onChange/onBlur, renders in controlled mode (e.g. inside FormField). */
	value?: string
	onChange?: (value: string) => void
	onBlur?: () => void
}

export const FormCodeEditor = ({ name, value, onChange, onBlur, ...props }: AceEditorFieldProps) => {
	const { control } = useFormContext()
	const { themeValue } = useTheme()
	const aceTheme = aceEditorTheme(themeValue)

	const editorShell = (node: React.ReactNode) => (
		<div className="min-h-52 overflow-hidden rounded border border-transparent bg-surface-gray-2 transition-colors hover:bg-surface-gray-3">
			{node}
		</div>
	)

	const editor = editorShell(
		<AceEditor
			{...defaultEditorProps}
			name={name}
			value={value}
			onChange={onChange}
			onBlur={onBlur}
			{...props}
			theme={aceTheme}
		/>,
	)

	if (value !== undefined && onChange) {
		return editor
	}

	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) =>
				editorShell(
					<AceEditor
						{...defaultEditorProps}
						{...field}
						{...props}
						theme={aceTheme}
					/>,
				)}
		/>
	)
}
