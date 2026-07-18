import AceEditor, { type IAceEditorProps } from "react-ace"
import "ace-builds/src-noconflict/mode-json"
import "ace-builds/src-noconflict/theme-github"
import "ace-builds/src-noconflict/theme-github_dark"
import "ace-builds/src-noconflict/ext-language_tools"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { web_url } from "../../../config/socket"
import { Button } from "@components/ui/button"
import { cn } from "@lib/utils"
import { Copy, Printer } from "lucide-react"
import { useTheme } from "@components/ui/theme-provider"
import { aceEditorTheme } from "@components/common/Editor/ace-theme"

export interface EditorProps extends IAceEditorProps {
    jsonValue: Record<string, unknown>
    templateID: string
    readOnly?: boolean
    /** Classes for the outer flex shell. Control height with a parent wrapper (e.g. `h-[60vh]`) rather than inside this component. */
    shellClassName?: string
}

export const Editor = ({ jsonValue, templateID, readOnly, shellClassName, ...props }: EditorProps) => {
    const { themeValue } = useTheme()
    const aceTheme = aceEditorTheme(themeValue)

    const [value, setValue] = useState<string>(() =>
        JSON.stringify(jsonValue, null, 2)
    )

    const onChange = (newValue: string) => {
        if (!readOnly) setValue(newValue)
    }

    // Merge new keys from jsonValue prop into editor value when prop changes (deferred to avoid sync setState in effect)
    useEffect(() => {
        const id = setTimeout(() => {
            setValue((prevValue) => {
                try {
                    const prevJSON = JSON.parse(prevValue)
                    const prevKeys = Object.keys(prevJSON)
                    const newKeys = Object.keys(jsonValue)
                    const diffKeys = newKeys.filter((key) => !prevKeys.includes(key))
                    const newJSON = { ...prevJSON }
                    diffKeys.forEach((key) => {
                        newJSON[key] = jsonValue[key]
                    })
                    return JSON.stringify(newJSON, null, 2)
                } catch {
                    return prevValue
                }
            })
        }, 0)
        return () => clearTimeout(id)
    }, [jsonValue])

    const onCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            toast.success("Copied to clipboard", { duration: 2000 })
        })
    }

    const printUrl = `${web_url}/api/method/pdf_forms.api.print.print_form_template?template_id=${templateID}&data=${encodeURIComponent(value)}&print_name=Print ${encodeURIComponent(templateID)}`

    return (
        <div
            className={cn(
                "flex h-full min-h-0 w-full flex-col gap-4",
                shellClassName
            )}
        >
            <div className="relative min-h-0 w-full flex-1">
                <AceEditor
                    placeholder="Enter your sample data here... (JSON format)"
                    width="100%"
                    height="100%"
                    mode="json"
                    name="MY_EDITOR"
                    value={value}
                    onChange={onChange}
                    readOnly={readOnly}
                    fontSize={14}
                    showPrintMargin
                    showGutter
                    highlightActiveLine
                    editorProps={{ $blockScrolling: true }}
                    setOptions={{
                        enableBasicAutocompletion: !readOnly,
                        enableLiveAutocompletion: !readOnly,
                        enableSnippets: !readOnly,
                        showLineNumbers: true,
                        tabSize: 2,
                        useWorker: false,
                    }}
                    {...props}
                    theme={aceTheme}
                />
                {!readOnly && (
                    <div className="absolute right-0 top-0 flex gap-2 p-1.5">
                        <Button
                            variant="outline"
                            theme="gray"
                            size="sm"
                            type="button"
                            onClick={onCopy}
                            aria-label="Copy"
                            className="gap-1.5"
                            title="Copy to clipboard"
                        >
                            <Copy className="size-4" />
                            Copy
                        </Button>
                        <Button
                            variant="outline"
                            theme="gray"
                            size="sm"
                            asChild
                            className="gap-1.5"
                            title="Print"
                        >
                            <a
                                href={printUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Print"
                            >
                                <Printer className="size-4" />
                                Print
                            </a>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
