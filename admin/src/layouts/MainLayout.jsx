import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
    FaChartBar, FaTasks, FaWrench, FaFolderOpen,
    FaUsers, FaTag, FaSignOutAlt, FaTools,
    FaLayerGroup, FaBlog, FaHardHat, FaCheckCircle,
    FaBars, FaChevronLeft, FaUserShield
} from 'react-icons/fa';

const MainLayout = () => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const { admin, can, clearAdmin } = useAdminAuth();

    const handleLogout = () => {
        adminApi.logout();
        clearAdmin();
        navigate('/login');
    };

    const allNavItems = [
        { to: "/", icon: <FaChartBar size={14} />, label: "Dashboard", end: true, resource: 'dashboard' },
        { to: "/bookings", icon: <FaTasks size={14} />, label: "Bookings", resource: 'bookings' },
        { to: "/categories", icon: <FaWrench size={14} />, label: "Categories", resource: 'categories' },
        { to: "/subcategories", icon: <FaFolderOpen size={14} />, label: "Sub-Categories", resource: 'subcategories' },
        { to: "/services", icon: <FaLayerGroup size={14} />, label: "Services", resource: 'services' },
        { to: "/users", icon: <FaUsers size={14} />, label: "Users", resource: 'users' },
        { to: "/offers", icon: <FaTag size={14} />, label: "Offers & Coupons", resource: 'offers' },
        { to: "/technician-jobs", icon: <FaHardHat size={14} />, label: "Technician Jobs", resource: 'technician_jobs' },
        { to: "/technician-verification", icon: <FaCheckCircle size={14} />, label: "Verification", resource: 'technician_verification' },
        { to: "/blogs", icon: <FaBlog size={14} />, label: "Blogs", resource: 'blogs' },
        { to: "/sub-admins", icon: <FaUserShield size={14} />, label: "Sub-Admins", resource: 'sub_admins' },
    ];

    // Show nav item if super admin OR has at least read permission
    const navItems = allNavItems.filter(item => can(item.resource, 'read'));

    return (
        <div
            className="d-flex"
            style={{ height: "100vh", overflow: "hidden", background: "#f8f9fa" }}
        >
            {/* Sidebar */}
            <aside
                className="d-flex flex-column"
                style={{
                    width: collapsed ? "64px" : "260px",
                    flexShrink: 0,
                    transition: "width 0.25s ease",
                    height: "100vh",
                    position: "sticky",
                    top: 0,
                    background: "linear-gradient(180deg, #1a1208 0%, #2d1f0a 100%)",
                    borderRight: "1px solid rgba(165,115,47,0.2)",
                }}
            >
                {/* Logo */}
                <div className="p-3 d-flex align-items-center gap-2" style={{ borderBottom: "1px solid rgba(165,115,47,0.25)", justifyContent: collapsed ? "center" : "flex-start" }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: "rgba(165,115,47,0.2)",
                        border: "1.5px solid rgba(165,115,47,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        <FaTools style={{ color: "#A5732F" }} size={18} />
                    </div>
                    {!collapsed && (
                        <div>
                            <h5 className="fw-bold mb-0 font-monospace" style={{ color: "#fff", letterSpacing: 2 }}>1APP</h5>
                            <small className="tracking-wider text-uppercase font-monospace fs-8" style={{ color: "rgba(165,115,47,0.8)" }}>Admin Portal</small>
                        </div>
                    )}
                </div>

                <div className="p-3 flex-grow-1" style={{ overflowY: "auto" }}>
                    {!collapsed && <p className="text-uppercase fw-bold fs-8 mb-2 px-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Navigation</p>}
                    <ul className="nav nav-pills flex-column gap-1">
                        {navItems.map(({ to, icon, label, end }) => (
                            <li key={to} className="nav-item">
                                <NavLink
                                    to={to}
                                    end={end}
                                    title={collapsed ? label : undefined}
                                    className={({ isActive }) =>
                                        `nav-link d-flex align-items-center py-2 px-3 rounded-3 fw-medium ${isActive ? 'active-nav-link' : 'inactive-nav-link'}`
                                    }
                                    style={({ isActive }) => ({
                                        backgroundColor: isActive ? "#A5732F" : "transparent",
                                        color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                                        transition: "all 0.2s ease",
                                        justifyContent: collapsed ? "center" : "flex-start",
                                        gap: collapsed ? 0 : "0.75rem",
                                    })}
                                >
                                    {icon}
                                    {!collapsed && <span>{label}</span>}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-3" style={{ borderTop: "1px solid rgba(165,115,47,0.25)" }}>
                    <button
                        onClick={handleLogout}
                        title={collapsed ? "Logout" : undefined}
                        className="w-100 d-flex align-items-center justify-content-center py-2 rounded-3 fw-bold"
                        style={{
                            background: "rgba(165,115,47,0.12)",
                            border: "1.5px solid rgba(165,115,47,0.4)",
                            color: "#A5732F",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            gap: collapsed ? 0 : "0.5rem",
                        }}
                    >
                        <FaSignOutAlt />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div
                className="flex-grow-1 d-flex flex-column"
                style={{
                    minWidth: 0,
                    height: "100vh",
                    overflow: "hidden"
                }}
            >
                {/* Topbar Header */}
                <header className="bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center" style={{ borderBottomColor: "#f0e8dc !important" }}>
                    <div className="d-flex align-items-center gap-3">
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "#A5732F", padding: 0, display: "flex", alignItems: "center"
                            }}
                            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {collapsed ? <FaBars size={18} /> : <FaChevronLeft size={18} />}
                        </button>
                        <span style={{ color: "#A5732F", fontWeight: 800, fontSize: "0.85rem", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>1APP</span>
                        <span style={{ color: "#ccc" }}>/</span>
                        <h5 className="fw-bold text-dark mb-0" style={{ fontSize: "0.95rem" }}>Admin Dashboard</h5>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="dot bg-success rounded-circle" style={{ width: '8px', height: '8px' }}></span>
                        <span className="text-muted small fw-medium">{admin?.name || 'Admin'}</span>
                        {admin?.isSuperAdmin && (
                            <span style={{ background: '#fdf6ee', color: '#A5732F', border: '1px solid #f0e8dc', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Super Admin</span>
                        )}
                    </div>
                </header>

                {/* Nested Routes Render */}
                <main
    className="p-4 flex-grow-1"
    style={{
        overflowY: "auto",
        overflowX: "hidden"
    }}
>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;