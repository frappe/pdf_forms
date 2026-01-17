import { FrappeProvider } from 'frappe-react-sdk'
import { Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'
import { UserProvider } from '@/providers/UserProvider'
import { Toaster } from 'sonner'
import { useEffect } from 'react'

const router = createBrowserRouter(
	createRoutesFromElements(
		<>
			<Route path='/' element={<><h1>Documents</h1></>} />
		</>
	), {
	basename: import.meta.env.VITE_BASE_NAME ? `/${import.meta.env.VITE_BASE_NAME}` : '',
}
)

function App() {

	const getSiteName = () => {
		// @ts-expect-error expected
		if (window.frappe?.boot?.versions?.frappe.startsWith('14')) {
			return import.meta.env.VITE_SITE_NAME
		}
		else {
			// @ts-expect-error expected
			return window.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME
		}
	}

	useEffect(() => {
		// Check if user is logged in by checking the Cookie "user_id"
		// In Frappe, unauthenticated users are "Guest"
		const user = document.cookie?.split('; ').find(row => row.startsWith('user_id='))?.split('=')[1]?.trim()
		const isLoggedIn = user !== 'Guest'

		if (!isLoggedIn) {
			if (import.meta.env.DEV) {
				return
			}
			// Redirect to Frappe login page
			window.location.href = '/login?redirect-to=/documents'
			return
		}
	}, [])

	return (
		<FrappeProvider
			url={import.meta.env.VITE_FRAPPE_PATH ?? ''}
			socketPort={import.meta.env.VITE_SOCKET_PORT ? import.meta.env.VITE_SOCKET_PORT : undefined}
			siteName={getSiteName()}
		>
			<UserProvider>
				<Toaster richColors />
				<RouterProvider router={router} />
			</UserProvider>
		</FrappeProvider>
	)
}

export default App
