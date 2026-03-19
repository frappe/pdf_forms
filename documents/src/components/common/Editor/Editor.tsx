import AceEditor, { type IAceEditorProps } from "react-ace"
import "ace-builds/src-noconflict/mode-json"
import "ace-builds/src-noconflict/theme-kuroir"
import "ace-builds/src-noconflict/ext-language_tools"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { web_url } from "../../../config/socket"
import { Button } from "@/components/ui/button"
import { Copy, Printer } from "lucide-react"

export interface EditorProps extends IAceEditorProps {
    jsonValue: Record<string, unknown>
    templateID: string
    readOnly?: boolean
}

export const Editor = ({ jsonValue, templateID, readOnly, ...props }: EditorProps) => {
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

    const printUrl = `${web_url}/api/method/form_printer.api.print.print_form_template?template_id=${templateID}&data=${encodeURIComponent(value)}&print_name=Print ${encodeURIComponent(templateID)}`

    return (
        <div className="flex flex-col gap-4">
            <div className="relative h-[86vh]">
                <AceEditor
                    placeholder="Enter your sample data here... (JSON format)"
                    width="100%"
                    height="86vh"
                    mode="json"
                    theme="kuroir"
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
                />
                {!readOnly && (
                    <div className="absolute right-0 top-0 flex gap-2 p-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={onCopy}
                            aria-label="Copy"
                            className="gap-1.5"
                        >
                            <Copy className="size-4" />
                            Copy
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="gap-1.5"
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
