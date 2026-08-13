import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';

// Layout
import MainLayout from './layouts/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BookingManagement from './pages/BookingManagement';
import Categories from './pages/Categories';
import CategoryManagement from './pages/CategoryManagement';
import SubcategoryManagement from './pages/SubcategoryManagement';
import UserManagement from './pages/UserManagement';
import OfferManagement from './pages/OfferManagement';
import BlogManagement from './pages/BlogManagement';
import TechnicianJobs from './pages/TechnicianJobs';
import TechnicianVerification from './pages/TechnicianVerification';
import SubAdminManagement from './pages/SubAdminManagement';

const AdminPrivateRoute = ({ children }) => {
  const token = localStorage.getItem('1app_admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// Guard a route by RBAC permission
const PermRoute = ({ resource, access = 'read', children }) => {
  const { can, admin } = useAdminAuth();
  if (!admin) return null;
  if (!can(resource, access)) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <h5>Access Denied</h5>
        <p>You don't have permission to view this section.</p>
      </div>
    );
  }
  return children;
};

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <AdminPrivateRoute>
              <MainLayout />
            </AdminPrivateRoute>
          }
        >
          <Route index element={<PermRoute resource="dashboard" access="read"><Dashboard /></PermRoute>} />
          <Route path="bookings" element={<PermRoute resource="bookings" access="read"><BookingManagement /></PermRoute>} />
          <Route path="services" element={<PermRoute resource="services" access="read"><SubcategoryManagement /></PermRoute>} />
          <Route path="categories" element={<PermRoute resource="categories" access="read"><Categories /></PermRoute>} />
          <Route path="subcategories" element={<PermRoute resource="subcategories" access="read"><CategoryManagement /></PermRoute>} />
          <Route path="users" element={<PermRoute resource="users" access="read"><UserManagement /></PermRoute>} />
          <Route path="offers" element={<PermRoute resource="offers" access="read"><OfferManagement /></PermRoute>} />
          <Route path="technician-jobs" element={<PermRoute resource="technician_jobs" access="read"><TechnicianJobs /></PermRoute>} />
          <Route path="technician-verification" element={<PermRoute resource="technician_verification" access="read"><TechnicianVerification /></PermRoute>} />
          <Route path="blogs" element={<PermRoute resource="blogs" access="read"><BlogManagement /></PermRoute>} />
          <Route path="sub-admins" element={<PermRoute resource="sub_admins" access="read"><SubAdminManagement /></PermRoute>} />
        </Route>
      </Routes>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </BrowserRouter>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <AppRoutes />
    </AdminAuthProvider>
  );
}

export default App;
