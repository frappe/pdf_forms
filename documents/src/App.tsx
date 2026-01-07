import { FrappeProvider } from 'frappe-react-sdk'
import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'
import { UserProvider } from '@/providers/UserProvider'
import { Toaster } from 'sonner'

const router = createBrowserRouter(
	createRoutesFromElements(
	  <>
		<Route path='/login' element={<Navigate to="/" />} />
		<Route path='*' element={<></>} />
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
