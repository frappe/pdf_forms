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

interface Props {
    annotationID: string | null,
    templateID: string,
    onClose: VoidFunction
}

export const AnnotationDeleteModal = ({ annotationID, templateID, onClose }: Props) => {

    const { call, error, loading, reset } = useFrappePostCall('form_printer.form_printer.doctype.form_template_field.form_template_field.delete_annotation')

    useEffect(() => {
        reset()
    }, [annotationID, reset])


    const deleteAnnotation = () => {
        if (annotationID) {
            call({
                form_template_id: templateID,
                annotation_id: annotationID,
            }).then(() => onClose())
                .then(() => toast.success('Annotation deleted', {
                    duration: 1000,
                })).catch((error) => {
                    toast.error('Error Deleting Annotation', {
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
                    <AlertDialogTitle>Delete Annotation</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="space-y-4">
                    {error && (
                        <ErrorBanner 
                            error={error} 
                        />
                    )}
                    <AlertDialogDescription>
                        Are you sure? This will delete the annotation.<br />
                        You can't undo this action afterwards.
                    </AlertDialogDescription>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={deleteAnnotation}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Delete'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}