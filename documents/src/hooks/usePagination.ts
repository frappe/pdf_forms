import { useFrappeGetDocCount } from "frappe-react-sdk";
import type { Filter } from "frappe-react-sdk";
import { useSearchParams } from "react-router-dom";

export interface DoctypePaginationHookReturnType extends PaginationHookReturnType {
    count: number | undefined,
    error: any,
    mutate: VoidFunction,
    filter?: string,
    setFilter: (filters: string) => void
}

/**
 * Custom Pagination hook for 'Page Length selector' & 'Page selector'.
 * @param docType Name of the Frappe Doctype for which total count will be returned.
 * @param pageLength default page length
 * @returns [ start, count, error, selected, setPageLength, nextPage, previousPage ]
 */
export const usePaginationWithDoctype = (docType: string, pageLength: number, filters?: Filter[]): DoctypePaginationHookReturnType => {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = searchParams.get('name') ? searchParams.get('name') as string : ''

    const setFilter = (filter?: string) => {
        if (!filter) {
            setSearchParams((s) => {
                const updatedSearchParams = new URLSearchParams(s.toString())
                updatedSearchParams.delete('name')
                //Update search params with new filter
                return updatedSearchParams
            })
            return
        }

        setSearchParams((s) => {
            const updatedSearchParams = new URLSearchParams(s.toString())
            updatedSearchParams.set('name', filter)
            //Update search params with new filter
            return updatedSearchParams
        })
    }

    const f: Filter[] | undefined = filter ? [['name', 'like', `%${filter}%`], ...(filters ? filters : [])] : filters

    const { data: count, error, mutate } = useFrappeGetDocCount(docType, f)

    const paginationProps = usePagination(pageLength, count ? count : 0)

    return { count, error, mutate, filter, setFilter, ...paginationProps }
}

export interface PaginationHookReturnType {
    start: number,
    selectedPageLength: number,
    setPageLength: (value: number) => void,
    nextPage: VoidFunction,
    previousPage: VoidFunction,
}
export const usePagination = (initPageLength: number, totalRows: number = 0) => {

    let [searchParams, setSearchParams] = useSearchParams();

    const selectedPageLength = searchParams.get('count') ? parseInt(searchParams.get('count') as string) : initPageLength
    const start = Math.min(searchParams.get('start') ? parseInt(searchParams.get('start') as string) > 0 ? parseInt(searchParams.get('start') as string) : 1 : 1, totalRows)

    const setPageLength = (value: number) => {
        setSearchParams((s) => {
            const updatedSearchParams = new URLSearchParams(s.toString())
            updatedSearchParams.set('count', value.toString())
            //Update search params with new page length
            return updatedSearchParams
        })
    }

    const nextPage = () => {
        setSearchParams((s) => {
            const updatedSearchParams = new URLSearchParams(s.toString())
            const value = (start + selectedPageLength).toString()
            updatedSearchParams.set('start', value)
            //Update search params with new start value
            return updatedSearchParams
        })
    }

    const previousPage = () => {
        setSearchParams((s) => {
            const updatedSearchParams = new URLSearchParams(s.toString())
            const value = (start - selectedPageLength) > 0 ? (start - selectedPageLength).toString() : '1'
            updatedSearchParams.set('start', value)
            //Update search params with new start value
            return updatedSearchParams
        })
    }

    return { start: totalRows ? start : 0, selectedPageLength, setPageLength, nextPage, previousPage }
}