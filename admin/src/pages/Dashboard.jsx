import React, { useEffect, useState } from 'react';
import {
    FaArrowDown, FaArrowUp, FaBriefcase, FaCheck, FaCheckCircle, FaChevronDown,
    FaClock, FaExclamationTriangle, FaHourglassHalf, FaMoneyBillWave,
    FaReceipt, FaRedoAlt, FaTimes, FaTools, FaUsers, FaUserTie
} from 'react-icons/fa';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/Dashboard.css';

const fallbackStats = {
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    statusCounts: { Pending: 0, Confirmed: 0, InProgress: 0, Completed: 0, Cancelled: 0 }
};

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;

const Dashboard = () => {
    const { admin } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const response = await adminApi.getStats();
            if (response.success) {
                setStats(response.data.stats);
                setChartData(response.data.chartData || []);
            }
        } catch (error) {
            console.error('Failed to load stats', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchDashboardData(); }, []);

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

    const { totalUsers, totalBookings, totalRevenue, statusCounts } = { ...fallbackStats, ...stats, statusCounts: { ...fallbackStats.statusCounts, ...(stats?.statusCounts || {}) } };
    const activeJobs = statusCounts.Confirmed + statusCounts.InProgress;
    const pendingJobs = statusCounts.Pending;
    const completedJobs = statusCounts.Completed;
    const failedJobs = statusCounts.Cancelled;
    const weeklyRevenue = chartData.reduce((sum, day) => sum + Number(day.revenue || 0), 0);
    const name = admin?.name?.split(' ')[0] || 'Admin';

    const topStats = [
        { label: 'Jobs Today', value: totalBookings, icon: <FaBriefcase />, tone: 'purple', change: '12.5%', direction: 'up' },
        { label: 'Active Jobs', value: activeJobs, icon: <FaTools />, tone: 'green', change: '8.6%', direction: 'up' },
        { label: 'Pending Review', value: pendingJobs, icon: <FaUserTie />, tone: 'orange', change: '6.3%', direction: 'down' },
        { label: 'Cancelled Jobs', value: failedJobs, icon: <FaReceipt />, tone: 'red', change: '2.1%', direction: 'up' }
    ];

    const operationalStats = [
        { label: 'Registered Users', value: totalUsers, icon: <FaUsers />, tone: 'blue', change: '9.4%' },
        { label: 'Unassigned Jobs', value: pendingJobs, icon: <FaBriefcase />, tone: 'amber', change: '11.2%' },
        { label: 'Jobs In Progress', value: statusCounts.InProgress, icon: <FaHourglassHalf />, tone: 'red', change: '3.7%' },
        { label: 'Completed Jobs', value: completedJobs, icon: <FaCheckCircle />, tone: 'blue', change: '4.3%' }
    ];

    const funnel = [
        ['Pending', statusCounts.Pending, 'pending', <FaClock />],
        ['Confirmed', statusCounts.Confirmed, 'confirmed', <FaCheck />],
        ['In Progress', statusCounts.InProgress, 'progress', <FaTools />],
        ['Completed', statusCounts.Completed, 'completed', <FaCheckCircle />],
        ['Cancelled', statusCounts.Cancelled, 'cancelled', <FaTimes />]
    ];

    const attentionItems = [
        ['Unassigned Jobs', pendingJobs, <FaBriefcase />, 'orange'],
        ['Jobs In Progress', statusCounts.InProgress, <FaClock />, 'red'],
        ['Cancelled Jobs', failedJobs, <FaReceipt />, 'red'],
        ['Pending Review', pendingJobs, <FaUserTie />, 'amber'],
        ['Bookings To Complete', Math.max(totalBookings - completedJobs - failedJobs, 0), <FaHourglassHalf />, 'blue']
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
                        <button className="dash-filter-pill active" type="button">Today</button>
                        <button className="dash-filter-pill" type="button">7D</button>
                        <button className="dash-filter-pill" type="button">30D</button>
                        <button className="dash-filter-pill" type="button">Custom</button>
                    </div>
                    <button className="dash-refresh-btn" type="button" onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                        <FaRedoAlt className={refreshing ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="dashboard-stat-grid">
                {topStats.map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>

            <section className="dashboard-section operational-section">
                <h2 className="dash-section-title">Operational Analysis</h2>
                <div className="dashboard-stat-grid operational-grid">
                    {operationalStats.map((stat) => <StatCard key={stat.label} {...stat} compact />)}
                </div>
            </section>

            <section className="jobs-overview-card dashboard-section">
                <div className="dash-section-title"><span>Jobs Overview</span><button className="dash-select" type="button">This Week <FaChevronDown /></button></div>
                <div className="jobs-funnel-row">
                    {funnel.map(([label, value, tone, icon]) => <div className={`jobs-funnel-step funnel-${tone}`} key={label}>
                        <span className="step-icon">{icon}</span><div className="step-label">{label}</div><div className="step-value">{value}</div>
                    </div>)}
                </div>
            </section>

            <div className="dashboard-lower-grid">
                <section className="financial-panel dashboard-section">
                    <h2 className="dash-section-title">Financial Summary</h2>
                    <div className="summary-box-row">
                        <SummaryBox label="Today's Revenue" value={formatCurrency(totalRevenue)} icon={<FaMoneyBillWave />} tone="orange" />
                        <SummaryBox label="Weekly Revenue" value={formatCurrency(weeklyRevenue)} icon={<FaReceipt />} tone="green" />
                        <SummaryBox label="Pending Earnings" value={formatCurrency(totalRevenue * 0.16)} icon={<FaClock />} tone="amber" />
                        <SummaryBox label="Completed Value" value={formatCurrency(totalRevenue * (completedJobs / Math.max(totalBookings, 1)))} icon={<FaCheckCircle />} tone="blue" />
                    </div>
                </section>
                <div className="earnings-col">
                    <EarningsCard title="Today's Earnings" value={totalRevenue} label="Today" />
                    <EarningsCard title="Total Earnings" value={weeklyRevenue} label="This Week" />
                </div>
            </div>

            <section className="attention-card">
                <div className="at-title"><FaExclamationTriangle /> Attention Required</div>
                {attentionItems.map(([label, count, icon, tone]) => <div className="attention-row" key={label}>
                    <span className={`at-icon attention-${tone}`}>{icon}</span><span className="at-label">{label}</span><span className="at-badge">{count}</span>
                </div>)}
            </section>
        </div>
    );
};

const StatCard = ({ label, value, icon, tone, change, direction = 'up', compact }) => (
    <div className={`dash-card ${compact ? 'dash-card-compact' : ''}`}>
        <span className={`card-decor decor-${tone}`} />
        <div className="card-content"><div className={`card-icon icon-${tone}`}>{icon}</div><div className="card-title">{label}</div><div className="card-value">{Number(value || 0).toLocaleString()}</div>
            {change && <div className={`card-change ${direction === 'down' ? 'down' : 'up'}`}><span>{direction === 'down' ? <FaArrowDown /> : <FaArrowUp />} {change}</span><span className="vs">vs yesterday</span></div>}
        </div>
    </div>
);

const SummaryBox = ({ label, value, icon, tone }) => <div className="summary-box"><div className="sb-label"><span className={`summary-icon icon-${tone}`}>{icon}</span>{label}</div><div className="sb-value">{value}</div></div>;

const EarningsCard = ({ title, value, label }) => <div className="earnings-card"><div className="ec-header"><span className="ec-title">{title}</span><span className="ec-pill">{label} <FaChevronDown /></span></div><div className="ec-row"><span>Gross Earnings</span><span className="ec-val">{formatCurrency(value)}</span></div><div className="ec-row dim"><span>Platform Fee</span><span className="ec-val">{formatCurrency(value * 0.08)}</span></div><div className="ec-row"><span>Net Earnings</span><span className="ec-val ec-positive">{formatCurrency(value * 0.92)}</span></div></div>;

export default Dashboard;
