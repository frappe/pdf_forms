import { useState } from 'react'
import type { FormTemplatePrompts } from '@/types/FormPrinter/FormTemplatePrompts'
import { MessageSquareText, Pencil, Trash2, Copy, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CreatePromptDialog } from './Prompt/CreatePromptDialog'
import { EditPromptDialog } from './Prompt/EditPromptDialog'
import { DeletePromptDialog } from './Prompt/DeletePromptDialog'

export const Prompts = ({ prompts, templateID, onRefresh }: {
    prompts: FormTemplatePrompts[]
    templateID: string
    onRefresh: () => void
}) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [selectedPrompt, setSelectedPrompt] = useState<FormTemplatePrompts | null>(null)
    const onCreateClose = () => {
        setIsCreateOpen(false)
    }
    const onEditClose = () => {
        setIsEditOpen(false)
        setSelectedPrompt(null)
    }
    const onEdit = (prompt: FormTemplatePrompts) => {
        setSelectedPrompt(prompt)
        setIsEditOpen(true)
    }
    const onDelete = (prompt: FormTemplatePrompts) => {
        setSelectedPrompt(prompt)
        setIsDeleteOpen(true)
    }
    const onDeleteClose = () => {
        setIsDeleteOpen(false)
        setSelectedPrompt(null)
    }

    if (prompts.length === 0) {
        return (
            <div className="flex flex-col h-full min-h-[200px]">
                {templateID && (
                    <div className="flex justify-end py-2 shrink-0">
                        <Button size="sm" variant="solid" theme="gray" onClick={() => setIsCreateOpen(true)} title="Add Prompt">
                            <Plus className="size-4" />
                            Add Prompt
                        </Button>
                    </div>
                )}
                <div className="flex flex-col items-center justify-center py-12 text-center flex-1 overflow-auto">
                    <MessageSquareText className="size-12 text-ink-gray-5 opacity-50 mb-4" />
                    <p className="text-sm text-ink-gray-5">
                        No prompts configured for this template.
                    </p>
                    <p className="text-xs text-ink-gray-5 mt-1">
                        Prompts allow you to collect additional input when filling the form.
                    </p>
                </div>
                {templateID && (
                    <CreatePromptDialog isOpen={isCreateOpen} onClose={onCreateClose} templateID={templateID} onRefresh={onRefresh} />
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {templateID && (
                <div className="flex justify-end py-2">
                    <Button size="sm" variant="solid" theme="gray" onClick={() => setIsCreateOpen(true)} title="Add Prompt">
                        <Plus className="size-4" />
                        Add Prompt
                    </Button>
                </div>
            )}
            <div className="overflow-y-auto flex flex-col gap-2 max-h-[85vh]">
                {prompts.map((prompt, index) => (
                    <div
                        key={prompt.name || index}
                        className="border border-outline-gray-2 rounded-lg px-3 py-2 bg-surface-cards hover:shadow-sm transition-shadow"
                    >
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-medium text-sm">{prompt.label}</h4>
                                <Badge variant="subtle" theme="gray" className="text-[10px] px-1.5 py-0 font-normal">
                                    {prompt.type || 'Text'}
                                </Badge>
                                {prompt.mandatory === 1 && (
                                    <Badge variant="solid" theme="red" className="text-[10px] px-1.5 py-0 font-normal">
                                        Required
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-0.5">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    theme="gray"
                                    size="sm"
                                    isIconButton
                                    onClick={() => onEdit(prompt)}
                                    aria-label="Edit prompt"
                                    title="Edit prompt"
                                >
                                    <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    theme="red"
                                    size="sm"
                                    isIconButton
                                    onClick={() => onDelete(prompt)}
                                    aria-label="Delete prompt"
                                    title="Delete prompt"
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Field name */}
                        <div className="flex items-center gap-1 text-xs text-ink-gray-5">
                            <code className="bg-surface-gray-2 px-1 py-0.5 rounded text-[11px]">{prompt.field_name}</code>
                            <Button
                                type="button"
                                variant="ghost"
                                theme="gray"
                                size="sm"
                                isIconButton
                                onClick={() => {
                                    void navigator.clipboard.writeText(prompt.field_name).then(() => {
                                        toast.success('Copied to clipboard')
                                    }).catch(() => {
                                        toast.error('Failed to copy')
                                    })
                                }}
                                aria-label="Copy field name"
                                title="Copy field name"
                            >
                                <Copy className="size-3" />
                            </Button>
                        </div>

                        {/* Question */}
                        {prompt.description && (
                            <div className="mt-2 pt-2 border-t border-outline-gray-2">
                                <p className="text-[11px] text-ink-gray-5 uppercase tracking-wide mb-0.5">
                                    Description
                                </p>
                                <p className="text-xs text-ink-gray-8 whitespace-pre-wrap leading-tight">
                                    {prompt.description}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {templateID && (
                <CreatePromptDialog isOpen={isCreateOpen} onClose={onCreateClose} templateID={templateID} onRefresh={onRefresh} />
            )}
            {templateID && selectedPrompt && (
                <EditPromptDialog isOpen={isEditOpen} onClose={onEditClose} prompt={selectedPrompt} templateID={templateID} onRefresh={onRefresh} />
            )}
            {templateID && selectedPrompt && (
                <DeletePromptDialog isOpen={isDeleteOpen} onClose={onDeleteClose} prompt={selectedPrompt} templateID={templateID} onRefresh={onRefresh} />
            )}
        </div>
    )
}