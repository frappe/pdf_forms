import * as React from "react"
import { Controller, useFormContext } from "react-hook-form"
import AceEditor, { type IAceEditorProps } from "react-ace";
import "ace-builds/src-noconflict/mode-json"
import "ace-builds/src-noconflict/theme-kuroir"
import "ace-builds/src-noconflict/ext-language_tools"

const defaultEditorProps = {
    placeholder: 'Enter your sample code here...',
    width: '100%',
    height: '100%',
    mode: 'python',
    theme: 'github',
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

    const editorShell = (node: React.ReactNode) => (
        <div className="min-h-52 rounded overflow-hidden border border-transparent bg-surface-gray-2 transition-colors hover:bg-surface-gray-3">
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
                    />,
                )}
        />
    )
}