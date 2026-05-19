import { useFrappePostCall } from 'frappe-react-sdk'
import { useEffect } from 'react'
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'
import ErrorBanner from '@/components/ui/error-banner'
import _ from '@/lib/translate'

interface Props {
    annotationID: string | null,
    templateID: string,
    onClose: VoidFunction,
    /** Called only after the server confirms deletion (not on cancel). */
    onDeleted?: VoidFunction
}

export const AnnotationDeleteModal = ({ annotationID, templateID, onClose, onDeleted }: Props) => {

    const { call, error, loading, reset } = useFrappePostCall('pdf_forms.pdf_forms.doctype.form_template_field.form_template_field.delete_annotation')

    useEffect(() => {
        reset()
    }, [annotationID, reset])


    const deleteAnnotation = () => {
        if (annotationID) {
            call({
                form_template_id: templateID,
                annotation_id: annotationID,
            }).then(() => {
                onDeleted?.()
                onClose()
                toast.success(_("Annotation deleted"), {
                    duration: 1000,
                })
            }).catch((error) => {
                toast.error(_("Failed to delete annotation"), {
                    duration: 1000,
                })
                console.error(error)
            })
        }
    }
    return (
        <AlertDialog open={annotationID !== null} onOpenChange={(open) => {
            if (!open) {
                onClose()
            }
        }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{_("Delete Annotation")}</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="space-y-4">
                    {error && (
                        <ErrorBanner 
                            error={error} 
                        />
                    )}
                    <AlertDialogDescription>
                        {_("Are you sure? This will delete the annotation.")}<br />
                        {_("You can't undo this action.")}
                    </AlertDialogDescription>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading} variant={"ghost"} title={_("Cancel")}>
                        {_("Cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={deleteAnnotation}
                        disabled={loading}
                        title={_("Delete")}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                {_("Deleting...")}
                            </>
                        ) : (
                                _('Delete')
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}