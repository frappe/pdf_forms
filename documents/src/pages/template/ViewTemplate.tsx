import { useParams } from 'react-router-dom'
import { Annotator } from './Annotator/Annotator'
import { DocumentForm } from './DocumentForm/DocumentForm'
import { useFrappeEventListener, useFrappeGetDoc } from 'frappe-react-sdk'
import ErrorBanner from '@/components/ui/error-banner'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const ViewTemplateLoader = () => {
    return (
        <div className="flex items-start gap-0 h-screen">
            <div className="w-[45%] border-r p-4 space-y-4 h-full">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-[90vh] w-full rounded-lg" />
            </div>
            <div className="w-[55%] p-4 space-y-4 h-full">
                <div className="grid w-full grid-cols-3 gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="border rounded-md h-[90vh] p-4 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-[80%]" />
                </div>
            </div>
        </div>
    )
}

export const ViewTemplate = () => {

    const { templateID } = useParams<{ templateID: string }>()
    const { data, error, isLoading, mutate } = useFrappeGetDoc('Form Template', templateID, templateID ? undefined : null)

    useFrappeEventListener('form_template_process_completed', (eventData) => {
        if (data?.name === eventData.form_template_id) {
            mutate();
        }

    })

    if (error) {
        return <div className="flex items-center justify-center h-full">
            <ErrorBanner error={error} />
        </div>
    }


    if (isLoading) {
        return <ViewTemplateLoader />
    }


    if (templateID && data) {
        return (
            <>
                {data.process_completed === 0 && data.is_pdf_converted === 0 ? (
                    <div className="relative h-screen">
                        <div className="pointer-events-none">
                            <ViewTemplateLoader />
                        </div>
                        <div className="absolute inset-0 bg-background/45" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-lg font-medium text-muted-foreground">Documents are processing... Please wait.</p>
                        </div>
                    </div>
                ) : data.process_completed === 1 && data.is_pdf_converted === 0 ? (
                    <div className="flex items-center justify-center h-full p-4">
                        <Alert variant="destructive" className="max-w-2xl">
                            <AlertTitle>Issue with Form PDF</AlertTitle>
                            <AlertDescription>
                                Something went wrong while converting the PDF. Please check the uploaded file or inspect the background job to find the actual issue.
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : data.process_completed === 1 && data.is_pdf_converted === 1 ? (
                            <div className="flex items-start gap-0">
                                <div className="w-[45%] border-r">
                                    <Annotator templateID={templateID} />
                                </div>
                                <div className="w-[55%]">
                                    <DocumentForm templateID={templateID} />
                                </div>
                            </div>
                ) : null}
            </>
        )
    }

    return null
}
