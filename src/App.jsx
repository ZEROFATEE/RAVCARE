import Dashboard from './Components/Dashboard/Dashboard'
import Login from './Components/Login/Login'
import Register from './Components/Register/Register'
import Home from './Components/Dashboard/Comps/BodySection/Home/home'
import Schedule from './Components/Dashboard/Comps/BodySection/Schedule/schedule'
import Patient from './Components/Dashboard/Comps/BodySection/Patient/Patient'
import Scanner from './Components/Dashboard/Comps/BodySection/Scanner/Scanner'
import Inventory from './Components/Dashboard/Comps/BodySection/Inventory/Inventory'
import Staff from './Components/Dashboard/Comps/BodySection/Staff/Staff'
import PatientRecDesk from './Components/Dashboard/Comps/BodySection/Patient/PatientRecDesk'
import PatientRecDoctor from './Components/Dashboard/Comps/BodySection/Patient/PatientRecDoctor'

import './App.css'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

// ✅ Role-protected wrapper
function ProtectedRoute({ element, allowedRoles }) {
  const role = localStorage.getItem("userRole");
  if (!role) return <Navigate to="/" replace />; // Not logged in
  if (!allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />; // No access
  return element;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  },
  {
    path: '/unauthorized',
    element: <h1>Unauthorized Access</h1>
  },

  // ✅ Admin & Staff Dashboard
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute
        element={<Dashboard />}
        allowedRoles={['admin', 'staff', 'desk', 'doctor']}
      />
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      { path: 'home', element: <Home /> },
      { path: 'schedule', element: <Schedule /> },
      { path: 'patient', element: <Patient /> },
      { path: 'patient/:id', element: <Patient /> },
      { path: 'scanner', element: <Scanner /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'staff', element: <Staff /> },
      { path: 'patientrecdesk', element: <PatientRecDesk /> },
       { path: 'patientrecdoctor', element: <PatientRecDoctor /> },
    ]
  },

  // ✅ Patient Portal (own dashboard)
  {
    path: '/portal',
    element: (
      <ProtectedRoute
        element={<h1>Welcome to your Patient Portal</h1>}
        allowedRoles={['patient']}
      />
    )
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;