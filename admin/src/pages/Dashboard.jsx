import React, { useCallback, useEffect, useState } from 'react';
import {
    FaBriefcase, FaCheckCircle, FaClipboardCheck, FaFileInvoiceDollar,
    FaMapMarkerAlt, FaRedoAlt, FaTimes, FaTools, FaUserTie
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/Dashboard.css';

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const localDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getRangeDates = (range) => {
    const end = new Date();
    const start = new Date(end);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    if (range === '7day') start.setDate(start.getDate() - 6);
    if (range === '30day') start.setDate(start.getDate() - 29);
    return { startDate: localDateString(start), endDate: localDateString(end) };
};

const Dashboard = () => {
    const { admin } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [technicianJobs, setTechnicianJobs] = useState([]);
    const [jobsUnavailable, setJobsUnavailable] = useState(false);
    const [dateRange, setDateRange] = useState('today');
    const initialDates = getRangeDates('today');
    const [customStart, setCustomStart] = useState(initialDates.startDate);
    const [customEnd, setCustomEnd] = useState(initialDates.endDate);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const selectedDates = dateRange === 'custom'
        ? { startDate: customStart, endDate: customEnd }
        : getRangeDates(dateRange);

    const fetchDashboardData = useCallback(async (isRefresh = false) => {
        if (!selectedDates.startDate || !selectedDates.endDate || selectedDates.startDate > selectedDates.endDate) {
            setLoading(false);
            return;
        }
        if (isRefresh) setRefreshing(true);
        try {
            const startBoundary = new Date(`${selectedDates.startDate}T00:00:00`);
            const endBoundary = new Date(`${selectedDates.endDate}T00:00:00`);
            endBoundary.setDate(endBoundary.getDate() + 1);
            const [statsResult, jobsResult] = await Promise.allSettled([
                adminApi.getStats({ startDate: startBoundary.toISOString(), endDate: endBoundary.toISOString() }),
                adminApi.getTechnicianJobs()
            ]);
            if (statsResult.status === 'fulfilled' && statsResult.value.success) {
                setStats(statsResult.value.data.stats);
            } else {
                console.error('Failed to load booking stats', statsResult.reason);
            }
            if (jobsResult.status === 'fulfilled' && jobsResult.value.success) {
                setTechnicianJobs(jobsResult.value.data.jobs || []);
                setJobsUnavailable(false);
            } else {
                setTechnicianJobs([]);
                setJobsUnavailable(true);
                console.error('Failed to load technician jobs', jobsResult.reason);
            }
        } catch (error) {
            console.error('Failed to load dashboard data', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDates.startDate, selectedDates.endDate]);

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    if (loading) {
        return (
            <div className="dashboard-page dashboard-loading">
                <div className="dashboard-loading-heading shimmer" />
                <div className="dashboard-loading-subheading shimmer" />
                <div className="dashboard-loading-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <div className="dashboard-loading-card shimmer" key={item} />)}
                </div>
            </div>
        );
    }

    const startBoundary = new Date(`${selectedDates.startDate}T00:00:00`);
    const endBoundary = new Date(`${selectedDates.endDate}T00:00:00`);
    endBoundary.setDate(endBoundary.getDate() + 1);
    const periodJobs = technicianJobs.filter((job) => {
        const createdAt = new Date(job.createdAt);
        return createdAt >= startBoundary && createdAt < endBoundary;
    });
    const countJobs = (...statuses) => periodJobs.filter((job) => statuses.includes(String(job.status || '').toLowerCase())).length;
    const totalBookings = stats?.totalBookings || 0;
    const totalRevenue = stats?.totalRevenue || 0;
    const paidBookings = stats?.paidBookings || 0;
    const bookingStatusCounts = stats?.statusCounts || {};
    const name = admin?.name?.split(' ')[0] || 'Admin';
    const recentJobs = [...periodJobs]
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
        .slice(0, 5);
    const bookingStages = [
        { label: 'Pending', tone: 'orange' },
        { label: 'Confirmed', tone: 'blue' },
        { label: 'In Progress', tone: 'purple' },
        { label: 'Completed', tone: 'green' },
        { label: 'Cancelled', tone: 'red' }
    ];

    const jobStages = [
        { label: 'Unassigned', value: countJobs('open'), icon: <FaBriefcase />, tone: 'orange' },
        { label: 'Assigned', value: countJobs('assigned'), icon: <FaUserTie />, tone: 'blue' },
        { label: 'On the Way', value: countJobs('ontheway'), icon: <FaMapMarkerAlt />, tone: 'purple' },
        { label: 'Visited', value: countJobs('visited'), icon: <FaClipboardCheck />, tone: 'amber' },
        { label: 'In Progress', value: countJobs('inprogress', 'in-progress'), icon: <FaTools />, tone: 'green' },
        { label: 'Checkout', value: countJobs('checkout'), icon: <FaFileInvoiceDollar />, tone: 'amber' },
        { label: 'Completed', value: countJobs('completed'), icon: <FaCheckCircle />, tone: 'blue' },
        { label: 'Cancelled', value: countJobs('cancelled'), icon: <FaTimes />, tone: 'red' }
    ];

    return (
        <div className="dashboard-page">
            <div className="dash-breadcrumb"><span>Overview</span><span>/</span><span>Dashboard</span></div>
            <div className="dash-hello-row">
                <div>
                    <h1 className="dash-hello">Hello, {name}! <span aria-label="wave" role="img">👋</span></h1>
                    <p className="dash-title">Global Dashboard</p>
                </div>
                <div className="dash-actions">
                    <div className="dash-filter-group" role="group" aria-label="Date range">
                        {[['today', 'Today'], ['7day', '7D'], ['30day', '30D'], ['custom', 'Custom']].map(([value, label]) =>
                            <button className={`dash-filter-pill ${dateRange === value ? 'active' : ''}`} type="button" key={value} onClick={() => setDateRange(value)}>{label}</button>
                        )}
                    </div>
                    <button className="dash-refresh-btn" type="button" onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                        <FaRedoAlt className={refreshing ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {dateRange === 'custom' && <div className="dash-custom-dates">
                <label>From <input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></label>
                <label>To <input type="date" value={customEnd} min={customStart} onChange={(event) => setCustomEnd(event.target.value)} /></label>
            </div>}

            <section className="jobs-overview-card dashboard-section">
                <div className="dash-section-title"><span>Technician Jobs</span><span className="dash-period-label">{selectedDates.startDate} to {selectedDates.endDate}</span></div>
                {jobsUnavailable && <p className="dashboard-data-error">Technician job data is unavailable for this account.</p>}
                <div className="dashboard-stat-grid job-stage-grid">
                    {jobStages.map((stage) => <StatCard key={stage.label} {...stage} />)}
                </div>
            </section>

            <section className="financial-panel dashboard-section">
                <h2 className="dash-section-title">Bookings and Earnings</h2>
                <div className="booking-summary-grid">
                    <SummaryBox label="Total Bookings" value={totalBookings.toLocaleString()} icon={<FaBriefcase />} tone="blue" />
                    <SummaryBox label="Paid Booking Earnings" value={formatCurrency(totalRevenue)} icon={<FaFileInvoiceDollar />} tone="green" />
                    <SummaryBox label="Paid Bookings" value={paidBookings.toLocaleString()} icon={<FaCheckCircle />} tone="orange" />
                </div>
            </section>

            <section className="dashboard-detail-grid dashboard-section">
                <div className="dashboard-detail-panel">
                    <div className="dash-section-title"><span>Booking Pipeline</span><span className="dash-period-label">{totalBookings.toLocaleString()} bookings</span></div>
                    <div className="booking-pipeline-list">
                        {bookingStages.map(({ label, tone }) => {
                            const count = bookingStatusCounts[label] || 0;
                            const percentage = totalBookings ? Math.round((count / totalBookings) * 100) : 0;
                            return <div className="booking-pipeline-item" key={label}>
                                <div className="booking-pipeline-label"><span>{label}</span><strong>{count.toLocaleString()}</strong></div>
                                <div className="booking-pipeline-track" aria-label={`${label}: ${percentage}%`}>
                                    <span className={`booking-pipeline-fill pipeline-${tone}`} style={{ width: `${percentage}%` }} />
                                </div>
                            </div>;
                        })}
                    </div>
                </div>

                <div className="dashboard-detail-panel">
                    <div className="dash-section-title"><span>Recent Technician Jobs</span><Link className="dashboard-view-link" to="/technician-jobs">View all</Link></div>
                    {jobsUnavailable ? <p className="dashboard-empty-state">Technician job data is unavailable for this account.</p> : recentJobs.length ?
                        <div className="recent-jobs-list">
                            {recentJobs.map((job) => <div className="recent-job-row" key={job._id}>
                                <div className="recent-job-main">
                                    <Link to="/technician-jobs" className="recent-job-title">{job.title || 'Untitled job'}</Link>
                                    <span className="recent-job-meta">{job.category || 'General Service'} · {job.city || job.location || 'Location not set'}</span>
                                </div>
                                <div className="recent-job-side">
                                    <span className={`recent-job-status status-${String(job.status || 'open').toLowerCase().replace(/[^a-z]+/g, '-')}`}>{formatJobStatus(job.status)}</span>
                                    <span className="recent-job-tech">{job.assignedTechnician?.name || 'Unassigned'}</span>
                                </div>
                            </div>)}
                        </div> : <p className="dashboard-empty-state">No technician jobs in this date range.</p>}
                </div>
            </section>
        </div>
    );
};

const StatCard = ({ label, value, icon, tone }) => (
    <div className="dash-card">
        <span className={`card-decor decor-${tone}`} />
        <div className="card-content"><div className={`card-icon icon-${tone}`}>{icon}</div><div className="card-title">{label}</div><div className="card-value">{Number(value || 0).toLocaleString()}</div></div>
    </div>
);

const SummaryBox = ({ label, value, icon, tone }) => <div className="summary-box"><div className="sb-label"><span className={`summary-icon icon-${tone}`}>{icon}</span>{label}</div><div className="sb-value">{value}</div></div>;

const formatJobStatus = (status) => ({
    open: 'Unassigned',
    ontheway: 'On the Way',
    inprogress: 'In Progress',
    'in-progress': 'In Progress'
}[String(status || '').toLowerCase()] || String(status || 'Open').replace(/\b\w/g, (letter) => letter.toUpperCase()));

export default Dashboard;
