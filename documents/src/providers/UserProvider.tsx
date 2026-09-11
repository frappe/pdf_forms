/* eslint-disable react-refresh/only-export-components */
import { useFrappeAuth, type FrappeError } from 'frappe-react-sdk'
import { createContext } from 'react'
import type { FC, PropsWithChildren } from 'react'
import { toast } from 'sonner'

interface ParsedErrorMessage {
    message: string,
    title?: string,
    indicator?: string,
}

export const getErrorMessage = (error?: FrappeError | null): string => {
    const messages = getErrorMessages(error)
    return messages.map(m => m.message).join('\n')
}

const getErrorMessages = (error?: FrappeError | null): ParsedErrorMessage[] => {
    if (!error) return []
    let eMessages: ParsedErrorMessage[] = error?._server_messages ? JSON.parse(error?._server_messages) : []
    eMessages = eMessages.map((m: any) => {
        try {
            return JSON.parse(m)
        } catch {
            return m
        }
    })

    if (eMessages.length === 0) {
        // Get the message from the exception by removing the exc_type
        const indexOfFirstColon = error?.exception?.indexOf(':')
        if (indexOfFirstColon) {
            const exception = error?.exception?.slice(indexOfFirstColon + 1)
            if (exception) {
                eMessages = [{
                    message: exception,
                    title: "Error"
                }]
            }
        }

        if (eMessages.length === 0) {
            eMessages = [{
                message: error?.message,
                title: "Error",
                indicator: "red"
            }]
        }
    }
    return eMessages

}

interface UserContextProps {
    isLoading: boolean,
    currentUser: string,
    logout: () => Promise<void>,
    updateCurrentUser: VoidFunction,
}

export const UserContext = createContext<UserContextProps>({
    currentUser: '',
    isLoading: false,
    logout: () => Promise.resolve(),
    updateCurrentUser: () => { },
})

export const UserProvider: FC<PropsWithChildren> = ({ children }) => {

    const { logout, currentUser, updateCurrentUser, isLoading } = useFrappeAuth()

    const handleLogout = async () => {
        return logout()
            .then(() => {
                // Use window.location.replace for logout to ensure full reset
                const baseName = import.meta.env.VITE_BASE_NAME
                const loginPath = baseName ? `/${baseName}/login` : '/login'
                window.location.replace(loginPath)
            })
            .catch((error) => {
                toast.error('Failed to logout', {
                    description: getErrorMessage(error)
                })
            })
    }

    return (
        <UserContext.Provider value={{ isLoading, updateCurrentUser, logout: handleLogout, currentUser: currentUser ?? "" }}>
            {children}
        </UserContext.Provider>
    )
}