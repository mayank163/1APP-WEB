import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaUser, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await adminApi.getUsers();
                if (res.success) {
                    setUsers(res.data.users);
                }
            } catch (err) {
                toast.error('Failed to load users list');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const filteredUsers = [...users]
    .filter((user) => {
        const keyword = searchTerm.toLowerCase();

        return (
            user.name?.toLowerCase().includes(keyword) ||
            user.email?.toLowerCase().includes(keyword) ||
            user.phone?.toLowerCase().includes(keyword) ||
            user._id?.toLowerCase().includes(keyword)
        );
    })
    .sort((a, b) => {
        const first = (a.name || "").toLowerCase();
        const second = (b.name || "").toLowerCase();

        return sortOrder === "asc"
            ? first.localeCompare(second)
            : second.localeCompare(first);
    });

    return (
        <div>
            <div className="mb-4">
                <h1 className="fw-extrabold text-dark mb-1">Customer Accounts</h1>
                <p className="text-muted">Review customer directories, contact numbers, and verification flags.</p>
            </div>

            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">

    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">

        <input
            type="text"
            className="form-control"
            placeholder="Search by name, email, phone or ID..."
            style={{ maxWidth: "400px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
            className="form-select"
            style={{ width: "220px" }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
        >
            <option value="asc">
                Ascending (A-Z)
            </option>

            <option value="desc">
                Descending (Z-A)
            </option>
        </select>

    </div>
                {loading ? (
                    <LoadingSpinner message="Querying customer database..." />
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light border-0">
                                <tr>
                                    <th>Customer ID</th>
                                    <th>Name</th>
                                    <th>Email / Phone</th>
                                    <th>Phone Status</th>
                                    <th>Registered Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user._id}>
                                        <td className="font-monospace text-muted" style={{ fontSize: '0.8rem' }}>{user._id}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="bg-dark-subtle text-dark rounded-circle p-2 d-inline-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                                                    <FaUser size={14} />
                                                </div>
                                                <span className="fw-bold text-dark">{user.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-dark small">{user.email}</div>
                                            <small className="text-muted font-monospace">{user.phone}</small>
                                        </td>
                                        <td>
                                            {user.isPhoneVerified ? (
                                                <span className="badge bg-success-subtle text-success d-flex align-items-center gap-1 py-1 px-2.5" style={{ width: 'fit-content', fontSize: '0.75rem' }}>
                                                    <FaCheckCircle />
                                                    <span>Verified</span>
                                                </span>
                                            ) : (
                                                <span className="badge bg-dark-subtle text-dark d-flex align-items-center gap-1 py-1 px-2.5" style={{ width: 'fit-content', fontSize: '0.75rem' }}>
                                                    <FaExclamationTriangle />
                                                    <span>Unverified</span>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <small className="text-muted">{new Date(user.createdAt).toLocaleDateString()}</small>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5 text-muted">No registered customer users found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
