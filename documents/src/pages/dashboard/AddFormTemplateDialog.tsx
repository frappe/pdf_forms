import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useContext, useEffect, useState } from 'react'
import type { FrappeConfig } from 'frappe-react-sdk'
import { FrappeContext, useFrappeCreateDoc, useFrappeUpdateDoc } from 'frappe-react-sdk'
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
import { FormField, FormItem, FormControl, FormLabel, FormMessage } from '@/components/ui/form'
import ErrorBanner from '@/components/ui/error-banner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
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

    const { handleSubmit, control, reset, setValue } = methods
    const { createDoc, error: createDocError, loading: creatingDoc, reset: resetCreate } =
        useFrappeCreateDoc()
    const { updateDoc, error: updateDocError, loading: updatingDoc, reset: resetUpdate } =
        useFrappeUpdateDoc()

    const { file: frappeFile } = useContext(FrappeContext) as FrappeConfig

    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadError, setUploadError] = useState<string | null>(null)

    const files = useWatch({ control, name: 'files', defaultValue: EMPTY_FILES }) ?? EMPTY_FILES

    useEffect(() => {
        if (files.length) {
            setValue('template_name', files[0].name.split('.pdf')[0])
        }
    }, [files, setValue])

    const resetUploadState = () => {
        setUploadError(null)
        setUploadProgress(0)
        setIsUploading(false)
    }

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
                setIsUploading(true)
                setUploadProgress(0)
                return frappeFile.uploadFile(
                    files[0],
                    {
                        isPrivate: true,
                        doctype: 'Form Template',
                        docname: d.name,
                        fieldname: 'file',
                    },
                    (_bytesUploaded, _totalBytes, progress) => {
                        setUploadProgress(progress?.progress ?? 0)
                    }
                )
            })
            .then((r) => {
                const fileUrl = r.data?.message?.file_url ?? ''
                return updateDoc('Form Template', docname, { file: fileUrl })
            })
            .then(() => {
                setIsUploading(false)
                setUploadProgress(0)
                toast.success('Form template created successfully')
                handleClose(true)
            })
            .catch((err: unknown) => {
                setIsUploading(false)
                setUploadProgress(0)
                const message = err instanceof Error ? err.message : 'Upload failed'
                setUploadError(message)
            })
    }

    const handleClose = (refresh = false) => {
        reset()
        resetCreate()
        resetUpdate()
        resetUploadState()
        onClose(refresh)
    }

    const isLoading = creatingDoc || isUploading || updatingDoc

    if (isUploading) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Uploading PDF…</DialogTitle>
                    </DialogHeader>
                    <FileUploadBanner uploadProgress={uploadProgress} />
                </DialogContent>
            </Dialog>
        )
    }

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
                            <FormField
                                control={control}
                                name="files"
                                rules={{ required: 'Please add a PDF file' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            PDF File <span className="text-destructive">*</span>
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
                                                maxFiles={1}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {createDocError?.httpStatus === 409 && (
                                <ErrorBanner
                                    error={createDocError}
                                    title="A form template with this name already exists."
                                />
                            )}
                            {uploadError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error uploading file</AlertTitle>
                                    <AlertDescription>{uploadError}</AlertDescription>
                                </Alert>
                            )}
                            {updateDocError && (
                                <ErrorBanner
                                    error={updateDocError}
                                    title="Error updating form template with file"
                                />
                            )}

                            <FormTemplateFormFields />
                        </div>

                        <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleClose()}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
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
                inputProps={{ placeholder: 'Template Name' }}
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
                isRequired
                readOnly={isEdit}
                rules={{ required: 'Source is required' }}
            />

            <SmallTextField
                name="template_description"
                label="Description"
                inputProps={{ placeholder: 'Template description' }}
            />
        </div>
    )
}
