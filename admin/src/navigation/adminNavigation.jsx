import React from 'react';
import {
    FaChartBar, FaTasks, FaFolderOpen,
    FaUsers, FaTag,
    FaLayerGroup, FaBlog, FaHardHat, FaCheckCircle, FaComments,
    FaUserShield, FaSitemap, FaGem
} from 'react-icons/fa';

// Shared order and permission filtering for the sidebar and landing page.
export const getAdminNavItems = can => {
    const items = [
        { to: "/", icon: <FaChartBar size={14} />, label: "Dashboard", end: true, resource: 'dashboard' },
        { to: "/bookings", icon: <FaTasks size={14} />, label: "Bookings", resource: 'bookings' },
        { to: "/technician-jobs", icon: <FaHardHat size={14} />, label: "Technician Jobs", resource: 'technician_jobs' },
        { to: "/job-templates", icon: <FaFolderOpen size={14} />, label: "Job Templates", resource: 'technician_jobs' },
        { to: can('work_types', 'read') ? "/work-types" : "/service-types", icon: <FaSitemap size={14} />, label: "Work & Service Types", resources: ['work_types', 'service_types'], activePaths: ['/work-types', '/service-types'] },
        { to: can('categories', 'read') ? "/categories" : "/subcategories", icon: <FaLayerGroup size={14} />, label: "Service Management", resources: ['categories', 'subcategories'], activePaths: ['/categories', '/subcategories'] },
        { to: "/services", icon: <FaLayerGroup size={14} />, label: "Services", resource: 'services' },
        { to: "/users", icon: <FaUsers size={14} />, label: "Users", resource: 'users' },
        { to: "/plans", icon: <FaGem size={14} />, label: "Plans", resource: 'offers' },
        { to: "/technician-payouts", icon: <FaUsers size={14} />, label: "Technician Payouts", resource: 'technician_jobs' },
        { to: "/technician-overview", icon: <FaUsers size={14} />, label: "Technicians", resource: 'technician_jobs' },
        { to: "/technician-verification", icon: <FaCheckCircle size={14} />, label: "Technicians Verification", resource: 'technician_verification' },
        { to: "/support", icon: <FaComments size={14} />, label: "Support Ticket", resource: 'support' },
        { to: "/technician-chat", icon: <FaComments size={14} />, label: "Legacy Chat", resource: 'technician_jobs' },
        { to: "/blogs", icon: <FaBlog size={14} />, label: "Blogs", resource: 'blogs' },
        { to: "/offers", icon: <FaTag size={14} />, label: "Offers & Coupons", resource: 'offers' },
        { to: "/sub-admins", icon: <FaUserShield size={14} />, label: "Sub-Admins", resource: 'sub_admins' },
    ];
    return items.filter(item => item.resources
        ? item.resources.some(resource => can(resource, 'read'))
        : can(item.resource, 'read'));
};
