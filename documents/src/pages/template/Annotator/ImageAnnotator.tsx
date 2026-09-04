import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import OpenSeaDragon from "openseadragon";
import Annotorious from '@recogito/annotorious-openseadragon';
import '@recogito/annotorious-openseadragon/dist/annotorious.min.css';
import { Button } from '@components/ui/button';
import { WithTooltip } from '@components/ui/tooltip';
import { DocumentImageSettingModal } from './DocumentImageSettingModal';
import { Maximize, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Settings, ArrowLeft, ImageOff } from 'lucide-react';
import _ from '@lib/translate';
import type { FormTemplateImage } from '@/types/FormPrinter/FormTemplateImage';
import type { Annotation } from '@/types/Annotation';
import type { PreviewFieldValue } from '../PreviewDataContext';


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
    /** Annotation id -> how that field would print, drawn over the page. */
    previewValues?: Record<string, PreviewFieldValue>,
    /** Declared /DA font name -> CSS family registered from the PDF's embedded program. */
    previewFonts?: Record<string, string>,
}

/** PDF base-14 fonts mapped to what a browser can actually render. */
const PDF_FONT_STACKS: Record<string, string> = {
    helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    courier: "'Courier New', Courier, monospace",
    'times-roman': "'Times New Roman', Times, serif",
    symbol: "'Segoe UI Symbol', sans-serif",
    zapfdingbats: "'Zapf Dingbats', 'Segoe UI Symbol', sans-serif",
}

function getTooltipText(annotationId: string, labels?: Record<string, AnnotationLabelMap>): string | null {
    const l = labels?.[annotationId]
    if (!l) return null
    return l.field_label?.trim() || l.field_name?.trim() || null
}

