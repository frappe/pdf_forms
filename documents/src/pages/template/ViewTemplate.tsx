import { useParams } from 'react-router-dom'
import { Annotator } from './Annotator/Annotator'
import { DocumentForm } from './DocumentForm/DocumentForm'
import { useFrappeEventListener, useFrappeGetDoc } from 'frappe-react-sdk'
import ErrorBanner from '@/components/ui/error-banner'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const ViewTemplateLoader = () => {
    return (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
            <div className="w-full border-b p-4 space-y-4 lg:w-[44%] lg:border-b-0 lg:border-r">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-[45vh] w-full rounded-lg lg:h-[calc(100vh-7rem)]" />
            </div>
            <div className="w-full p-4 space-y-4 lg:w-[56%]">
                <div className="grid w-full grid-cols-3 gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="border rounded-md min-h-[45vh] p-4 space-y-3 lg:min-h-[calc(100vh-7rem)]">
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
    const [mobilePane, setMobilePane] = useState<'annotator' | 'editor'>('editor')

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
                    <div className="relative min-h-[calc(100vh-4rem)]">
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
                            <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
                                <div className="sticky top-0 z-70 border-b bg-background/95 p-2 backdrop-blur lg:hidden">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={mobilePane === 'annotator' ? 'default' : 'outline'}
                                            onClick={() => setMobilePane('annotator')}
                                        >
                                            PDF Annotator
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={mobilePane === 'editor' ? 'default' : 'outline'}
                                            onClick={() => setMobilePane('editor')}
                                        >
                                            Field Editor
                                        </Button>
                                    </div>
                                </div>
                                <div className={`${mobilePane === 'editor' ? 'hidden' : 'block'} border-b lg:block lg:w-[44%] lg:border-b-0 lg:border-r`}>
                                    <Annotator templateID={templateID} />
                                </div>
                                <div className={`${mobilePane === 'annotator' ? 'hidden' : 'block'} lg:block lg:w-[56%]`}>
                                    <DocumentForm templateID={templateID} />
                                </div>
                            </div>
                ) : null}
            </>
        )
    }

    return null
}
