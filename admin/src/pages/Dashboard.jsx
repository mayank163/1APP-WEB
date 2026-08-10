import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { ShimmerStatCards, ShimmerDashboardCharts } from '../components/Shimmer';
import { FaDollarSign, FaUsers, FaTasks, FaCheckCircle, FaHourglassHalf, FaSpinner } from 'react-icons/fa';
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
        return (
            <div>
                <div className="mb-4">
                    <div style={{ width: 280, height: 28, borderRadius: 6, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 37%,#f0f0f0 63%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} className="mb-2" />
                    <div style={{ width: 420, height: 16, borderRadius: 6, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 37%,#f0f0f0 63%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                </div>
                <ShimmerStatCards />
                <ShimmerDashboardCharts />
            </div>
        );
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
                            <div className="rounded p-2" style={{ background: "#fdf5ea", color: "#A5732F" }}><FaDollarSign /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">${totalRevenue.toFixed(2)}</h3>
                        <span className="text-muted small">Cleared paid receipts</span>
                    </div>
                </div>

                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Total Bookings</span>
                            <div className="rounded p-2" style={{ background: "#fdf5ea", color: "#A5732F" }}><FaTasks /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">{totalBookings}</h3>
                        <span className="text-muted small">Orders placed across platform</span>
                    </div>
                </div>

                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Active Customers</span>
                            <div className="rounded p-2" style={{ background: "#fdf5ea", color: "#A5732F" }}><FaUsers /></div>
                        </div>
                        <h3 className="fw-bold text-dark font-monospace mb-1">{totalUsers}</h3>
                        <span className="text-muted small">Registered user accounts</span>
                    </div>
                </div>

                <div className="col-lg-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-muted small fw-bold text-uppercase">Pending Jobs</span>
                            <div className="rounded p-2" style={{ background: "#fdf5ea", color: "#A5732F" }}><FaHourglassHalf /></div>
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
                        <h5 className="fw-bold text-dark mb-4">Weekly Revenue Trend (USD)</h5>
                        <div style={{ width: '100%', height: '300px' }}>
                            <ResponsiveContainer>
                                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#A5732F" stopOpacity={0.35}/>
                                            <stop offset="95%" stopColor="#A5732F" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickMargin={12} />
                                    <YAxis tickLine={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="revenue" stroke="#A5732F" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
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
                                    <span className="dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#A5732F' }}></span>
                                    <span>Pending Order Queue</span>
                                </span>
                                <span className="badge fw-bold font-monospace" style={{ background: "#fdf5ea", color: "#A5732F" }}>{statusCounts.Pending}</span>
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
