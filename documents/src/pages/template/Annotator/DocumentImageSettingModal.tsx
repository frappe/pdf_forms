import { useFrappePostCall } from "frappe-react-sdk"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { FormTemplateImage } from "@/types/FormPrinter/FormTemplateImage"
import { FullPageLoader } from "@/components/common/FullPageLoader/FullPageLoader"
import ErrorBanner from "@/components/ui/error-banner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
} from "@/components/ui/form"
import { CodeEditorFormField, DataField } from "@/components/ui/form-elements"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

interface Props {
    isOpen: boolean
    onClose: () => void
    image: FormTemplateImage | null
    onUpdated?: () => void
}

export const DocumentImageSettingModal = ({ isOpen, onClose, image, onUpdated }: Props) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl sm:max-w-xl">
                {!image && <FullPageLoader />}
                {image && (
                    <SettingPageModalContent data={image} onClose={onClose} onUpdated={onUpdated} />
                )}
            </DialogContent>
        </Dialog>
    )
}

interface SettingFields {
    repeat_page?: boolean
    repeat_after?: number
    copies?: string
    base_index?: number
}

interface SettingPageModalContentProps {
    data: FormTemplateImage
    onClose: () => void
    onUpdated?: () => void
}

export const SettingPageModalContent = ({
    data,
    onClose,
    onUpdated,
}: SettingPageModalContentProps) => {
    const methods = useForm<SettingFields>({
        defaultValues: {
            repeat_page: !!data.repeat_page,
            repeat_after: data.repeat_after ?? data.page_index,
            copies: data.copies ?? "",
            base_index: data.base_index,
        },
    })

    const { call, error, loading } = useFrappePostCall(
        "pdf_forms.pdf_forms.doctype.form_template_image.form_template_image.update_image_settings"
    )

    const onSubmit = (value: SettingFields) => {
        if (!data.parent) {
            toast.error("Unable to update settings: missing form template id")
            return
        }

        call({
            form_template_id: data.parent,
            form_template_image: data.name,
            repeat_page: value.repeat_page ? 1 : 0,
            repeat_after: value.repeat_after,
            copies: value.copies,
            base_index: value.base_index,
        })
            .then(() => {
                toast.success("Settings Updated", { duration: 2000 })
                onUpdated?.()
                onClose()
            })
            .catch((submitError: { message?: string }) => {
                toast.error("Failed to update settings", {
                    description: submitError?.message,
                })
            })
    }

    const repeatPage = useWatch({ control: methods.control, name: "repeat_page" })

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    {error && <ErrorBanner error={error} />}
                    <div className="flex flex-col gap-4">
                        <FormField
                            control={methods.control}
                            name="repeat_page"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Repeat Page</FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />
                        <div className="flex flex-col gap-4">
                            <DataField
                                name="repeat_after"
                                label="Repeat After"
                                disabled={!repeatPage}
                                isRequired
                                rules={{ required: "Repeat After is required" }}
                                formDescription="Repeat after this page, page index starts from 0."
                                inputProps={{ type: "number", min: 0 }}
                            />
                            <CodeEditorFormField
                                name="copies"
                                label="Copies"
                                disabled={!repeatPage}
                                isRequired
                                rules={{ required: "Copies is required" }}
                                formDescription="Use Number / Jinja template to generate copies."
                                editorProps={{
                                    placeholder: "eg: {{ frappe.utils.date_diff(end_date, start_date) }}",
                                }}
                            />
                            <DataField
                                name="base_index"
                                label="Base Index"
                                disabled={!repeatPage}
                                isRequired
                                rules={{ required: "Base Index is required" }}
                                formDescription="Base index for the copies, it is useful for child table index."
                                inputProps={{ type: "number", min: 0 }}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter showCloseButton={false} className="gap-2">
                    <Button type="button" variant="ghost" theme="gray" onClick={onClose} title="Close">
                    Close
                </Button>
                <Button
                    type="submit"
                    variant="solid"
                    theme="gray"
                    onClick={methods.handleSubmit(onSubmit)}
                    disabled={loading}
                        title="Save"
                >
                        {loading ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </form>
        </FormProvider>
    )
}
