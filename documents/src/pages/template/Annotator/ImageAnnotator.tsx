import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OpenSeaDragon from "openseadragon";
import Annotorious from '@recogito/annotorious-openseadragon';
import '@recogito/annotorious-openseadragon/dist/annotorious.min.css';
import type { FormTemplateImage } from '@/types/FormPrinter/FormTemplateImage';
import type { Annotation } from '@/types/Annotation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Maximize, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, SplitSquareHorizontal } from 'lucide-react';


interface Props {
    images: FormTemplateImage[],
    onAnnotationClick?: (annotationID: string | null) => void,
    onAnnotationCreate?: (annotation: Annotation, pageIndex: number) => void,
    onAnnotationUpdate?: (annotation: Annotation, pageIndex: number) => void,
    onAnnotationDelete?: (annotationID: string) => void,
    annotationToFocus?: {
        annotation: string,
        pageIndex: number
    },
    onDualView?: VoidFunction,
    setFocusedAnnotation?: (annotationID: string | null) => void,
    viewMode?: string,
    annotations?: Record<number, Annotation[]>,
    customButtons?: React.ReactNode,
    customHeader?: React.ReactNode,
    allowEdit?: boolean,
    showToolbar?: boolean,
    annotatorImageStyles?: React.CSSProperties,
    id?: string
}

