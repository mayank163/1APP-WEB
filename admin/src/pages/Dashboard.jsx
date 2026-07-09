import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaRupeeSign, FaUsers, FaTasks, FaCheckCircle, FaHourglassHalf, FaSpinner } from 'react-icons/fa';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await adminApi.getStats();
                if (res.success) {
                    setStats(res.data.stats);
                    setChartData(res.data.chartData);
                }
            } catch (err) {
                console.error('Failed to load stats', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    if (loading) {
        return <LoadingSpinner message="Aggregating dashboard reports..." />;
    }

    const { totalUsers, totalBookings, totalRevenue, statusCounts } = stats || {
        totalUsers: 0,
        totalBookings: 0,
        totalRevenue: 0,
        statusCounts: { Pending: 0, Confirmed: 0, InProgress: 0, Completed: 0, Cancelled: 0 }
    };

    return (
        <div>
            <div className="mb-4">
                <h1 className="fw-extrabold text-dark mb-1">Administrative Overview</h1>
                <p className="text-muted">Real-time statistics, scheduling queue loads, and sales trends.</p>
            </div>

            {/* Stats Cards */}
            <div className="row g-4 mb-5">
                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Total Revenue</span>
                            <div className="bg-success-subtle text-success rounded p-2"><FaRupeeSign /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">₹{totalRevenue.toFixed(2)}</h3>
                        <span className="text-muted small">Cleared paid receipts</span>
                    </div>
                </div>

                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Total Bookings</span>
                            <div className="bg-primary-subtle text-primary rounded p-2"><FaTasks /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">{totalBookings}</h3>
                        <span className="text-muted small">Orders placed across platform</span>
                    </div>
                </div>

                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Active Customers</span>
                            <div className="bg-info-subtle text-info rounded p-2"><FaUsers /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">{totalUsers}</h3>
                        <span className="text-muted small">Registered user accounts</span>
                    </div>
                </div>

                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Pending Jobs</span>
                            <div className="bg-dark-subtle text-dark rounded p-2"><FaHourglassHalf /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">{statusCounts.Pending}</h3>
                        <span className="text-muted small">Awaiting technician assignment</span>
                    </div>
                </div>
            </div>

            {/* Charts & Status details */}
            <div className="row g-4 mb-4">
                {/* Recharts Area Chart */}
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
                        <h5 className="fw-bold text-dark mb-4">Weekly Revenue Trend (INR)</h5>
                        <div style={{ width: '100%', height: '300px' }}>
                            <ResponsiveContainer>
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ffc107" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#ffc107" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} />
                                    <YAxis tickLine={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="revenue" stroke="#ffc107" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (₹)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Job Queue Status List */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
                        <h5 className="fw-bold text-dark mb-4">Job Distribution Queue</h5>
                        <div className="d-flex flex-column gap-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted d-flex align-items-center gap-2">
                                    <span className="dot bg-dark" style={{ width: '10px', height: '10px', borderRadius: '50%' }}></span>
                                    <span>Pending Order Queue</span>
                                </span>
                                <span className="badge bg-dark text-dark fw-bold font-monospace">{statusCounts.Pending}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted d-flex align-items-center gap-2">
                                    <span className="dot bg-info" style={{ width: '10px', height: '10px', borderRadius: '50%' }}></span>
                                    <span>Confirmed Schedule</span>
                                </span>
                                <span className="badge bg-info text-dark fw-bold font-monospace">{statusCounts.Confirmed}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted d-flex align-items-center gap-2">
                                    <span className="dot bg-primary" style={{ width: '10px', height: '10px', borderRadius: '50%' }}></span>
                                    <span>Work In Progress</span>
                                </span>
                                <span className="badge bg-primary text-light fw-bold font-monospace">{statusCounts.InProgress}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted d-flex align-items-center gap-2">
                                    <span className="dot bg-success" style={{ width: '10px', height: '10px', borderRadius: '50%' }}></span>
                                    <span>Completed Audits</span>
                                </span>
                                <span className="badge bg-success text-light fw-bold font-monospace">{statusCounts.Completed}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted d-flex align-items-center gap-2">
                                    <span className="dot bg-danger" style={{ width: '10px', height: '10px', borderRadius: '50%' }}></span>
                                    <span>Cancelled Tickets</span>
                                </span>
                                <span className="badge bg-danger text-light fw-bold font-monospace">{statusCounts.Cancelled}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
