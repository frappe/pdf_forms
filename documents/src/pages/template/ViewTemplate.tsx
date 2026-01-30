import { useParams } from 'react-router-dom'
import { Annotator } from './Annotator/Annotator'
import { DocumentForm } from './DocumentForm/DocumentForm'

export const ViewTemplate = () => {

    const { templateID } = useParams<{ templateID: string }>()

    if (templateID) {
        return (
            <div className="flex items-start gap-0">
                <div className="w-[45%] border-r">
                    <Annotator templateID={templateID} />
                </div>
                <div className="w-[55%] mt-10">
                    <DocumentForm templateID={templateID} />
                </div>
            </div>
        )
    }

    return null
}
