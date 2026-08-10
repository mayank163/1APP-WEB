import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';

const TechnicianVerification = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      const res = await adminApi.getTechnicianVerificationRequests();
      setRequests(res.data.requests || []);
    } catch (error) {
      console.error('Failed to load verification requests', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const updateStatus = async (technicianId, status) => {
    const notes = window.prompt('Add admin note', '');
    try {
      await adminApi.updateTechnicianVerificationStatus(technicianId, { status, notes: notes || '' });
      loadRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to update verification');
    }
  };

  if (loading) return <div className="p-4">Loading technician verification requests...</div>;

  return (
    <div>
      <h3 className="fw-bold mb-3">Technician Verification Requests</h3>

      {requests.length === 0 ? (
        <div className="card p-4">No verification requests found.</div>
      ) : (
        requests.map((request) => (
          <div key={request._id} className="card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="mb-1">{request.name}</h5>
                <div className="text-muted small">{request.email} | {request.phone}</div>
              </div>
              <span className={`badge text-bg-${request.verificationStatus === 'approved' ? 'success' : request.verificationStatus === 'rejected' ? 'danger' : 'warning'}`}>
                {request.verificationStatus}
              </span>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <p><strong>Skills:</strong> {request.skills?.join(', ') || 'N/A'}</p>
                <p><strong>Experience:</strong> {request.experienceLevel} ({request.yearsOfExperience} years)</p>
                <p><strong>Certifications:</strong> {request.certifications?.join(', ') || 'N/A'}</p>
                <p><strong>Bank:</strong> {request.bankDetails?.bankName || 'N/A'} / {request.bankDetails?.accountHolder || 'N/A'}</p>
                {request.verificationNotes && <p><strong>Notes:</strong> {request.verificationNotes}</p>}
              </div>
              <div className="col-md-6">
                <div className="mb-2"><strong>Documents</strong></div>
                <div className="d-flex flex-wrap gap-2">
                  {Object.entries(request.documents || {}).filter(([, value]) => value).map(([key, value]) => (
                    <a key={key} href={value.startsWith('http') ? value : `http://localhost:5001/uploads/${value}`} target="_blank" rel="noreferrer" className="btn btn-outline-dark btn-sm">
                      {key}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 d-flex gap-2">
              <button className="btn btn-success btn-sm" onClick={() => updateStatus(request._id, 'approved')}>Approve</button>
              <button className="btn btn-danger btn-sm" onClick={() => updateStatus(request._id, 'rejected')}>Reject</button>
              <button className="btn btn-warning btn-sm" onClick={() => updateStatus(request._id, 'pending')}>Mark Pending</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TechnicianVerification;
