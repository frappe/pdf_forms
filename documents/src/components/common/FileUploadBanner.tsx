import { CheckCircle } from 'lucide-react'
import { Progress } from '../ui/progress'
import _ from '@/lib/translate'

const FileUploadBanner = ({
    uploadProgress,
}: { uploadProgress: number }) => {
    return <div className="flex items-center justify-center flex-col gap-4">
        <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2">
                <CheckCircle size={24} className="text-green-600" />
                <span className="text-accent-foreground">{_("Uploading attachments...")}</span>
            </div>
            <Progress value={Math.round(uploadProgress * 100)} />
        </div>
    </div>
}

export default FileUploadBanner