import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