export const ImageAnnotator = ({ customHeader, id, images, onAnnotationClick, setFocusedAnnotation, annotationToFocus, onDualView, viewMode, onAnnotationCreate, onAnnotationUpdate, annotatorImageStyles, annotations, customButtons, allowEdit = true, showToolbar = true, onAnnotationDelete, ...props }: Props) => {

    const [currentPage, setCurrentPage] = useState(0);

    const mounted = useRef(false);

    const [annotator, setAnnotator] = useState<any>(null);

    const [viewer, setViewer] = useState<OpenSeaDragon.Viewer | null>(null);

    // Init Annotorious when the component
    // mounts, and keep the current 'anno'
    // instance in the application state
    useEffect(() => {
        const InitOpenseadragon = () => {
            if (annotator) {
                annotator.destroy();
            }
            const v = OpenSeaDragon({
                id: id ? id : "openSeaDragon",
                // prefixUrl: "openseadragon-images/",
                //@ts-expect-error - improper type definition in OSD
                tileSources: images.map((image) => ({
                    type: 'image',
                    url: image.image_file,
                })),
                sequenceMode: true,
                animationTime: 0.5,
                blendTime: 0.1,
                constrainDuringPan: true,
                // maxZoomPixelRatio: 2,
                minZoomLevel: 1,
                visibilityRatio: 1,
                // zoomPerScroll: 1,
                showFullPageControl: false,
                showHomeControl: false,
                showZoomControl: false,
                showSequenceControl: false,
                // zoomPerClick: 1,
                autoHideControls: false,
            })
            setViewer(v);
            setAnnotator(Annotorious(v, {
                allowEmpty: 1,
                disableEditor: 1,
                readOnly: !allowEdit,
                formatters: (a: any) => {
                    const annotationType = a.underlying.body?.[0]?.value
                    let fillColor = "rgba(255,0,0,0.2)"
                    let strokeColor = "#ff0000"
                    if (annotationType) {
                        if (annotationType === 'Auto') {
                            fillColor = "rgba(144, 205, 244, 0.1)"
                            strokeColor = "#90CDF4"
                        }
                        if (annotationType === 'Manual') {
                            fillColor = "rgba(255,0,0,0.2)"
                            strokeColor = "#ff0000"
                        }
                    }
                    return {
                        'style': `stroke: ${strokeColor}; stroke-width: 1px; fill: ${fillColor};`,
                    }
                },
                // handleRadius: 1
            }
            ));
            mounted.current = true;
        };
        if (!mounted.current) {
            InitOpenseadragon();
        }

        return () => {
            if (annotator) {
                annotator.destroy();
            }
        };
    }, [images, allowEdit, id, annotator]);

    const panToAnnotation = useCallback((annotationID: string) => {
        if (annotator) {
            annotator.fitBoundsWithConstraints(annotationID);
            annotator.selectAnnotation(annotationID);

        }
    }, [annotator])

    useEffect(() => {
        if (annotator && annotations) {
            annotator.clearAnnotations()
            annotator.setAnnotations(annotations?.[currentPage] ?? []);
        }
    }, [annotator, annotations, currentPage])

    const zoomIn = useCallback(() => {
        if (viewer) {
            viewer.viewport.zoomTo(viewer.viewport.getZoom(true) * 2);
        }
    }, [viewer])

    const zoomOut = useCallback(() => {
        if (viewer) {
            const currentZoom = viewer.viewport.getZoom(false);
            if (currentZoom > 1) {
                viewer.viewport.zoomTo(currentZoom * 0.5);
            }
        }
    }, [viewer])

    const fullScreen = useCallback(() => {
        if (viewer) {
            viewer.setFullScreen(true);
        }
    }, [viewer])

    const nextPage = useCallback(() => {
        if (viewer && annotator && currentPage < images.length - 1) {
            viewer.goToNextPage();
            setCurrentPage(currentPage + 1);
            if (setFocusedAnnotation) {
                setFocusedAnnotation(null);
            }

        }
    }, [currentPage, images, viewer, annotator, setFocusedAnnotation])

    const prevPage = useCallback(() => {
        if (viewer && annotator && currentPage > 0) {
            viewer.goToPreviousPage();
            setCurrentPage(currentPage - 1);
            if (setFocusedAnnotation) {
                setFocusedAnnotation(null);
            }
        }
    }, [currentPage, viewer, annotator, setFocusedAnnotation])

    useEffect(() => {
        const onAnnotationCreated = (a: Annotation) => {
            // console.log("Annotation created: ", a)
            if (onAnnotationCreate) {
                onAnnotationCreate(a, currentPage);
            }

            if (onAnnotationUpdate) {
                onAnnotationUpdate(a, currentPage);
            }

        }
        if (annotator) {
            annotator.on('createAnnotation', onAnnotationCreated)
        }

        return () => {
            if (annotator) {
                annotator.off('createAnnotation', onAnnotationCreated)
            }
        }
    }, [annotator, onAnnotationCreate, currentPage, onAnnotationUpdate])

    useEffect(() => {
        if (annotator) {
            annotator.on('createSelection', async function (selection: any) {
                selection.body = [{
                    type: 'TextualBody',
                    purpose: 'tagging',
                    value: 'Untagged'
                }];
                await annotator.updateSelected(selection, true);
            });
        }

        return () => {
            if (annotator) {
                annotator.off('createSelection')
            }
        }
    }, [annotator])

    /** Fire an event when annotation is moved or resized */
    useEffect(() => {
        const onAnnotationUpdated = (a: any) => {
            if (onAnnotationUpdate) {
                onAnnotationUpdate(a, currentPage);
            }
        }
        if (annotator) {
            annotator.on('updateAnnotation', onAnnotationUpdated)
        }

        return () => {
            if (annotator) {
                annotator.off('updateAnnotation', onAnnotationUpdated)
            }
        }
    }, [annotator, onAnnotationUpdate, currentPage])

    useEffect(() => {
        const onAnnotationClicked = (a: any) => {
            // console.log("clickAnnotation: ", a)
            if (onAnnotationClick) {
                onAnnotationClick(a.id)
            }
        }
        if (annotator) {
            annotator.on('clickAnnotation', onAnnotationClicked)
        }

        return () => {
            if (annotator) {
                annotator.off('clickAnnotation', onAnnotationClicked)
            }
        }
    }, [annotator, onAnnotationClick])

    useEffect(() => {
        const onAnnotationDeleted = (a: any) => {
            // console.log("deleteAnnotation: ", a)
            if (onAnnotationDelete) {
                onAnnotationDelete(a.id)
            }
        }
        if (annotator) {
            annotator.on('deleteAnnotation', onAnnotationDeleted)
        }

        return () => {
            if (annotator) {
                annotator.off('deleteAnnotation', onAnnotationDeleted)
            }
        }
    }, [annotator, onAnnotationDelete])


    useEffect(() => {
        if (annotationToFocus && viewer) {
            if (annotationToFocus.pageIndex === currentPage) {
                panToAnnotation(annotationToFocus.annotation);
                if (setFocusedAnnotation) {
                    setFocusedAnnotation(null)
                }
            } else {
                viewer.goToPage(annotationToFocus.pageIndex);
                setTimeout(() => {
                    setCurrentPage(annotationToFocus.pageIndex);
                    panToAnnotation(annotationToFocus.annotation);
                    if (setFocusedAnnotation) {
                        setFocusedAnnotation(null);
                    }
                }, 500)
            }
        }
    }, [annotationToFocus, panToAnnotation, currentPage, viewer, setFocusedAnnotation])


    const NUMBER_OF_ANNOTATIONS = useMemo(() => {
        let count = 0
        if (annotations) {
            Object.keys(annotations).forEach((key: any) => {
                count += annotations?.[key].length
            })
        }
        return count
    }, [annotations])

    return (
        <div className="w-full" {...props}>
            {showToolbar && (
                <div className="fixed top-0 flex flex-col gap-0 z-999 w-full">
                    <div className="flex items-stretch gap-0 bg-gray-100 w-full shadow-sm justify-between">
                        <div className="flex items-center gap-0 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-gray-200">
                            {viewMode !== "annotator" && onDualView && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Dual Windows"
                                    onClick={onDualView}
                                    className="rounded-none"
                                >
                                    <SplitSquareHorizontal className="size-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Full Screen"
                                title="Full Screen"
                                onClick={fullScreen}
                                className="rounded-none"
                            >
                                <Maximize className="size-4" />
                            </Button>
                            <div className="flex items-center gap-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Previous Page"
                                    disabled={currentPage === 0}
                                    onClick={prevPage}
                                    className="rounded-none"
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <div className="w-[70px] text-center">
                                    <span className="text-xs">Page {currentPage + 1} of {images.length}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Next Page"
                                    disabled={currentPage === images.length - 1}
                                    onClick={nextPage}
                                    className="rounded-none"
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Zoom In"
                                title="Zoom In"
                                onClick={zoomIn}
                                className="rounded-none"
                            >
                                <ZoomIn className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Zoom Out"
                                title="Zoom Out"
                                onClick={zoomOut}
                                className="rounded-none"
                            >
                                <ZoomOut className="size-4" />
                            </Button>
                            <Badge 
                                className={`mx-2 ${allowEdit ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}
                            >
                                {allowEdit ? 'Editing Mode' : 'Read Only'}
                            </Badge>
                        </div>
                        {customButtons && (
                            <div className="flex items-stretch gap-0 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-gray-200">
                                {customButtons}
                            </div>
                        )}
                    </div>
                    {customHeader && (
                        <div className="w-full z-999">{customHeader}</div>
                    )}
                </div>
            )}

            <div 
                className="relative pt-10 h-screen border border-gray-100 w-full"
                style={annotatorImageStyles}
            >
                <div
                    id={id ? id : "openSeaDragon"}
                    style={{
                        height: "100%",
                        width: "100%"
                    }}
                >
                </div>
                <div className="absolute bottom-2 bg-black/80 text-white left-1 px-4 rounded-md shadow-md py-1">
                    {NUMBER_OF_ANNOTATIONS}
                </div>
            </div>
        </div>
    )
}