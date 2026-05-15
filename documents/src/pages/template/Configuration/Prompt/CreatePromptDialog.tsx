import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { FormTemplatePrompts } from "@/types/FormPrinter/FormTemplatePrompts"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { PromptForm } from "./PromptForm"
import { FormProvider, useForm } from "react-hook-form"
import ErrorBanner from "@/components/ui/error-banner"
import { Button } from "@/components/ui/button"
import _ from "@/lib/translate"

export const CreatePromptDialog = ({ isOpen, onClose, templateID, onRefresh }: { isOpen: boolean, onClose: () => void, templateID: string, onRefresh: () => void }) => {

    const methods = useForm<FormTemplatePrompts>({
        defaultValues: {
            field_name: "",
            label: "",
            description: "",
        },
    })

    const { call, loading, error } = useFrappePostCall('pdf_forms.api.form_template.add_prompt_to_form_template')


    const onSubmit = (data: FormTemplatePrompts) => {
        call({
            form_template_id: templateID,
            prompt: data,
        }).then(() => {
            toast.success(_("Prompt created successfully"))
            onRefresh()
            onClose()
        }).catch(() => {
            toast.error(_("Failed to create prompt"))
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{_("Create Prompt")}</DialogTitle>
                </DialogHeader>
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)}>
                        <div className="flex flex-col gap-4">
                            {error && <ErrorBanner error={error} />}
                            <PromptForm isEdit={false} />
                            <DialogFooter>
                                <Button type="button" variant="outline" theme="gray" onClick={onClose} title={_("Cancel")}>
                                    {_("Cancel")}
                                </Button>
                                <Button type="submit" variant="solid" theme="gray" disabled={loading} title={_("Create")}>
                                    {loading ? _("Creating...") : _("Create")}
                                </Button>
                            </DialogFooter>
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    )
}