import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Paragraph scale from @theme (`text-p-*`) shares the `text-` prefix with text colors (`text-ink-*`).
 * Default tailwind-merge treats them as one conflict group; register `text-p-*` as font-size so
 * typography and color can coexist (e.g. FormDescription).
 */
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            "font-size": [
                { text: ["p-2xs", "p-xs", "p-sm", "p-base", "p-lg", "p-xl", "p-2xl", "p-3xl"] },
            ],
        },
    },
})

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getKeyboardMetaKeyString(): string {
  if (typeof window !== 'undefined') {
    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
    return isMac ? '⌘' : 'Ctrl'
  }
  return 'Ctrl'
}
