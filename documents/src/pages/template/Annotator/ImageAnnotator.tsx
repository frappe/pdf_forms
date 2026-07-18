import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import OpenSeaDragon from "openseadragon";
import Annotorious from '@recogito/annotorious-openseadragon';
import '@recogito/annotorious-openseadragon/dist/annotorious.min.css';
import type { FormTemplateImage } from '@types/FormPrinter/FormTemplateImage';
import type { Annotation } from '@types/Annotation';
import { Button } from '@components/ui/button';
import { DocumentImageSettingModal } from './DocumentImageSettingModal';
import { Maximize, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Settings, ArrowLeft } from 'lucide-react';
import _ from '@lib/translate';


interface AnnotationLabelMap {
    field_label?: string;
    field_name?: string;
}

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
    annotationLabels?: Record<string, AnnotationLabelMap>,
    customButtons?: React.ReactNode,
    customHeader?: React.ReactNode,
    allowEdit?: boolean,
    showToolbar?: boolean,
    annotatorImageStyles?: React.CSSProperties,
    id?: string,
    /** If set, show a Back button beside Full Screen that links to this path (e.g. "/") */
    backTo?: string,
    backLabel?: string,
    /**
     * Use full-page navigation (e.g. &lt;a href&gt;) instead of React Router.
     * Required when leaving the documents SPA to Frappe Desk (basename would break &lt;Link to="/app/..."&gt;).
     */
    backToExternal?: boolean,
    /** Increment after a successful delete to reset pan/zoom to the default (full-page) view. */
    resetZoomNonce?: number,
}

function getTooltipText(annotationId: string, labels?: Record<string, AnnotationLabelMap>): string | null {
    const l = labels?.[annotationId]
    if (!l) return null
    return l.field_label?.trim() || l.field_name?.trim() || null
}

