import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import WardenDashboard from './pages/WardenDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Students from './pages/Students'
import Rooms from './pages/Rooms'
import Fees from './pages/Fees'
import Attendance from './pages/Attendance'
import Complaints from './pages/Complaints'
import Staff from './pages/Staff'
import RoomEdit from './pages/RoomEdit'
import ManageCodes from './pages/ManageCodes'

function HomeRouter(){
  const { user } = useAuth()
  if(!user) return <Navigate to="/login" replace />
  if(user.role==='Admin') return <AdminDashboard />
  if(user.role==='Warden') return <WardenDashboard />
  return <StudentDashboard />
}

export default function App(){
  return (
    <AuthProvider>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomeRouter />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/students" element={<ProtectedRoute roles={['Admin','Warden']}><Students/></ProtectedRoute>} />
        <Route path="/rooms" element={<ProtectedRoute roles={['Admin','Warden','Student']}><Rooms/></ProtectedRoute>} />
        <Route path="/rooms/:id/edit" element={<ProtectedRoute roles={['Admin','Warden']}><RoomEdit/></ProtectedRoute>} />
        <Route path="/fees" element={<ProtectedRoute roles={['Admin','Warden']}><Fees/></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute roles={['Admin','Warden']}><Attendance/></ProtectedRoute>} />
        <Route path="/complaints" element={<ProtectedRoute roles={['Admin','Warden','Student']}><Complaints/></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute roles={['Admin']}><Staff/></ProtectedRoute>} />
        <Route path="/codes" element={<ProtectedRoute roles={['Admin']}><ManageCodes/></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
