import type { FormTemplatePrompts } from "@/types/FormPrinter/FormTemplatePrompts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormProvider, useForm } from "react-hook-form";
import { useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";
import { PromptForm } from "./PromptForm";
import { Button } from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";

export const EditPromptDialog = ({ isOpen, onClose, prompt, onRefresh, templateID }: { isOpen: boolean, onClose: () => void, prompt: FormTemplatePrompts, onRefresh: () => void, templateID: string }) => {
    const methods = useForm<FormTemplatePrompts>({
        defaultValues: prompt,
    })

    const { call, loading, error } = useFrappePostCall('form_printer.api.form_template.update_prompt_in_form_template')

    const onSubmit = (data: FormTemplatePrompts) => {
        call({
            form_template_id: templateID,
            prompt: data,
        }).then(() => {
            toast.success("Prompt updated successfully")
            onRefresh()
            onClose()
        }).catch((error) => {
            toast.error("Failed to update prompt")
            console.error(error)
        })
    }
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Prompt</DialogTitle>
                </DialogHeader>
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)}>
                        <div className="flex flex-col gap-4">
                            {error && <ErrorBanner error={error} />}
                            <PromptForm isEdit={true} />


                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Updating..." : "Update"}
                                </Button>

                            </DialogFooter>
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    )
}