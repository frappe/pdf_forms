import { Button } from "@components/ui/button"
import { Dialog, DialogHeader, DialogContent, DialogTitle, DialogFooter, DialogDescription } from "@components/ui/dialog"
import ErrorBanner from "@components/ui/error-banner"
import type { FormTemplatePrompts } from "@types/FormPrinter/FormTemplatePrompts"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import _ from "@lib/translate"

export const DeletePromptDialog = ({ isOpen, onClose, prompt, onRefresh, templateID }: { isOpen: boolean, onClose: () => void, prompt: FormTemplatePrompts, onRefresh: () => void, templateID: string }) => {
    const { call, loading, error } = useFrappePostCall('pdf_forms.api.form_template.remove_prompt_from_form_template')
    const onSubmit = () => {
        call({
            form_template_id: templateID,
            prompt: prompt,
        })
            .then(() => {
                toast.success(_("Prompt deleted successfully"))
                onRefresh()
                onClose()
            })
            .catch((error) => {
                toast.error(_("Failed to delete prompt"))
                console.error(error)
            })
    }
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{_("Delete Prompt")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    {error && <ErrorBanner error={error} />}
                    <DialogDescription>
                        <p>{_("Are you sure you want to delete the prompt {0}?", [_("{0}", [prompt.label])])}</p>
                    </DialogDescription>
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onClose} title={_("Cancel")}>
                        {_("Cancel")}
                    </Button>
                    <Button variant="solid" theme="red" disabled={loading} onClick={onSubmit} title={_("Delete")}>
                        {loading ? _("Deleting...") : _("Delete")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}