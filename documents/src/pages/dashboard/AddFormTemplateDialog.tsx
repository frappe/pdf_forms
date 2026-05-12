import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useFrappeCreateDoc, useFrappeFileUpload, useFrappeUpdateDoc } from 'frappe-react-sdk'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { DataField, LinkFormField, SmallTextField } from '@/components/ui/form-elements'
import { FormField, FormItem, FormControl, FormLabel, FormMessage, FormRequiredIndicator } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import ErrorBanner from '@/components/ui/error-banner'
import FileUploadBanner from '@/components/common/FileUploadBanner'

const EMPTY_FILES: File[] = []

interface AddFormTemplateDialogProps {
    isOpen: boolean
    onClose: (refresh?: boolean) => void
}

interface FormTemplateFormProps {
    template_name: string
    template_description: string
    data_source: 'DocType' | 'Custom Data Source' | ''
    source: string
    files: File[]
}

export const AddFormTemplateDialog = ({ isOpen, onClose }: AddFormTemplateDialogProps) => {
    const methods = useForm<FormTemplateFormProps>({
        defaultValues: {
            template_name: '',
            template_description: '',
            data_source: '',
            source: 'DocType',
            files: [],
        },
    })

    const { handleSubmit, control, reset } = methods
    const { createDoc, error: createDocError, loading: creatingDoc, reset: resetCreate } =
        useFrappeCreateDoc()
    const { updateDoc, error: updateDocError, loading: updatingDoc, reset: resetUpdate } =
        useFrappeUpdateDoc()

    const { upload, error: uploadError, loading: uploading, progress: uploadProgress, reset: resetUpload } = useFrappeFileUpload()
    const files = useWatch({ control, name: 'files', defaultValue: EMPTY_FILES }) ?? EMPTY_FILES

    const onSubmit = (data: FormTemplateFormProps) => {
        if (files.length === 0) return

        let docname = ''
        createDoc('Form Template', {
            template_name: data.template_name,
            description: data.template_description || '',
            data_source: data.data_source || 'DocType',
            source: data.source,
        })
            .then((d) => {
                docname = d.name
                return upload(
                    files[0],
                    {
                        isPrivate: true,
                        doctype: 'Form Template',
                        docname: d.name,
                        fieldname: 'file',
                    },
                )
            })
            .then((r) => {
                const fileUrl = r.file_url
                return updateDoc('Form Template', docname, { file: fileUrl })
            })
            .then(() => {
                toast.success('Form template created successfully')
                handleClose(true)
            })
            .catch(() => {
                toast.error('Failed to create form template')
            })
    }

    const handleClose = (refresh = false) => {
        reset()
        resetCreate()
        resetUpdate()
        resetUpload()
        onClose(refresh)
    }

    const isLoading = creatingDoc || uploading || updatingDoc

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-xl">
                <FormProvider {...methods}>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Add Form Template</DialogTitle>
                            <DialogDescription>
                                Upload a PDF to create a new form template. You can annotate and
                                configure fields after creation.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-4 py-6">
                            {uploading && uploadProgress ? <FileUploadBanner uploadProgress={uploadProgress} />
                                : <FormField
                                control={control}
                                name="files"
                                rules={{ required: 'Please add a PDF file' }}
                                    render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>
                                            PDF File <FormRequiredIndicator className="ms-0.5" />
                                        </FormLabel>
                                        <FormControl>
                                            <FileDropzone
                                                files={field.value ?? []}
                                                setFiles={(v) =>
                                                    field.onChange(
                                                        typeof v === 'function'
                                                            ? v(field.value ?? [])
                                                            : v
                                                    )
                                                }
                                                accept={{ 'application/pdf': ['.pdf'] }}
                                                    multiple={false}
                                                className={cn(
                                                    fieldState.error &&
                                                        'border-outline-red-3 shadow-focus-red'
                                                )}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />}
                            <ErrorBanner error={createDocError || updateDocError || uploadError} />

                            <FormTemplateFormFields />
                        </div>

                        <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                theme="gray"
                                onClick={() => handleClose()}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                theme="gray"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Creating…' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    )
}

const FormTemplateFormFields = ({ isEdit = false }: { isEdit?: boolean }) => {
    return (
        <div className="flex flex-col gap-4">
            <DataField
                name="template_name"
                label="Template Name"
                isRequired
                readOnly={isEdit}
                rules={{ required: 'Template name is required', maxLength: { value: 100, message: 'Maximum 100 characters' } }}
                inputProps={{ placeholder: 'eg: User Appointment Letter' }}
            />

            {/* <SelectFormField
                name="data_source"
                label="Data Source"
                isRequired
                readOnly={isEdit}
                rules={{ required: 'Data source is required' }}
            >
                <SelectItem value="DocType">DocType</SelectItem>
                <SelectItem value="Custom Data Source">Custom Data Source</SelectItem>
            </SelectFormField> */}

            <LinkFormField
                name="source"
                label="Source"
                doctype="DocType"
                placeholder='Select a source'
                isRequired
                readOnly={isEdit}
                useInForm={true}
                rules={{ required: 'Source is required' }}
            />

            <SmallTextField
                name="template_description"
                label="Description"
            />
        </div>
    )
}
