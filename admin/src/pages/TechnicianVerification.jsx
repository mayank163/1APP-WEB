import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import socket from '../services/socket';
import '../styles/TechnicianVerification.css';

const DOC_LABELS = {
  profilePhoto: 'Profile Photo',
  drivingLicenseFront: 'DL Front',
  drivingLicenseBack: 'DL Back',
  residentialProof: 'Residential Proof',
  taxInformationW9: 'Tax W9',
  taxInformation1099: 'Tax 1099',
  cvResume: 'CV / Resume',
  backgroundVerification: 'Background Check',
};

const DOC_ICONS = {
  profilePhoto: '🖼️',
  drivingLicenseFront: '🪪',
  drivingLicenseBack: '🪪',
  residentialProof: '🏠',
  taxInformationW9: '📄',
  taxInformation1099: '📄',
  cvResume: '📋',
  backgroundVerification: '🔍',
};

const STATUS_CONFIG = {
  approved: {
    icon: '✓',
    label: 'Approved',
    className: 'tv-status-approved',
  },
  rejected: {
    icon: '✕',
    label: 'Rejected',
    className: 'tv-status-rejected',
  },
  pending: {
    icon: '⏳',
    label: 'Pending',
    className: 'tv-status-pending',
  },
};

const StatusBadge = ({ status }) => {
  const normalizedStatus = status?.toLowerCase();

  const config = STATUS_CONFIG[normalizedStatus] || {
    icon: '•',
    label: status || 'Unknown',
    className: 'tv-status-unknown',
  };

  return (
    <span className={`tv-status-badge ${config.className}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
};

const Avatar = ({ name }) => {
  const initials =
    name
      ?.split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return <div className="tv-avatar">{initials}</div>;
};

const TechnicianVerification = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [expanded, setExpanded] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadRequests = async () => {
    try {
      const res = await adminApi.getTechnicianVerificationRequests();
      setRequests(res.data.requests || []);
    } catch (error) {
      console.error(
        'Failed to load verification requests',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    socket.on(
      'technician:verificationUpdated',
      loadRequests
    );

    return () => {
      socket.off(
        'technician:verificationUpdated',
        loadRequests
      );
    };
  }, []);

  const updateOverallStatus = async (
    technicianId,
    status
  ) => {
    const notes = window.prompt(
      'Add admin note (optional)',
      ''
    );

    if (notes === null) return;

    try {
      await adminApi.updateTechnicianVerificationStatus(
        technicianId,
        {
          status,
          notes,
        }
      );

      await loadRequests();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          'Unable to update verification'
      );
    }
  };

  const approveDocument = async (
    technicianId,
    documentId
  ) => {
    try {
      await adminApi.updateDocumentStatus(
        technicianId,
        documentId,
        {
          status: 'approved',
        }
      );

      await loadRequests();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          'Failed to approve document'
      );
    }
  };

  const openRejectModal = (
    technicianId,
    documentId
  ) => {
    setRejectModal({
      technicianId,
      documentId,
    });

    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please enter a rejection reason');
      return;
    }

    try {
      await adminApi.updateDocumentStatus(
        rejectModal.technicianId,
        rejectModal.documentId,
        {
          status: 'rejected',
          rejectionReason: rejectReason.trim(),
        }
      );

      setRejectModal(null);
      setRejectReason('');

      await loadRequests();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          'Failed to reject document'
      );
    }
  };

  const toggleExpand = (id) => {
    setExpanded((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const filteredRequests = requests.filter((req) => {
    const search = searchTerm.trim().toLowerCase();

    const name = req.name?.toLowerCase() || '';
    const email = req.email?.toLowerCase() || '';
    const phone = req.phone?.toLowerCase() || '';

    const skills = Array.isArray(req.skills)
      ? req.skills
          .map((skill) => String(skill).toLowerCase())
          .join(' ')
      : '';

    const matchesSearch =
      !search ||
      name.includes(search) ||
      email.includes(search) ||
      phone.includes(search) ||
      skills.includes(search);

    const currentStatus =
      req.verificationStatus?.toLowerCase() || 'pending';

    const matchesStatus =
      statusFilter === 'all' ||
      currentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="tv-loading">
        <div className="spinner-border spinner-border-sm text-primary" />
        <span>Loading verification requests...</span>
      </div>
    );
  }

  return (
    <div className="technician-verification">
      {/* PAGE HEADER */}
      <div className="tv-page-header">
        <div className="tv-header-top">
          <div>
            <h4 className="tv-title">
              Technician Verification
            </h4>

            <p className="tv-subtitle">
              {filteredRequests.length} of {requests.length}{' '}
              request
              {requests.length !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
        </div>

        {/* SEARCH + FILTER */}
        <div className="tv-filter-bar">
          <div className="tv-search-wrapper">
            <span className="tv-search-icon">🔎</span>

            <input
              type="text"
              className="tv-search-input"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search technician by name, email, phone or skills..."
            />

            {searchTerm && (
              <button
                type="button"
                className="tv-search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="tv-status-filter">
            <span className="tv-status-label">
              Status:
            </span>

            <select
              className="tv-status-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">
                All Technicians
              </option>
              <option value="approved">
                Approved
              </option>
              <option value="pending">
                Pending
              </option>
              <option value="rejected">
                Rejected
              </option>
            </select>
          </div>

          {(searchTerm || statusFilter !== 'all') && (
            <button
              type="button"
              className="tv-clear-filters"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* NO REQUESTS */}
      {requests.length === 0 && (
        <div className="tv-empty-state">
          <div className="tv-empty-icon">📭</div>

          <div className="tv-empty-title">
            No verification requests found
          </div>

          <p className="tv-empty-text">
            There are currently no technician verification
            requests.
          </p>
        </div>
      )}

      {/* NO FILTER RESULTS */}
      {requests.length > 0 &&
        filteredRequests.length === 0 && (
          <div className="tv-empty-state">
            <div className="tv-empty-icon">🔎</div>

            <div className="tv-empty-title">
              No technicians found
            </div>

            <p className="tv-empty-text">
              Try changing your search or status filter.
            </p>

            <button
              type="button"
              className="tv-empty-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}

      {/* TECHNICIANS */}
      {filteredRequests.length > 0 &&
        filteredRequests.map((req) => {
          const docStatusMap = {};

          (req.documentStatuses || []).forEach((document) => {
            docStatusMap[document.documentId] = document;
          });

          const isOpen = expanded[req._id];

          const docs = Object.entries(
            req.documents || {}
          ).filter(([, value]) => value);

          return (
            <div
              className="tv-technician-card"
              key={req._id}
            >
              {/* TECHNICIAN HEADER */}
              <div
                className={`tv-technician-header ${
                  !isOpen ? 'collapsed' : ''
                }`}
              >
                <Avatar name={req.name} />

                <div className="tv-technician-info">
                  <div className="tv-technician-name">
                    {req.name}
                  </div>

                  <div className="tv-technician-contact">
                    {req.email}
                    <span
                      style={{
                        margin: '0 7px',
                        color: '#d1d5db',
                      }}
                    >
                      •
                    </span>
                    {req.phone}
                  </div>

                  <div className="tv-technician-meta">
                    {req.experienceLevel || 'Experience N/A'}

                    <span style={{ margin: '0 7px' }}>
                      •
                    </span>

                    {req.yearsOfExperience || 0} yrs

                    <span style={{ margin: '0 7px' }}>
                      •
                    </span>

                    {req.skills?.join(', ') ||
                      'No skills added'}
                  </div>
                </div>

                <StatusBadge
                  status={req.verificationStatus}
                />

                <button
                  type="button"
                  className="tv-expand-button"
                  onClick={() => toggleExpand(req._id)}
                  title={
                    isOpen
                      ? 'Collapse'
                      : 'View documents'
                  }
                >
                  {isOpen ? '▲' : '▼'}
                </button>
              </div>

              {/* DETAILS */}
              {isOpen && (
                <div className="tv-details">
                  {/* ADMIN NOTE */}
                  {req.verificationNotes && (
                    <div className="tv-admin-note">
                      📝 <strong>Admin Note:</strong>{' '}
                      {req.verificationNotes}
                    </div>
                  )}

                  {/* DOCUMENT TITLE */}
                  <div className="tv-documents-title-row">
                    <div className="tv-documents-title">
                      Verification Documents
                    </div>

                    <div className="tv-documents-count">
                      {docs.length} document
                      {docs.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* DOCUMENT LIST */}
                  <div className="tv-document-list">
                    {/* HEADER */}
                    <div className="tv-document-header">
                      <div>Document</div>
                      <div>Status</div>
                      <div>Remarks</div>
                      <div>View</div>
                      <div style={{ textAlign: 'right' }}>
                        Actions
                      </div>
                    </div>

                    {/* ROWS */}
                    {docs.map(([key, value]) => {
                      const url = String(value).startsWith(
                        'http'
                      )
                        ? String(value)
                        : `${process.env.REACT_APP_IMAGE_URL}/${value}`;

                      const entry = docStatusMap[key];

                      const docStatus =
                        entry?.status || 'pending';

                      const normalizedDocStatus =
                        docStatus.toLowerCase();

                      return (
                        <div
                          key={key}
                          className={`tv-document-row ${
                            normalizedDocStatus === 'rejected'
                              ? 'rejected'
                              : ''
                          }`}
                        >
                          {/* DOCUMENT */}
                          <div className="tv-document-info">
                            <div className="tv-document-icon">
                              {DOC_ICONS[key] || '📎'}
                            </div>

                            <div className="tv-document-name">
                              {DOC_LABELS[key] || key}
                            </div>
                          </div>

                          {/* STATUS */}
                          <div>
                            <StatusBadge status={docStatus} />
                          </div>

                          {/* REMARKS */}
                          <div
                            className={`tv-document-remarks ${
                              entry?.rejectionReason
                                ? 'rejected'
                                : ''
                            }`}
                          >
                            {entry?.rejectionReason ? (
                              <>
                                ⚠️ {entry.rejectionReason}
                              </>
                            ) : (
                              'No remarks'
                            )}
                          </div>

                          {/* VIEW */}
                          <div>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="tv-view-link"
                            >
                              View ↗
                            </a>
                          </div>

                          {/* ACTIONS */}
                          <div className="tv-document-actions">
                            {normalizedDocStatus !==
                              'approved' && (
                              <button
                                type="button"
                                className="tv-approve-button"
                                onClick={() =>
                                  approveDocument(
                                    req._id,
                                    key
                                  )
                                }
                              >
                                ✓ Approve
                              </button>
                            )}

                            {normalizedDocStatus !==
                              'rejected' && (
                              <button
                                type="button"
                                className="tv-reject-button"
                                onClick={() =>
                                  openRejectModal(
                                    req._id,
                                    key
                                  )
                                }
                              >
                                ✕ Reject
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* OVERALL ACTIONS */}
                  <div className="tv-overall-actions">
                    <div className="tv-overall-description">
                      Review all documents and update the
                      technician verification status.
                    </div>

                    <button
                      type="button"
                      className="tv-overall-approve"
                      onClick={() =>
                        updateOverallStatus(
                          req._id,
                          'approved'
                        )
                      }
                    >
                      ✓ Mark Approved
                    </button>

                    <button
                      type="button"
                      className="tv-overall-reject"
                      onClick={() =>
                        updateOverallStatus(
                          req._id,
                          'rejected'
                        )
                      }
                    >
                      ✕ Mark Rejected
                    </button>

                    <button
                      type="button"
                      className="tv-overall-pending"
                      onClick={() =>
                        updateOverallStatus(
                          req._id,
                          'pending'
                        )
                      }
                    >
                      ⏳ Mark Pending
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="tv-modal-overlay">
          <div className="tv-modal">
            {/* HEADER */}
            <div className="tv-modal-header">
              <span className="tv-modal-title">
                ✕ Reject Document
              </span>

              <button
                type="button"
                className="tv-modal-close"
                onClick={() => setRejectModal(null)}
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="tv-modal-body">
              <label className="tv-modal-label">
                Rejection Reason{' '}
                <span className="tv-required">*</span>
              </label>

              <textarea
                rows={4}
                className="tv-rejection-textarea"
                placeholder="e.g. Image is blurry or document is expired"
                value={rejectReason}
                onChange={(event) =>
                  setRejectReason(event.target.value)
                }
              />
            </div>

            {/* FOOTER */}
            <div className="tv-modal-footer">
              <button
                type="button"
                className="tv-modal-cancel"
                onClick={() => setRejectModal(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="tv-modal-reject"
                onClick={confirmReject}
              >
                Reject Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianVerification;