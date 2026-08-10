import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import {
    FaLayout, FaChartBar, FaTasks, FaWrench, FaFolderOpen,
    FaUsers, FaTag, FaSignOutAlt, FaTools, FaPlus,
    FaList, FaLayerGroup, FaBlog, FaHardHat, FaCheckCircle
} from 'react-icons/fa';

const MainLayout = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        adminApi.logout();
        navigate('/login');
    };

    

    return (
        <div
            className="d-flex"
            style={{ height: "100vh", overflow: "hidden", background: "#f8f9fa" }}
        >
            {/* Sidebar */}
            <aside
                className="d-flex flex-column"
                style={{
                    width: "260px",
                    flexShrink: 0,
                    height: "100vh",
                    position: "sticky",
                    top: 0,
                    background: "linear-gradient(180deg, #1a1208 0%, #2d1f0a 100%)",
                    borderRight: "1px solid rgba(165,115,47,0.2)",
                }}
            >
                {/* Logo */}
                <div className="p-4 d-flex align-items-center gap-2" style={{ borderBottom: "1px solid rgba(165,115,47,0.25)" }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: "rgba(165,115,47,0.2)",
                        border: "1.5px solid rgba(165,115,47,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <FaTools style={{ color: "#A5732F" }} size={18} />
                    </div>
                    <div>
                        <h5 className="fw-bold mb-0 font-monospace" style={{ color: "#fff", letterSpacing: 2 }}>1APP</h5>
                        <small className="tracking-wider text-uppercase font-monospace fs-8" style={{ color: "rgba(165,115,47,0.8)" }}>Admin Portal</small>
                    </div>
                </div>

                <div className="p-3 flex-grow-1" style={{ overflowY: "auto" }}>
                    <p className="text-uppercase fw-bold fs-8 mb-2 px-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Navigation</p>
                    <ul className="nav nav-pills flex-column gap-1">
                        {[
                            { to: "/", icon: <FaChartBar size={14} />, label: "Dashboard", end: true },
                            { to: "/bookings", icon: <FaTasks size={14} />, label: "Bookings" },
                            { to: "/categories", icon: <FaWrench size={14} />, label: "Categories" },
                            { to: "/subcategories", icon: <FaFolderOpen size={14} />, label: "Sub-Categories" },
                            { to: "/services", icon: <FaLayerGroup size={14} />, label: "Services" },
                            { to: "/users", icon: <FaUsers size={14} />, label: "Users" },
                            { to: "/offers", icon: <FaTag size={14} />, label: "Offers & Coupons" },
                            { to: "/technician-jobs", icon: <FaHardHat size={14} />, label: "Technician Jobs" },
                            { to: "/technician-verification", icon: <FaCheckCircle size={14} />, label: "Verification" },
                            { to: "/blogs", icon: <FaBlog size={14} />, label: "Blogs" },
                        ].map(({ to, icon, label, end }) => (
                            <li key={to} className="nav-item">
                                <NavLink
                                    to={to}
                                    end={end}
                                    className={({ isActive }) =>
                                        `nav-link d-flex align-items-center gap-3 py-2 px-3 rounded-3 fw-medium ${isActive ? 'active-nav-link' : 'inactive-nav-link'}`
                                    }
                                    style={({ isActive }) => ({
                                        backgroundColor: isActive ? "#A5732F" : "transparent",
                                        color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                                        transition: "all 0.2s ease",
                                    })}
                                >
                                    {icon}
                                    <span>{label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-3" style={{ borderTop: "1px solid rgba(165,115,47,0.25)" }}>
                    <button
                        onClick={handleLogout}
                        className="w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 fw-bold"
                        style={{
                            background: "rgba(165,115,47,0.12)",
                            border: "1.5px solid rgba(165,115,47,0.4)",
                            color: "#A5732F",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                        }}
                    >
                        <FaSignOutAlt />
                        <span>Logout</span>
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
                    <div className="d-flex align-items-center gap-2">
                        <span style={{ color: "#A5732F", fontWeight: 800, fontSize: "0.85rem", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>1APP</span>
                        <span style={{ color: "#ccc" }}>/</span>
                        <h5 className="fw-bold text-dark mb-0" style={{ fontSize: "0.95rem" }}>Admin Dashboard</h5>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="dot bg-success rounded-circle" style={{ width: '8px', height: '8px' }}></span>
                        <span className="text-muted small fw-medium">Active</span>
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