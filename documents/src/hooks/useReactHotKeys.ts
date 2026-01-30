import type { DependencyList } from "react"
import { useRef } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import type { HotkeysEvent, Options } from "react-hotkeys-hook/dist/types"

const DEFAULT_OPTIONS: Options = {
    enabled: true,
    preventDefault: true,
}


const SAVE_DEFAULT_OPTIONS: Options = {
    ...DEFAULT_OPTIONS,
    enableOnFormTags: true
}


/**
 *  Custom hook for react-hotkeys-hook to use in react components
 * @param keys 
 * @param callback 
 * @param options 
 * @param dependencies 
 */
export const useSaveHotkey = (options: Options = SAVE_DEFAULT_OPTIONS, dependencies: DependencyList = []) => {
    const saveButtonRef = useRef<HTMLButtonElement>(null)
    const pageRef = useHotkeys(["meta+s", "ctrl+s"], () => {
        saveButtonRef.current?.focus()
        saveButtonRef.current?.click()
        saveButtonRef.current?.blur()
    }, { ...SAVE_DEFAULT_OPTIONS, ...options }, dependencies)
    return { saveButtonRef, pageRef }
}

export const CREATE_DEFAULT_OPTIONS: Options = {
    ...DEFAULT_OPTIONS,
    enableOnFormTags: true
}
export const useCreateHotkey = (callback: (event: KeyboardEvent, handler: HotkeysEvent) => void, options: Options = CREATE_DEFAULT_OPTIONS, dependencies: DependencyList = []) => {
    const pageRef = useHotkeys(["meta+b", "ctrl+b"], callback, { ...CREATE_DEFAULT_OPTIONS, ...options }, dependencies)

    return pageRef
}

export const useCommandPaletteHotkey = (callback: (event: KeyboardEvent, handler: HotkeysEvent) => void, options: Options = CREATE_DEFAULT_OPTIONS, dependencies: DependencyList = []) => {
    const pageRef = useHotkeys(["meta+k", "ctrl+k"], callback, { ...CREATE_DEFAULT_OPTIONS, ...options }, dependencies)

    return pageRef
}

export const useCopyToClipboardHotkey = (callback: (event: KeyboardEvent, handler: HotkeysEvent) => void, options: Options = CREATE_DEFAULT_OPTIONS, dependencies: DependencyList = []) => {
    const pageRef = useHotkeys(["meta+e", "ctrl+e"], callback, { ...CREATE_DEFAULT_OPTIONS, ...options }, dependencies)

    return pageRef
}

export const usePasteFromClipboardHotkey = (callback: (event: KeyboardEvent, handler: HotkeysEvent) => void, options: Options = CREATE_DEFAULT_OPTIONS, dependencies: DependencyList = []) => {
    const pageRef = useHotkeys(["meta+i", "ctrl+i"], callback, { ...CREATE_DEFAULT_OPTIONS, ...options }, dependencies)

    return pageRef
}