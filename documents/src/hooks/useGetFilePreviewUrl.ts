import { useEffect, useMemo } from 'react';

const VALID_IMAGE_TYPES = ['image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/jpg']

/**
 * Hook takes in a file and returns a blob URL for previewing the file if image
 * @param file 
 * @returns File url
 */
export const useGetFilePreviewUrl = (file: File): string => {

    const url = useMemo(() => {
        if (!VALID_IMAGE_TYPES.includes(file.type)) {
            return ""
        }
        return URL.createObjectURL(file)
    }, [file])

    useEffect(() => {
        if (!url) return
        return () => {
            URL.revokeObjectURL(url)
        }
    }, [url])

    return url
}
