import '../styles/MainLayout.css';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import { connectAdminSocket } from '../services/socket';
import NotificationBell from '../components/NotificationBell';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
    FaChartBar, FaTasks, FaFolderOpen,
    FaUsers, FaTag, FaSignOutAlt,
    FaLayerGroup, FaBlog, FaHardHat, FaCheckCircle, FaComments,
    FaBars, FaChevronLeft, FaUserShield, FaSitemap, FaCogs, FaGem
} from 'react-icons/fa';

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const headerRef = useRef(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    useLayoutEffect(() => {
        const header = headerRef.current;
        if (!header) return;
        const updateHeight = () => setHeaderHeight(header.getBoundingClientRect().height);
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);
    const { admin, can, clearAdmin } = useAdminAuth();

    React.useEffect(() => {
        connectAdminSocket();
    }, []);

    const handleLogout = () => {
        adminApi.logout();
        clearAdmin();
        navigate('/login');
    };

    const allNavItems = [
        { to: "/", icon: <FaChartBar size={14} />, label: "Dashboard", end: true, resource: 'dashboard' },
        { to: "/bookings", icon: <FaTasks size={14} />, label: "Bookings", resource: 'bookings' },
        { to: "/technician-jobs", icon: <FaHardHat size={14} />, label: "Technician Jobs", resource: 'technician_jobs' },
        { to: "/job-templates", icon: <FaFolderOpen size={14} />, label: "Job Templates", resource: 'technician_jobs' },
        { to: "/work-types", icon: <FaSitemap size={14} />, label: "Work Types", resource: 'work_types' },
        { to: "/service-types", icon: <FaCogs size={14} />, label: "Service Types", resource: 'service_types' },
        { to: can('categories', 'read') ? "/categories" : "/subcategories", icon: <FaLayerGroup size={14} />, label: "Service Management", resources: ['categories', 'subcategories'], activePaths: ['/categories', '/subcategories'] },
        { to: "/services", icon: <FaLayerGroup size={14} />, label: "Services", resource: 'services' },
        { to: "/users", icon: <FaUsers size={14} />, label: "Users", resource: 'users' },
        { to: "/plans", icon: <FaGem size={14} />, label: "Plans", resource: 'offers' },
        { to: "/technician-overview", icon: <FaUsers size={14} />, label: "Technicians", resource: 'technician_jobs' },
        { to: "/technician-verification", icon: <FaCheckCircle size={14} />, label: "Technicians Verification", resource: 'technician_verification' },
        { to: "/support", icon: <FaComments size={14} />, label: "Support Ticket", resource: 'support' },
        { to: "/technician-chat", icon: <FaComments size={14} />, label: "Legacy Chat", resource: 'technician_jobs' },
        { to: "/blogs", icon: <FaBlog size={14} />, label: "Blogs", resource: 'blogs' },
        { to: "/offers", icon: <FaTag size={14} />, label: "Offers & Coupons", resource: 'offers' },
        { to: "/sub-admins", icon: <FaUserShield size={14} />, label: "Sub-Admins", resource: 'sub_admins' },
        
    ];

    // Show nav item if super admin OR has at least read permission
    const navItems = allNavItems.filter(item => item.resources ? item.resources.some(resource => can(resource, 'read')) : can(item.resource, 'read'));

    return (
        <div
            className={["d-flex admin-main-layout-1 ", collapsed ? "admin-main-layout-state-1" : "admin-main-layout-state-2"].join('')}
            style={{ "--admin-header-height": `${headerHeight}px` }}
        >
            {/* Sidebar */}
            <aside
                className="d-flex flex-column admin-main-layout-2"
                
            >
                {/* Logo */}
                <div className={["p-3 d-flex align-items-center gap-2 admin-main-layout-3 ", collapsed ? "admin-main-layout-state-3" : "admin-main-layout-state-4"].join('')} >
                    <div className="admin-main-layout-4" >
                        <FaCheckCircle className="admin-main-layout-5" size={18} />
                    </div>
                    {!collapsed && (
                        <div>
                            <h5 className="fw-bold mb-0 font-monospace admin-main-layout-6" >1APP</h5>
                            <small className="tracking-wider text-uppercase font-monospace fs-8 admin-main-layout-7" >Admin Portal</small>
                        </div>
                    )}
                </div>

                <div className="p-3 flex-grow-1 admin-main-layout-8" >
                    {!collapsed && <p className="text-uppercase fw-bold fs-8 mb-2 px-2 admin-main-layout-9" >Navigation</p>}
                    <ul className="nav nav-pills flex-column gap-1">
                        {navItems.map(({ to, icon, label, end, activePaths }) => (
                            <li key={to} className="nav-item">
                                <NavLink
                                    to={to}
                                    end={end}
                                    title={collapsed ? label : undefined}
                                    className={({ isActive }) =>
                                        `nav-link d-flex align-items-center py-2 px-3 rounded-3 fw-medium admin-sidebar-link ${collapsed ? 'admin-sidebar-link-collapsed' : ''} ${(isActive || activePaths?.includes(location.pathname)) ? 'active-nav-link' : 'inactive-nav-link'}`
                                    }
                                >
                                    {icon}
                                    {!collapsed && <span>{label}</span>}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-3 admin-main-layout-10" >
                    {!collapsed && <div className="admin-sidebar-account">
                        <span className="admin-sidebar-account-avatar" aria-hidden="true">{(admin?.name || 'Admin').charAt(0).toUpperCase()}</span>
                        <div className="admin-sidebar-account-copy">
                            <strong>{admin?.name || 'Admin'}</strong>
                            <small>{admin?.isSuperAdmin ? 'Super Admin' : 'Admin'}</small>
                        </div>
                    </div>}
                    <button
                        onClick={handleLogout}
                        title={collapsed ? "Logout" : undefined}
                        className={["w-100 d-flex align-items-center justify-content-center py-2 rounded-3 fw-bold admin-main-layout-11 ", collapsed ? "admin-main-layout-state-5" : "admin-main-layout-state-6"].join('')}
                        
                    >
                        <FaSignOutAlt />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div
                className="flex-grow-1 d-flex flex-column admin-main-layout-12"
                
            >
                {/* Topbar Header */}
                <header ref={headerRef} className="bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center admin-main-layout-13" >
                    <div className="d-flex align-items-center gap-3">
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            className="admin-main-layout-14" 
                            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {collapsed ? <FaBars size={18} /> : <FaChevronLeft size={18} />}
                        </button>
                        <span className="admin-main-layout-15" >1APP</span>
                        <span className="admin-main-layout-16" >/</span>
                        <h5 className="fw-bold text-dark mb-0 admin-main-layout-17" >Admin Dashboard</h5>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <NotificationBell />
                        <span className="dot bg-success rounded-circle admin-main-layout-18" ></span>
                        <span className="text-muted small fw-medium">{admin?.name || 'Admin'}</span>
                        {admin?.isSuperAdmin && (
                            <span className="admin-main-layout-19" >Super Admin</span>
                        )}
                    </div>
                </header>

                {/* Nested Routes Render */}
                <main
    className="p-4 flex-grow-1 admin-main-layout-20"
    
>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;