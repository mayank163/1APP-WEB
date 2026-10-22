import './styles/App.css';
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import JobTemplates from './pages/JobTemplates';
import TechnicianVerification from './pages/TechnicianVerification';
import TechnicianPayouts from './pages/TechnicianPayouts';
import TechnicianOverview from './pages/TechnicianOverview';
import SubAdminManagement from './pages/SubAdminManagement';
import TypeManagement from './pages/TypeManagement';
import TechnicianChat from './pages/TechnicianChat';
import SupportCenter from './pages/SupportCenter';
import socket from './services/socket';
import PlanManagement from './pages/PlanManagement';
import { getAdminNavItems } from './navigation/adminNavigation';

const AdminPrivateRoute = ({ children }) => {
  const { admin, loading } = useAdminAuth();
  if (loading) return <div role="status">Checking session...</div>;
  if (!admin || !localStorage.getItem('1app_admin_token')) return <Navigate to="/login" replace />;
  return children;
};

// Guard a route by RBAC permission
const PermRoute = ({ resource, access = 'read', children }) => {
  const { can, admin } = useAdminAuth();
  if (!admin) return null;
  if (!can(resource, access)) {
    return (
      <div className="admin-app-1" >
        <h5>Access Denied</h5>
        <p>You don't have permission to view this section.</p>
      </div>
    );
  }
  return children;
};

const AdminLanding = () => {
  const { admin, can } = useAdminAuth();
  if (!admin) return null;
  const firstItem = getAdminNavItems(can)[0];
  if (!firstItem) {
    return <div className="admin-app-1"><h5>No sections available</h5><p>Contact your administrator to request access.</p></div>;
  }
  if (firstItem.to !== '/') return <Navigate to={firstItem.to} replace />;
  return <Dashboard />;
};

function AppRoutes() {
  const { can } = useAdminAuth();
  return (
    <HashRouter>
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
          <Route index element={<AdminLanding />} />
          <Route path="support" element={<PermRoute resource="support"><SupportCenter adminMode socket={socket} canWrite={can('support', 'write')} /></PermRoute>} />
          <Route path="bookings" element={<PermRoute resource="bookings" access="read"><BookingManagement /></PermRoute>} />
          <Route path="services" element={<PermRoute resource="services" access="read"><SubcategoryManagement /></PermRoute>} />
          <Route path="categories" element={<PermRoute resource="categories" access="read"><Categories /></PermRoute>} />
          <Route path="subcategories" element={<PermRoute resource="subcategories" access="read"><CategoryManagement /></PermRoute>} />
          <Route path="users" element={<PermRoute resource="users" access="read"><UserManagement /></PermRoute>} />
          <Route path="offers" element={<PermRoute resource="offers" access="read"><OfferManagement /></PermRoute>} />
          <Route path="plans" element={<PermRoute resource="offers" access="read"><PlanManagement /></PermRoute>} />
          <Route path="job-templates" element={<PermRoute resource="technician_jobs" access="read"><JobTemplates /></PermRoute>} />
          <Route path="technician-jobs" element={<PermRoute resource="technician_jobs" access="read"><TechnicianJobs /></PermRoute>} />
          <Route path="technician-payouts" element={<PermRoute resource="technician_jobs" access="read"><TechnicianPayouts /></PermRoute>} />
          <Route path="technician-overview" element={<PermRoute resource="technician_jobs" access="read"><TechnicianOverview /></PermRoute>} />
          <Route path="technician-chat" element={<PermRoute resource="technician_jobs" access="read"><TechnicianChat /></PermRoute>} />
          <Route path="technician-verification" element={<PermRoute resource="technician_verification" access="read"><TechnicianVerification /></PermRoute>} />
          <Route path="blogs" element={<PermRoute resource="blogs" access="read"><BlogManagement /></PermRoute>} />
          <Route path="sub-admins" element={<PermRoute resource="sub_admins" access="read"><SubAdminManagement /></PermRoute>} />
          <Route path="work-types" element={<PermRoute resource="work_types" access="read"><TypeManagement /></PermRoute>} />
          <Route path="service-types" element={<PermRoute resource="service_types" access="read"><TypeManagement /></PermRoute>} />
        </Route>
      </Routes>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </HashRouter>
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
