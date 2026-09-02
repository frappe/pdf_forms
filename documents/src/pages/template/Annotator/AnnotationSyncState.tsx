import { useCallback, useEffect, useState } from 'react'
import { useSWRConfig } from 'frappe-react-sdk'
import { toast } from 'sonner'
import { Button } from '@components/ui/button'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import _ from '@lib/translate'

interface Props {
    syncing: boolean,
    forceUpdate: () => Promise<void>,
    hasUnsavedChanges: boolean,
}

export const AnnotationSyncState = ({ forceUpdate, hasUnsavedChanges }: Props) => {

    const [highlightSyncButton, setHighlightSyncButton] = useState(false)


    const { mutate } = useSWRConfig()

    const update = useCallback(() => {
        forceUpdate()
            .then(() => {
                mutate('document_template_fields')
                setHighlightSyncButton(false)
                toast.success(_("Annotations saved"), {
                    duration: 1000,
                })
            })
            .catch((error) => {
                toast.error(_("Failed to save annotations"), {
                    duration: 1000,
                })
                console.error(error)
            })
    }, [forceUpdate, mutate])

    useEffect(() => {
        const alertUser = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                // alert('You have unsaved changes. Please save them before syncing.')
                setHighlightSyncButton(true)
                update()
                e.returnValue = _('You have unsaved changes. Save them before leaving this page.')
            }
        }
        window.addEventListener('beforeunload', alertUser)
        return () => {
            window.removeEventListener('beforeunload', alertUser)
        }
    }, [hasUnsavedChanges, update])

    return (
        <div className="flex items-stretch">
            {hasUnsavedChanges ? (
                <motion.div
                    style={{ height: '100%' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    data-testid='sync-button'
                >
                    <Button
                        size="sm"
                        onClick={update}
                        variant={highlightSyncButton ? 'solid' : 'subtle'}
                        theme="gray"
                        title={_("Force Update")}
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            initial={{ rotate: 0 }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        >
                            <RefreshCw className="size-4" />
                        </motion.div>
                        {_("Sync")}
                    </Button>
                </motion.div>
            ) : null /* synced state is silent — autosave needs no chip */}
        </div>
    )
}