export const ImageAnnotator = ({ customHeader, id, images, onAnnotationClick, setFocusedAnnotation, annotationToFocus, onAnnotationCreate, onAnnotationUpdate, annotatorImageStyles, annotations, annotationLabels, customButtons, allowEdit = true, showToolbar = true, onAnnotationDelete, backTo, backLabel = 'Back to dashboard', backToExternal = false, resetZoomNonce = 0, previewValues, previewFonts, ...props }: Props) => {

    const [currentPage, setCurrentPage] = useState(0);

    const mounted = useRef(false);
    const lastResetZoomNonce = useRef(0);

    const [annotator, setAnnotator] = useState<any>(null);

    const [viewer, setViewer] = useState<OpenSeaDragon.Viewer | null>(null);

    const TOOLTIP_HOVER_DELAY_MS = 200;

    const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const tooltipDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [imageLoadFailed, setImageLoadFailed] = useState(false);

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
            // Replace OSD's raw failure text ("Unable to open [object Object]…")
            // with our own error state overlay.
            v.addHandler('open-failed', () => setImageLoadFailed(true));
            v.addHandler('open', () => setImageLoadFailed(false));
            setViewer(v);
            setAnnotator(Annotorious(v, {
                allowEmpty: 1,
                disableEditor: 1,
                readOnly: !allowEdit,
                formatters: (a: any) => {
                    // Espresso semantics: Auto (system-detected) = blue (informational),
                    // Manual (user-drawn) = violet (authored). Never red — red is for
                    // errors, and an annotation isn't one. Hover/selected gain stroke
                    // weight via CSS (index.css), not a color change.
                    const annotationType = a.underlying.body?.[0]?.value
                    const isAuto = annotationType === 'Auto'
                    const stroke = isAuto ? 'var(--blue-500)' : 'var(--violet-500)'
                    const fill = isAuto
                        ? 'color-mix(in srgb, var(--blue-500) 8%, transparent)'
                        : 'color-mix(in srgb, var(--violet-500) 10%, transparent)'
                    return {
                        'style': `stroke: ${stroke}; stroke-width: 1px; fill: ${fill};`,
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

    /* ---------------------------------------------------------------- *
     * Live preview: draw the value each field would print inside its box.
     * OpenSeadragon overlays are anchored in image coordinates, so they pan
     * and zoom with the page for free; only the font size has to be tracked
     * by hand, from the element's rendered height.
     * ---------------------------------------------------------------- */
    const previewOverlays = useRef<HTMLElement[]>([]);

    useEffect(() => {
        if (!viewer) return

        const clear = () => {
            previewOverlays.current.forEach((el) => {
                try { viewer.removeOverlay(el) } catch { /* overlay already gone */ }
            })
            previewOverlays.current = []
        }
        clear()

        const pageAnnotations = annotations?.[currentPage] ?? []
        if (previewValues && Object.keys(previewValues).length) {
            pageAnnotations.forEach((annotation) => {
                const preview = previewValues[annotation.id]
                if (!preview) return
                // An unticked box prints nothing, so it shows nothing here either.
                if (preview.kind === 'check' && !preview.checked) return

                const match = /xywh=pixel:([\d.]+),([\d.]+),([\d.]+),([\d.]+)/.exec(
                    annotation.target?.selector?.value ?? ''
                )
                if (!match) return
                const [x, y, w, h] = match.slice(1).map(Number)

                const el = document.createElement('div')
                if (preview.kind === 'check') {
                    el.className = 'pdf-preview-value pdf-preview-check'
                    el.textContent = '✓'
                    el.title = _("Checked")
                } else {
                    el.className = 'pdf-preview-value'
                    const stack = PDF_FONT_STACKS[preview.font] ?? PDF_FONT_STACKS.helvetica
                    // The PDF's own font first, when it is embedded and has loaded.
                    const real = preview.font_name ? previewFonts?.[preview.font_name] : undefined
                    el.style.fontFamily = real ? `'${real}', ${stack}` : stack
                    if (preview.bold) el.style.fontWeight = '700'
                    if (preview.italic) el.style.fontStyle = 'italic'
                    // Remembered in image pixels; converted to screen pixels below.
                    el.dataset.fontImagePx = String(preview.font_size_px || 0)
                    if (preview.comb) {
                        // A comb field prints one character per cell; lay the value
                        // out on the same grid so an account number reads as boxes.
                        // On an inner wrapper: the viewer owns the overlay element's
                        // own display and position styles.
                        el.classList.add('pdf-preview-comb')
                        el.dataset.combCells = String(preview.comb)
                        const grid = document.createElement('div')
                        grid.className = 'pdf-preview-comb-grid'
                        grid.style.gridTemplateColumns = `repeat(${preview.comb}, 1fr)`
                        Array.from(preview.text.slice(0, preview.comb)).forEach((ch) => {
                            const cell = document.createElement('span')
                            cell.textContent = ch
                            grid.appendChild(cell)
                        })
                        el.appendChild(grid)
                        el.title = preview.text
                    } else {
                        // Plain text: the resolver can return markup (a Text Editor field
                        // prints its HTML), and this must show what actually prints.
                        el.textContent = preview.text
                        el.title = preview.text
                    }
                }
                el.dataset.imageHeight = String(h)

                viewer.addOverlay({
                    element: el,
                    location: viewer.viewport.imageToViewportRectangle(
                        new OpenSeaDragon.Rect(x, y, w, h)
                    ),
                })
                previewOverlays.current.push(el)
            })
        }

        // Overlay boxes scale with the viewport, their text does not — size it
        // from the box's rendered height on every viewport change.
        const scaleText = () => {
            previewOverlays.current.forEach((el) => {
                const boxHeight = el.clientHeight
                if (boxHeight <= 0) return
                const imageHeight = Number(el.dataset.imageHeight) || 0
                const fontImagePx = Number(el.dataset.fontImagePx) || 0
                // Text keeps the size the PDF will print, converted image px ->
                // screen px by how much the viewer is currently magnifying.
                const combCells = Number(el.dataset.combCells) || 0
                let size = fontImagePx && imageHeight
                    ? fontImagePx * (boxHeight / imageHeight)
                    : boxHeight * 0.72
                if (combCells) {
                    // Same fit the printer applies: a character must sit inside its cell.
                    const cellWidth = el.clientWidth / combCells
                    size = Math.min(size || boxHeight * 0.72, cellWidth * 1.1)
                }
                el.style.fontSize = `${Math.max(4, Math.min(size, 64))}px`
            })
        }
        scaleText()
        viewer.addHandler('update-viewport', scaleText)

        return () => {
            viewer.removeHandler('update-viewport', scaleText)
            clear()
        }
    }, [viewer, annotations, currentPage, previewValues, previewFonts])

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
        <div className="relative h-full w-full" {...props}>
            {showToolbar && (
                // No side borders here — the pane divider and page edges already
                // provide them; doubling made a twin line at the split.
                <div className="absolute top-0 left-0 right-0 flex flex-col gap-0 z-50 pointer-events-auto">
                    <div className="flex items-stretch gap-0 bg-surface-gray-1 w-full shadow-sm justify-between p-1">
                        {/* Three zones. The outer two share the leftover space
                            equally, so page navigation is centred against the
                            toolbar itself rather than against whatever happens
                            to sit to its left. */}
                        <div className="flex flex-1 min-w-0 items-center justify-start gap-1 [&_button]:shrink-0">
                            {backTo && (
                                <WithTooltip tip={backLabel}>
                                    <Button variant="ghost" theme="gray" isIconButton size="md" aria-label={backLabel} asChild>
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
                                </WithTooltip>
                            )}
                            <WithTooltip tip={_("Full Screen")}>
                                <Button
                                    variant="ghost"
                                    theme="gray"
                                    isIconButton
                                    size="md"
                                    aria-label={_("Full Screen")}
                                    onClick={fullScreen}
                                >
                                    <Maximize className="size-4" />
                                </Button>
                            </WithTooltip>
                            {/* Mirrors the divider before the zoom controls, so the
                                toolbar reads as three groups from either end. */}
                            <span className="mx-1 h-4 w-px shrink-0 bg-outline-gray-2" aria-hidden />
                        </div>

                        <div className="flex shrink-0 items-center gap-0">
                                <WithTooltip tip={_("Previous Page")}>
                                    <Button
                                        variant="ghost"
                                        theme="gray"
                                        isIconButton
                                        size="md"
                                        aria-label={_("Previous Page")}
                                        disabled={currentPage === 0}
                                        onClick={prevPage}
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                </WithTooltip>
                                <div className="min-w-[76px] px-1 text-center">
                                    <span className="text-xs tabular-nums whitespace-nowrap">
                                        {_("Page")} {currentPage + 1} {_("of")} {images.length}
                                    </span>
                                </div>
                                <WithTooltip tip={_("Next Page")}>
                                    <Button
                                        variant="ghost"
                                        theme="gray"
                                        isIconButton
                                        size="md"
                                        aria-label={_("Next Page")}
                                        disabled={currentPage === images.length - 1}
                                        onClick={nextPage}
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </WithTooltip>
                        </div>

                        <div className="flex flex-1 min-w-0 items-center justify-end gap-1">
                            {/* Contextual buttons shrink; the zoom controls never
                                do, so they stay pinned to the right edge. */}
                            {customButtons ? (
                                <div className="flex min-w-0 items-center gap-1">{customButtons}</div>
                            ) : null}
                            {customButtons ? (
                                <span className="mx-1 h-4 w-px shrink-0 bg-outline-gray-2" aria-hidden />
                            ) : null}
                            <div className="flex shrink-0 items-center gap-1">
                            <WithTooltip tip={_("Zoom In")}>
                                <Button
                                    variant="ghost"
                                    theme="gray"
                                    isIconButton
                                    size="md"
                                    aria-label={_("Zoom In")}
                                    onClick={zoomIn}
                                >
                                    <ZoomIn className="size-4" />
                                </Button>
                            </WithTooltip>
                            <WithTooltip tip={_("Zoom Out")}>
                                <Button
                                    variant="ghost"
                                    theme="gray"
                                    isIconButton
                                    size="md"
                                    aria-label={_("Zoom Out")}
                                    onClick={zoomOut}
                                >
                                    <ZoomOut className="size-4" />
                                </Button>
                            </WithTooltip>
                            </div>
                        </div>
                    </div>
                    {customHeader && (
                        <div className="w-full z-999">{customHeader}</div>
                    )}
                </div>
            )}

            <div
                className="relative h-full w-full pt-10"
                style={annotatorImageStyles}
            >
                {/* Per-PAGE settings live ON the page they configure (repeat count
                    etc. is page-scoped), not in the toolbar which governs the whole PDF. */}
                <WithTooltip tip={_("Page settings")}>
                    <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        aria-label={_("Page settings")}
                        onClick={onOpen}
                        isIconButton
                        className="absolute right-2 top-12 z-50"
                    >
                        <Settings className="size-4" />
                    </Button>
                </WithTooltip>
                <div
                    id={id ? id : "openSeaDragon"}
                    style={{
                        height: "100%",
                        width: "100%"
                    }}
                >
                </div>
                {imageLoadFailed && (
                    <div className="absolute inset-0 top-10 z-40 flex flex-col items-center justify-center gap-3 bg-surface-base p-6 text-center">
                        <div className="rounded-full bg-surface-gray-2 p-4">
                            <ImageOff className="size-8 text-ink-gray-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg-medium text-ink-gray-8">{_("Could not load the page image")}</p>
                            <p className="text-p-base text-ink-gray-5 max-w-sm">
                                {_("The converted page image is missing or you don't have access to it. Try re-uploading the PDF, or check the background job logs.")}
                            </p>
                        </div>
                    </div>
                )}
                {tooltip && (
                    <div
                        className="fixed z-9999 pointer-events-none px-2 py-1 text-p-xs text-ink-base bg-surface-gray-10 rounded shadow-xl max-w-[280px] truncate"
                        style={{
                            left: tooltip.x + 12,
                            top: tooltip.y + 12,
                        }}
                    >
                        {tooltip.text}
                    </div>
                )}
                <div
                    className="absolute bottom-2 left-2 bg-surface-gray-10 px-2 py-1 text-p-xs text-ink-base rounded shadow-xl"
                    title={_("Fields annotated on this page")}
                >
                    {_(`${NUMBER_OF_ANNOTATIONS} ${NUMBER_OF_ANNOTATIONS === 1 ? 'field' : 'fields'}`)}
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