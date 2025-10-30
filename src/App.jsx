import Dashboard from './Components/Dashboard/Dashboard'
import Login from './Components/Login/Login'
import Register from './Components/Register/Register'
import Home from './Components/Dashboard/Comps/BodySection/Home/home'
import Schedule from './Components/Dashboard/Comps/BodySection/Schedule/schedule'
import Patient from './Components/Dashboard/Comps/BodySection/Patient/Patient'
import Scanner from './Components/Dashboard/Comps/BodySection/Scanner/Scanner'
import Inventory from './Components/Dashboard/Comps/BodySection/Inventory/Inventory'


import './App.css'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '/',
    // element: <Navigate to="/dashboard/home" replace />
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  },
  {
  path: '/dashboard',
  element: <Dashboard />,
  children: [
    { index: true, element: <Navigate to="home" replace /> },
    { path: 'home', element: <Home /> },
    { path: 'schedule', element: <Schedule /> },
    { path: 'patient', element: <Patient /> },
    { path: 'patient/:id', element: <Patient /> }, // ✅ add this
    { path: 'scanner', element: <Scanner /> },
    { path: 'inventory', element: <Inventory /> }
  ]
}

])

function App() {
  return <RouterProvider router={router} />
}

export default App
