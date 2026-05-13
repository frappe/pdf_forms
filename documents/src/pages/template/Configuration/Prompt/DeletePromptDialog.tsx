import { Button } from "@/components/ui/button"
import { Dialog, DialogHeader, DialogContent, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import ErrorBanner from "@/components/ui/error-banner"
import type { FormTemplatePrompts } from "@/types/FormPrinter/FormTemplatePrompts"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"

export const DeletePromptDialog = ({ isOpen, onClose, prompt, onRefresh, templateID }: { isOpen: boolean, onClose: () => void, prompt: FormTemplatePrompts, onRefresh: () => void, templateID: string }) => {
    const { call, loading, error } = useFrappePostCall('pdf_forms.api.form_template.remove_prompt_from_form_template')
    const onSubmit = () => {
        call({
            form_template_id: templateID,
            prompt: prompt,
        })
            .then(() => {
                toast.success("Prompt deleted successfully")
                onRefresh()
                onClose()
            })
            .catch((error) => {
                toast.error("Failed to delete prompt")
                console.error(error)
            })
    }
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Prompt</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    {error && <ErrorBanner error={error} />}
                    <DialogDescription>
                        <p>Are you sure you want to delete the prompt <span className="font-bold">{prompt.label}</span>?</p>
                    </DialogDescription>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" theme="gray" onClick={onClose} title="Cancel">
                        Cancel
                    </Button>
                    <Button variant="solid" theme="red" disabled={loading} onClick={onSubmit} title="Delete">
                        {loading ? "Deleting..." : "Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}