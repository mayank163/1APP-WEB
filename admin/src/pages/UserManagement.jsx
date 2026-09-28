import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { ShimmerUserTable } from '../components/Shimmer';
import { FaUser, FaCheckCircle, FaExclamationTriangle, FaPowerOff } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Pagination from '../components/Pagination';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [updatingId, setUpdatingId] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await adminApi.getUsers({ search: searchTerm, sort: sortOrder, page, limit: pageSize });
                if (res.success) {
                    setUsers(res.data.users);
                    setPagination(res.pagination || { page, limit: pageSize, total: res.count || 0, totalPages: Math.max(1, Math.ceil((res.count || 0) / pageSize)) });
                }
            } catch (err) {
                toast.error('Failed to load users list');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [searchTerm, sortOrder, page, pageSize]);

    const handleStatusChange = async (user) => {
        const status = user.accountStatus === 'inactive' ? 'active' : 'inactive';
        if (!window.confirm(`${status === 'inactive' ? 'Deactivate' : 'Reactivate'} ${user.name}'s account?`)) return;
        setUpdatingId(user._id);
        try {
            const res = await adminApi.updateUserAccount(user._id, status);
            const updated = res.data?.user;
            setUsers(current => current.map(item => item._id === user._id ? { ...item, ...(updated || {}), accountStatus: status } : item));
            toast.success(`Account ${status}.`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update account status');
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredUsers = users;

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
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />

        <select
            className="form-select"
            style={{ width: "220px" }}
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
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
                    <ShimmerUserTable rows={8} />
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light border-0">
                                <tr>
                                    <th>Customer ID</th>
                                    <th>Name</th>
                                    <th>Email / Phone</th>
                                    <th>Phone Status</th>
                                    <th>Account Status</th>
                                    <th>Registered Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user._id}>
                                        <td className="font-monospace text-muted" style={{ fontSize: '0.8rem' }}>{user._id}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="rounded-circle p-2 d-inline-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', background: '#fdf5ea', color: '#A5732F' }}>
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
                                                <span className="badge d-flex align-items-center gap-1 py-1 px-2.5" style={{ width: 'fit-content', fontSize: '0.75rem', background: '#fdf5ea', color: '#A5732F' }}>
                                                    <FaExclamationTriangle />
                                                    <span>Unverified</span>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${user.accountStatus === 'inactive' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>
                                                {user.accountStatus === 'inactive' ? 'Inactive' : 'Active'}
                                            </span>
                                        </td>
                                        <td>
                                            <small className="text-muted">{new Date(user.createdAt).toLocaleDateString()}</small>
                                        </td>
                                        <td>
                                            <button type="button" className={`btn btn-sm ${user.accountStatus === 'inactive' ? 'btn-outline-success' : 'btn-outline-danger'}`} disabled={updatingId === user._id} onClick={() => handleStatusChange(user)}>
                                                <FaPowerOff className="me-1" />{updatingId === user._id ? 'Saving...' : user.accountStatus === 'inactive' ? 'Activate' : 'Deactivate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">No registered customer users found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && <Pagination {...pagination} page={page} limit={pageSize} onPageChange={setPage} onLimitChange={size => { setPageSize(size); setPage(1); }} />}
            </div>
        </div>
    );
};

export default UserManagement;
//