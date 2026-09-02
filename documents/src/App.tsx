import { FrappeProvider } from 'frappe-react-sdk'
import { Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'
import { UserProvider } from '@providers/UserProvider'
import { ThemeProvider } from '@components/ui/theme-provider'
import { TooltipProvider } from '@components/ui/tooltip'
import { Toaster } from '@components/ui/sonner'
import { useEffect } from 'react'
import { ViewTemplate } from './pages/template/ViewTemplate'
import { Dashboard } from './pages/dashboard/Dashboard'

const router = createBrowserRouter(
	createRoutesFromElements(
		<>
			<Route path='/' element={<Dashboard />} />
			<Route path='template/:templateID' element={<ViewTemplate />} />
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
			window.location.href = '/login?redirect-to=/pdf_forms'
			return
		}
	}, [])

	return (
		<FrappeProvider
			url={import.meta.env.VITE_FRAPPE_PATH ?? ''}
			socketPort={import.meta.env.VITE_SOCKET_PORT ? import.meta.env.VITE_SOCKET_PORT : undefined}
			siteName={getSiteName()}
		>
			<ThemeProvider defaultTheme={window.frappe?.boot?.desk_theme ?? 'Automatic'}>
				<TooltipProvider>
					<UserProvider>
						{/* No richColors: toasts use the app's own neutral chip styling
						    (surface-gray-9 + ink-base) with colored status icons. */}
						<Toaster />
						<RouterProvider router={router} />
					</UserProvider>
				</TooltipProvider>
			</ThemeProvider>
		</FrappeProvider>
	)
}

export default App