export const ImageAnnotator = ({ customHeader, id, images, onAnnotationClick, setFocusedAnnotation, annotationToFocus, onAnnotationCreate, onAnnotationUpdate, annotatorImageStyles, annotations, annotationLabels, customButtons, allowEdit = true, showToolbar = true, onAnnotationDelete, backTo, backLabel = 'Back to dashboard', backToExternal = false, resetZoomNonce = 0, ...props }: Props) => {

    const [currentPage, setCurrentPage] = useState(0);

    const mounted = useRef(false);
    const lastResetZoomNonce = useRef(0);

    const [annotator, setAnnotator] = useState<any>(null);

    const [viewer, setViewer] = useState<OpenSeaDragon.Viewer | null>(null);

    const TOOLTIP_HOVER_DELAY_MS = 200;

    const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const tooltipDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (!viewer || !resetZoomNonce || resetZoomNonce <= lastResetZoomNonce.current) return
        lastResetZoomNonce.current = resetZoomNonce
        viewer.viewport.goHome(true)
    }, [resetZoomNonce, viewer])

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
        const onMouseEnter = (a: { id: string }) => {
            if (tooltipDelayRef.current) {
                clearTimeout(tooltipDelayRef.current)
                tooltipDelayRef.current = null
            }
            const text = getTooltipText(a.id, annotationLabels)
            if (text) {
                tooltipDelayRef.current = setTimeout(() => {
                    tooltipDelayRef.current = null
                    setTooltip({
                        text,
                        x: mousePosRef.current.x,
                        y: mousePosRef.current.y,
                    })
                }, TOOLTIP_HOVER_DELAY_MS)
            }
        }
        const onMouseLeave = () => {
            if (tooltipDelayRef.current) {
                clearTimeout(tooltipDelayRef.current)
                tooltipDelayRef.current = null
            }
            setTooltip(null)
        }
        if (annotator) {
            annotator.on('mouseEnterAnnotation', onMouseEnter)
            annotator.on('mouseLeaveAnnotation', onMouseLeave)
        }
        return () => {
            if (tooltipDelayRef.current) {
                clearTimeout(tooltipDelayRef.current)
                tooltipDelayRef.current = null
            }
            if (annotator) {
                annotator.off('mouseEnterAnnotation', onMouseEnter)
                annotator.off('mouseLeaveAnnotation', onMouseLeave)
            }
        }
    }, [annotator, annotationLabels])

    useEffect(() => {
        const containerId = id ?? 'openSeaDragon'
        const el = document.getElementById(containerId)
        if (!el) return
        const onMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY }
            setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))
        }
        el.addEventListener('mousemove', onMouseMove)
        return () => el.removeEventListener('mousemove', onMouseMove)
    }, [viewer, id])

    useEffect(() => {
        if (annotationToFocus && viewer) {
            if (annotationToFocus.pageIndex === currentPage) {
                panToAnnotation(annotationToFocus.annotation);
                if (setFocusedAnnotation) {
                    setFocusedAnnotation(null)
                }
            } else {
                // Go to the required page first and update currentPage immediately
                viewer.goToPage(annotationToFocus.pageIndex);
                setTimeout(() => {
                    setCurrentPage(annotationToFocus.pageIndex);
                }, 0);

                // After a small delay (to allow annotations to load), pan to the annotation
                setTimeout(() => {
                    panToAnnotation(annotationToFocus.annotation);
                    if (setFocusedAnnotation) {
                        setFocusedAnnotation(null);
                    }
                }, 500);
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

    const [isOpen, setIsOpen] = useState(false);

    const onOpen = useCallback(() => {
        setIsOpen(true);
    }, [setIsOpen])

    const onClose = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen])

    return (
        <div className="relative w-full" {...props}>
            {showToolbar && (
                <div className="absolute top-0 left-0 right-0 flex flex-col gap-0 z-50 pointer-events-auto border-l border-r border-outline-gray-2">
                    <div className="flex items-stretch gap-0 bg-surface-gray-1 w-full shadow-sm justify-between p-1">
                        <div className="flex items-center gap-1">
                            {backTo && (
                                <Button variant="ghost" theme="gray" isIconButton size="md" aria-label={backLabel} title={backLabel} asChild>
                                    {backToExternal ? (
                                        <a href={backTo}>
                                            <ArrowLeft className="size-4" />
                                        </a>
                                    ) : (
                                        <Link to={backTo}>
                                            <ArrowLeft className="size-4" />
                                        </Link>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                theme="gray"
                                isIconButton
                                size="md"
                                aria-label={_("Full Screen")}
                                title={_("Full Screen")}
                                onClick={fullScreen}
                               
                            >
                                <Maximize className="size-4" />
                            </Button>
                            <div className="flex items-center gap-0">
                                <Button
                                    variant="ghost"
                                    theme="gray"
                                    isIconButton
                                    size="md"
                                    aria-label={_("Previous Page")}
                                    disabled={currentPage === 0}
                                    onClick={prevPage}
                                   
                                    title={_("Previous Page")}
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <div className="w-[70px] text-center">
                                    <span className="text-xs">{_("Page")} {currentPage + 1} {_("of")} {images.length}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    theme="gray"
                                    isIconButton
                                    size="md"
                                    aria-label={_("Next Page")}
                                    disabled={currentPage === images.length - 1}
                                    onClick={nextPage}
                                   
                                    title={_("Next Page")}
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                theme="gray"
                                isIconButton
                                size="md"
                                aria-label={_("Zoom In")}
                                title={_("Zoom In")}
                                onClick={zoomIn}
                               
                            >
                                <ZoomIn className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                theme="gray"
                                isIconButton
                                size="md"
                                aria-label={_("Zoom Out")}
                                title={_("Zoom Out")}
                                onClick={zoomOut}
                               
                            >
                                <ZoomOut className="size-4" />
                            </Button>
                        </div>
                        {customButtons && (
                            <div className="flex items-stretch gap-0 [&>*:not(:last-child)]:border-e [&>*:not(:last-child)]:border-outline-gray-2">
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
                className="relative pt-10 h-[70vh] md:h-[75vh] lg:h-screen border border-outline-gray-2 w-full"
                style={annotatorImageStyles}
            >
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    aria-label={_("Settings")}
                    title={_("Settings")}
                    onClick={onOpen}
                    isIconButton
                    className="absolute right-2 top-12 z-50"
                >
                    <Settings className="size-4" />
                </Button>
                <div
                    id={id ? id : "openSeaDragon"}
                    style={{
                        height: "100%",
                        width: "100%"
                    }}
                >
                </div>
                {tooltip && (
                    <div
                        className="fixed z-9999 pointer-events-none px-2 py-1.5 text-sm text-white bg-gray-900 rounded shadow-lg max-w-[280px] truncate"
                        style={{
                            left: tooltip.x + 12,
                            top: tooltip.y + 12,
                        }}
                    >
                        {tooltip.text}
                    </div>
                )}
                <div className="absolute bottom-2 left-1 bg-black/80 px-3 py-1 text-white rounded-md shadow-md">
                    {NUMBER_OF_ANNOTATIONS}
                </div>
            </div>
            {images[currentPage] && (
                <DocumentImageSettingModal
                    isOpen={isOpen}
                    onClose={onClose}
                    image={images[currentPage]}
                />
            )}
        </div>
    )
}