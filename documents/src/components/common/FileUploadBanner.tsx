import { CheckCircle } from 'lucide-react'
import { Progress } from '../ui/progress'
import { cn } from '@/lib/utils'
import _ from '@/lib/translate'

type FileUploadBannerProps = {
    uploadProgress: number
    label?: string
    progressClassName?: string
}

const FileUploadBanner = ({
    uploadProgress,
    label,
    progressClassName,
}: FileUploadBannerProps) => {
    const percent = Math.min(
        100,
        Math.max(
            0,
            uploadProgress > 1 ? Math.round(uploadProgress) : Math.round(uploadProgress * 100),
        ),
    )
    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-4">
                <div className="flex items-center justify-center gap-2">
                    <CheckCircle size={24} className="text-green-600 shrink-0" />
                    <span className="text-accent-foreground">{_("Uploading attachments...")}</span>
                </div>
                <div className="w-full">
                    <Progress
                        value={percent}
                        size="md"
                        label={label}
                        hint
                        hintText={`${percent}%`}
                        className={cn('w-full min-w-[280px] max-w-full', progressClassName)}
                    />
                </div>
            </div>
        </div>
    )
}

export default FileUploadBanner