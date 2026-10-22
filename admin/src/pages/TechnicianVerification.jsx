import AdminBreadcrumb from '../components/AdminBreadcrumb';
import SummaryFilterCard from '../components/SummaryFilterCard';
import { adminCssValue } from '../utils/adminCssValue.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiMessageCircle,
  FiRefreshCw,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import {
  formatLicenseDate,
  isDrivingLicenseExpired,
} from '../utils/drivingLicenseDates';
import { useAdminAuth } from '../context/AdminAuthContext';
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

const DOC_GROUPS = [
  [
    'Identity Documents',
    [
      'drivingLicenseFront',
      'drivingLicenseBack',
      'residentialProof',
      'backgroundVerification',
    ],
  ],
  ['Professional Documents', ['cvResume']],
  ['Financial Documents', ['taxInformationW9', 'taxInformation1099']],
  ['Others', ['profilePhoto']],
];

const STATUS_LABELS = {
  expired: 'Expired',
  approved: 'Approved',
  rejected: 'Action Required',
  pending: 'Under Review',
  'not-started': 'Pending Review',
};

const statusOf = request => request.verificationStatus?.toLowerCase() || 'pending';
const isLicense = key =>
  key === 'drivingLicenseFront' || key === 'drivingLicenseBack';
const documentStatus = (request, key) =>
  isLicense(key) && isDrivingLicenseExpired(request.drivingLicense?.expiryDate)
    ? 'expired'
    : request.documentStatuses?.find(document => document.documentId === key)
        ?.status?.toLowerCase() || 'pending';
const errorMessage = error =>
  error.response?.data?.message ||
  error.message ||
  'Unable to update verification.';

function Avatar({ name, image }) {
  const initials = (name || '?')
    .split(/\s+/)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="tv-avatar">
      {image ? <img src={image} alt="" /> : initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = status?.toLowerCase() || 'pending';

  return (
    <span className={`tv-status-badge tv-status-${normalized}`}>
      <span>
        {normalized === 'approved' ? (
          <FiCheck />
        ) : normalized === 'rejected' ? (
          <FiX />
        ) : (
          <FiClock />
        )}
      </span>
      {STATUS_LABELS[normalized] || normalized}
    </span>
  );
}

function getDocumentUrl(value) {
  if (!value) return '';
  return String(value).startsWith('http')
    ? value
    : `${process.env.REACT_APP_IMAGE_URL || ''}/${value}`;
}

function DocumentStatus({ request, documentKey }) {
  const status = documentStatus(request, documentKey);

  return (
    <span className={`tv-mini-status tv-mini-${status}`}>
      {status === 'approved' ? (
        <FiCheck />
      ) : ['rejected', 'expired'].includes(status) ? (
        <FiAlertCircle />
      ) : (
        <FiClock />
      )}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function SummaryCard({ icon, label, value, tone, active, onClick }) {
  return (
    <SummaryFilterCard
      active={active}
      onClick={onClick}
      className={`tv-summary-card tv-summary-${tone}`}
    >
      <div className="tv-summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </SummaryFilterCard>
  );
}

function Dashboard({
  requests,
  reviewers,
  onReview,
  onAssignReviewer,
  assigning,
  canWrite,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reviewerFilter, setReviewerFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const filtered = requests.filter(request => {
    const search = searchTerm.trim().toLowerCase();
    const searchable = [
      request.name,
      request.email,
      request.phone,
      request.technicianId,
      ...(request.skills || []),
    ]
      .join(' ')
      .toLowerCase();
    const status = statusOf(request);
    const hasDocuments = Object.values(request.documents || {}).some(Boolean);

    return (
      (!search || searchable.includes(search)) &&
      (statusFilter === 'all' ||
        (statusFilter === 'resubmitted'
          ? request.documentStatuses?.some(
              document => document.status === 'resubmitted',
            )
          : statusFilter === 'expiring'
            ? isDrivingLicenseExpired(request.drivingLicense?.expiryDate) &&
              (request.documents?.drivingLicenseFront ||
                request.documents?.drivingLicenseBack)
            : status === statusFilter)) &&
      (typeFilter === 'all' ||
        (typeFilter === 'documents' ? hasDocuments : !hasDocuments)) &&
      (reviewerFilter === 'all' || request.reviewerId === reviewerFilter) &&
      (!dateFilter ||
        String(request.submittedAt || '').slice(0, 10) === dateFilter)
    );
  });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setReviewerFilter('all');
    setDateFilter('');
  };
  const count = status =>
    requests.filter(request => statusOf(request) === status).length;
  const expiring = requests.filter(
    request =>
      isDrivingLicenseExpired(request.drivingLicense?.expiryDate) &&
      (request.documents?.drivingLicenseFront ||
        request.documents?.drivingLicenseBack),
  ).length;

  return (
    <div className="tv-dashboard">
      <AdminBreadcrumb className="tv-breadcrumb" section="Field Operations" items={[{ label: 'Verification' }]} />

      <div className="tv-dashboard-heading">
        <div>
          <h1>Verification Dashboard</h1>
          <p>
            Review technician documents, manage verification requests, and
            resolve compliance issues.
          </p>
        </div>
        <button
          className="tv-icon-button"
          title="Refresh"
          onClick={() => window.location.reload()}
        >
          <FiRefreshCw />
        </button>
      </div>

      <div className="tv-summary-grid">
        <SummaryCard
          icon={<FiFileText />}
          label="Pending Reviews"
          value={count('pending')}
          tone="pending"
          active={statusFilter === 'pending'}
          onClick={() =>
            setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')
          }
        />
        <SummaryCard
          icon={<FiRefreshCw />}
          label="Resubmissions"
          value={
            requests.filter(request =>
              request.documentStatuses?.some(
                document => document.status === 'resubmitted',
              ),
            ).length
          }
          tone="resubmitted"
          active={statusFilter === 'resubmitted'}
          onClick={() =>
            setStatusFilter(
              statusFilter === 'resubmitted' ? 'all' : 'resubmitted',
            )
          }
        />
        <SummaryCard
          icon={<FiCheck />}
          label="Approved Today"
          value={count('approved')}
          tone="approved"
          active={statusFilter === 'approved'}
          onClick={() =>
            setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')
          }
        />
        <SummaryCard
          icon={<FiX />}
          label="Rejected Today"
          value={count('rejected')}
          tone="rejected"
          active={statusFilter === 'rejected'}
          onClick={() =>
            setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')
          }
        />
        <SummaryCard
          icon={<FiAlertCircle />}
          label="Expired Docs"
          value={expiring}
          tone="expiring"
          active={statusFilter === 'expiring'}
          onClick={() =>
            setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')
          }
        />
      </div>

      <section className="tv-filter-panel">
        <div className="tv-filter-search">
          <FiSearch />
          <input
            aria-label="Search technicians"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search by name, ID..."
          />
        </div>
        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
        >
          <option value="all">Status: All</option>
          <option value="resubmitted">Resubmissions</option>
          <option value="expiring">Expired Docs</option>
          <option value="pending">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Action Required</option>
        </select>
        <select
          aria-label="Document type filter"
          value={typeFilter}
          onChange={event => setTypeFilter(event.target.value)}
        >
          <option value="all">Doc Type: All</option>
          <option value="documents">With Documents</option>
          <option value="empty">No Documents</option>
        </select>
        <select
          aria-label="Reviewer filter"
          value={reviewerFilter}
          onChange={event => setReviewerFilter(event.target.value)}
        >
          <option value="all">Reviewer: All</option>
          {reviewers.map(reviewer => (
            <option key={reviewer._id} value={reviewer._id}>
              {reviewer.name}
            </option>
          ))}
        </select>
        {/* <label className="tv-date-filter">
          <span>Select Submission Date</span>
          <input
            type="date"
            value={dateFilter}
            onChange={event => setDateFilter(event.target.value)}
          />
        </label> */}
        <button className="tv-clear-button" onClick={clearFilters}>
          <FiX /> Clear filters
        </button>
      </section>

      <div className="tv-table-wrap">
        <table className="tv-review-table">
          <thead>
            <tr>
              <th>Technician</th>
              <th>Submission Date</th>
              <th>Documents</th>
              <th>Overall Status</th>
              <th>Reviewer</th>
              <th>Notes by Reviewer</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(request => {
              const docs = Object.entries(request.documents || {}).filter(
                ([, value]) => value,
              );
              const approved = docs.filter(
                ([key]) => documentStatus(request, key) === 'approved',
              ).length;
              const rejected = docs.filter(
                ([key]) => documentStatus(request, key) === 'rejected',
              ).length;

              return (
                <tr key={request._id}>
                  <td>
                    <div className="tv-table-technician">
                      <Avatar
                        name={request.name}
                        image={getDocumentUrl(request.documents?.profilePhoto)}
                      />
                      <div>
                        <strong>{request.name}</strong>
                        <small>
                          {request.technicianId ||
                            `TK-${String(request._id).slice(-6)}`}{' '}
                          • {request.skills?.[0] || 'Technician'}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="tv-date-cell">
                    {new Date(
                      request.submittedAt || Date.now(),
                    ).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    <span className="tv-doc-count">
                      <FiCheck />
                      {approved}
                    </span>
                    {rejected > 0 && (
                      <span className="tv-doc-count tv-doc-rejected">
                        <FiAlertCircle />
                        {rejected}
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={statusOf(request)} />
                  </td>
                  <td>
                    <select
                      className="tv-reviewer-select"
                      aria-label={`Reviewer for ${request.name}`}
                      value={request.reviewerId || ''}
                      disabled={!canWrite || assigning === request._id}
                      onChange={event =>
                        onAssignReviewer(
                          request._id,
                          event.target.value || null,
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {request.reviewerId &&
                        !reviewers.some(
                          reviewer => reviewer._id === request.reviewerId,
                        ) && (
                          <option value={request.reviewerId}>
                            Unavailable reviewer
                          </option>
                        )}
                      {reviewers.map(reviewer => (
                        <option key={reviewer._id} value={reviewer._id}>
                          {reviewer.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="tv-note-cell">
                    {request.verificationNotes || 'Unassigned'}
                  </td>
                  <td>
                    <button
                      className="tv-review-button"
                      onClick={() => onReview(request._id)}
                    >
                      Review <FiArrowRight />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="tv-empty-state">
            <FiSearch />
            <strong>No verification requests found</strong>
            <span>Try changing your filters.</span>
          </div>
        )}
      </div>

      <div className="tv-table-footer">
        <span>
          Showing 1 to {filtered.length} of {requests.length} results
        </span>
        <div className="tv-pagination">
          <button disabled>
            <FiChevronLeft />
          </button>
          <button className="active">1</button>
          <button disabled>
            <FiChevronRight />
          </button>
          <label>
            Rows per page:{' '}
            <select defaultValue="10">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function DocumentReview({ request, requests, onReload }) {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('');
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState(null);
  const docs = useMemo(
    () =>
      Object.entries(request.documents || {}).filter(([, value]) => value),
    [request.documents],
  );
  const selected = selectedKey || docs[0]?.[0] || '';
  const selectedUrl = getDocumentUrl(request.documents?.[selected]);
  const index = requests.findIndex(item => item._id === request._id);
  const hasReviewer = Boolean(request.reviewerId);

  useEffect(() => {
    if (!confirmationStatus) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) {
        setConfirmationStatus(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, confirmationStatus]);

  const saveDocument = async () => {
    if (!selected) return;
    if (reviewStatus === 'rejected' && !reason.trim()) {
      return setError('Add a rejection reason before submitting.');
    }

    setBusy(true);
    setError('');
    try {
      await adminApi.updateDocumentStatus(request._id, selected, {
        status: reviewStatus,
        rejectionReason:
          reviewStatus === 'rejected' ? reason.trim() : null,
      });
      await onReload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const updateOverall = async status => {
    setBusy(true);
    setError('');
    try {
      await adminApi.updateTechnicianVerificationStatus(request._id, {
        status,
        notes: reason.trim(),
      });
      await onReload();
      setConfirmationStatus(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openOverallConfirmation = status => {
    setError('');
    setConfirmationStatus(status);
  };

  const identityDocuments = [
    'drivingLicenseFront',
    'drivingLicenseBack',
    'residentialProof',
  ].filter(key => request.documents?.[key]);
  const professionalDocuments = [
    'cvResume',
    'taxInformationW9',
    'taxInformation1099',
  ].filter(key => request.documents?.[key]);
  const backgroundDocuments = ['backgroundVerification'].filter(
    key => request.documents?.[key],
  );
  const hasBankDetails = Boolean(
    request.bankDetails?.accountHolder &&
      request.bankDetails?.bankName &&
      request.bankDetails?.accountNumber &&
      request.bankDetails?.ifscCode,
  );
  const verificationChecks = [
    {
      label: 'Identity Documents',
      complete:
        identityDocuments.length > 0 &&
        identityDocuments.every(
          key => documentStatus(request, key) === 'approved',
        ),
    },
    {
      label: 'Professional Documents',
      complete:
        professionalDocuments.length > 0 &&
        professionalDocuments.every(
          key => documentStatus(request, key) === 'approved',
        ),
    },
    {
      label: 'Background Verification',
      complete:
        backgroundDocuments.length > 0 &&
        backgroundDocuments.every(
          key => documentStatus(request, key) === 'approved',
        ),
    },
    { label: 'Bank Details', complete: hasBankDetails },
  ];
  const allVerificationChecksComplete = verificationChecks.every(
    ({ complete }) => complete,
  );
  const confirmationCopy = {
    pending: {
      title: `Request action from ${request.name}?`,
      button: 'Request Action',
    },
    rejected: {
      title: `Reject ${request.name} (${request.technicianId || `TECH-${String(request._id).slice(-6)}`})?`,
      button: 'Reject Technician',
    },
    approved: {
      title: `Mark ${request.name} (${request.technicianId || `TECH-${String(request._id).slice(-6)}`}) as Verified?`,
      button: 'Mark as Verified',
    },
  };

  return (
    <div className="tv-review-page">
      <AdminBreadcrumb className="tv-breadcrumb" section="Field Operations" items={[{ label: 'Verification', to: '/technician-verification' }, { label: 'Review Technician' }]} />

      <div className="tv-review-heading">
        <h1>Document Review</h1>
        <div className="tv-review-nav">
          <button
            type="button"
            onClick={() => navigate('/technician-verification')}
          >
            <FiArrowLeft /> Back to Verification
          </button>
          <button
            disabled={index <= 0}
            onClick={() =>
              navigate(
                `/technician-verification?technician=${requests[index - 1]?._id || ''}`,
              )
            }
          >
            <FiArrowLeft /> Previous Technician
          </button>
          <button
            disabled={index < 0 || index === requests.length - 1}
            onClick={() =>
              navigate(
                `/technician-verification?technician=${requests[index + 1]?._id || ''}`,
              )
            }
          >
            Next Technician <FiArrowRight />
          </button>
        </div>
      </div>

      <section className="tv-technician-banner">
        <Avatar
          name={request.name}
          image={getDocumentUrl(request.documents?.profilePhoto)}
        />
        <div>
          <h2>{request.name}</h2>
          <p>
            {request.technicianId ||
              `TECH-${String(request._id).slice(-6)}`}{' '}
            <span>•</span> {request.skills?.[0] || 'Technician'}
          </p>
          <small>{request.serviceArea || 'not available'}</small><p>{request.technicianType || 'Type not provided'} · {request.workAreas?.join(', ') || 'Work areas not provided'}</p>
        </div>
        <div className="tv-banner-divider" />
        <div>
          <b>Overall Verification Status</b>
          <StatusBadge status={statusOf(request)} />
        </div>
        <div className="tv-banner-divider" />
        <div className="tv-progress">
          <b>Verification Progress</b>
          <span>
            {
              docs.filter(
                ([key]) => documentStatus(request, key) === 'approved',
              ).length
            }{' '}
            of {docs.length || 0} required documents approved
          </span>
          <div>
            <i
              className="admin-technician-verification-1"
              style={{
                '--admin-technician-verification-1-width': adminCssValue(
                  `${
                    docs.length
                      ? (docs.filter(
                          ([key]) =>
                            documentStatus(request, key) === 'approved',
                        ).length /
                          docs.length) *
                        100
                      : 0
                  }%`,
                ),
              }}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="tv-alert" role="alert">
          <FiAlertCircle />
          {error}
        </div>
      )}

      <div className="tv-review-grid">
        <aside className="tv-document-sidebar">
          <h3>
            Document List <span>{docs.length} Required</span>
          </h3>
          {DOC_GROUPS.map(([group, keys]) => {
            const groupDocs = keys.filter(key => request.documents?.[key]);
            if (!groupDocs.length) return null;

            return (
              <div className="tv-document-group" key={group}>
                <h4>{group}</h4>
                {groupDocs.map(key => (
                  <button
                    className={selected === key ? 'selected' : ''}
                    key={key}
                    onClick={() => setSelectedKey(key)}
                  >
                    <FiFileText />
                    <span>{DOC_LABELS[key]}</span>
                    <DocumentStatus request={request} documentKey={key} />
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        <main className="tv-document-workspace">
          {/* <div className="tv-preview-toolbar">
            <span>
              <FiSearch /> 100% <FiSearch />
            </span>
            <div>
              <button title="Reset view">
                <FiRefreshCw />
              </button>
              <a
                href={selectedUrl}
                target="_blank"
                rel="noreferrer"
                title="Download"
              >
                <FiDownload />
              </a>
            </div>
          </div> */}

          {isLicense(selected) && (
            <div className="tv-license-details">
              <span>
                <b>Issue Date:</b>{' '}
                {formatLicenseDate(request.drivingLicense?.issuedDate)}
              </span>
              <span>
                <b>Expiry Date:</b>{' '}
                {formatLicenseDate(request.drivingLicense?.expiryDate)}
              </span>
              {isDrivingLicenseExpired(
                request.drivingLicense?.expiryDate,
              ) && (
                <strong className="tv-license-expired" role="status">
                  <FiAlertCircle /> This document is expired
                </strong>
              )}
            </div>
          )}

          <div className="tv-document-preview">
            {selectedUrl ? (
              selectedUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) ? (
                <a
                  className="tv-preview-image-link"
                  href={selectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${DOC_LABELS[selected]} in a new tab`}
                >
                  <img src={selectedUrl} alt={DOC_LABELS[selected]} />
                </a>
              ) : (
                <iframe title={DOC_LABELS[selected]} src={selectedUrl} />
              )
            ) : (
              <div className="tv-preview-empty">
                <FiFileText />
                <span>No document uploaded</span>
              </div>
            )}
          </div>

          <div className="tv-review-panels">
            <section className="tv-action-panel">
              <h3>Review Action</h3>
              {!hasReviewer && (
                <p className="tv-alert" role="status">
                  Assign a reviewer before approving or rejecting documents.
                </p>
              )}
              <div className="tv-action-toggle">
                <button
                  className={
                    reviewStatus === 'approved' ? 'selected approve' : ''
                  }
                  disabled={!hasReviewer || busy}
                  onClick={() => setReviewStatus('approved')}
                >
                  <FiCheck /> Approve
                </button>
                <button
                  className={
                    reviewStatus === 'rejected' ? 'selected reject' : ''
                  }
                  disabled={!hasReviewer || busy}
                  onClick={() => setReviewStatus('rejected')}
                >
                  <FiX /> Reject
                </button>
              </div>
              <label>
                Rejection Reason{' '}
                {reviewStatus === 'rejected' && (
                  <b>(Required if rejecting)</b>
                )}
                <select
                  value={reason}
                  disabled={!hasReviewer || busy}
                  onChange={event => setReason(event.target.value)}
                >
                  <option value="">Select reason</option>
                  <option>Document is blurry or unreadable</option>
                  <option>Document has expired</option>
                  <option>Details do not match technician profile</option>
                  <option>Other</option>
                </select>
              </label>
              <button
                className="tv-submit-button"
                disabled={busy || !hasReviewer}
                onClick={saveDocument}
              >
                {busy ? 'Saving...' : 'Submit Review'}
              </button>
            </section>

            <section className="tv-info-panel">
              <h3>Document &amp; Reviewer Information</h3>
              <dl>
                <dt>Document</dt>
                <dd>{DOC_LABELS[selected] || 'Not selected'}</dd>
                <dt>Uploaded On</dt>
                <dd>
                  {new Date(
                    request.submittedAt || Date.now(),
                  ).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
                {isLicense(selected) && (
                  <>
                    <dt>Issue Date</dt>
                    <dd>
                      {formatLicenseDate(
                        request.drivingLicense?.issuedDate,
                      )}
                    </dd>
                    <dt>Expiry Date</dt>
                    <dd>
                      {formatLicenseDate(
                        request.drivingLicense?.expiryDate,
                      )}
                    </dd>
                  </>
                )}
                <dt>Reviewer</dt>
                <dd>
                  {request.reviewer ||
                    (request.reviewerId
                      ? 'Unavailable reviewer'
                      : 'Unassigned')}
                </dd>
                <dt>Review Notes</dt>
                <dd>{request.verificationNotes || '-'}</dd>
              </dl>
            </section>
          </div>
        </main>
      </div>

      <section className="tv-overall-panel">
        <div>
          <h3>Overall Verification Decision</h3>
          <p>
            <FiMessageCircle /> All mandatory documents must be approved to
            verify the technician.
          </p>
        </div>
        <button
          className="tv-request-button"
          disabled={busy}
          onClick={() => openOverallConfirmation('pending')}
        >
          Request Action
        </button>
        <button
          className="tv-mark-button tv-mark-reject"
          disabled={busy}
          onClick={() => openOverallConfirmation('rejected')}
        >
          <FiX /> Reject Technician
        </button>
        <button
          className="tv-mark-button"
          disabled={busy}
          onClick={() => openOverallConfirmation('approved')}
        >
          <FiCheck /> Mark as Verified
        </button>
      </section>

      {confirmationStatus && (
        <div
          className="tv-confirmation-backdrop"
          onClick={event => {
            if (event.target === event.currentTarget && !busy) {
              setConfirmationStatus(null);
            }
          }}
        >
          <section
            className={`tv-confirmation-dialog tv-confirmation-${confirmationStatus}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tv-confirmation-title"
          >
            <div className="tv-confirmation-icon">
              {confirmationStatus === 'approved' ? (
                <FiCheck />
              ) : confirmationStatus === 'rejected' ? (
                <FiX />
              ) : (
                <FiAlertCircle />
              )}
            </div>
            <h2 id="tv-confirmation-title">
              {confirmationCopy[confirmationStatus].title}
            </h2>
            <ul className="tv-confirmation-checks">
              {verificationChecks.map(({ label, complete }) => (
                <li key={label}>
                  <span className={complete ? 'complete' : 'incomplete'}>
                    {complete ? <FiCheck /> : <FiClock />}
                    {label}
                  </span>
                  <strong className={complete ? 'complete' : 'incomplete'}>
                    {complete ? 'Approved' : 'Pending'}
                  </strong>
                </li>
              ))}
            </ul>
            {confirmationStatus === 'approved' && (
              <p
                className={`tv-confirmation-note${allVerificationChecksComplete ? '' : ' tv-confirmation-note-pending'}`}
              >
                {allVerificationChecksComplete
                  ? 'All required verification checks are complete.'
                  : 'Some required verification checks are still pending.'}
              </p>
            )}
            {error && (
              <p className="tv-confirmation-error" role="alert">
                <FiAlertCircle /> {error}
              </p>
            )}
            <div className="tv-confirmation-actions">
              <button
                type="button"
                className="tv-confirmation-cancel"
                disabled={busy}
                onClick={() => setConfirmationStatus(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tv-confirmation-submit"
                disabled={busy}
                onClick={() => updateOverall(confirmationStatus)}
              >
                {busy ? 'Saving...' : confirmationCopy[confirmationStatus].button}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function TechnicianVerification() {
  const { can } = useAdminAuth();
  const canWrite = can('technician_verification', 'write');
  const [reviewers, setReviewers] = useState([]);
  const [assigning, setAssigning] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedTechnician = searchParams.get('technician');

  const loadRequests = useCallback(async () => {
    try {
      const response = await adminApi.getTechnicianVerificationRequests();
      const data = response.data || response;
      setRequests(data.requests || []);
      setReviewers(data.reviewers || []);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    socket.on('technician:verificationUpdated', loadRequests);
    return () => socket.off('technician:verificationUpdated', loadRequests);
  }, [loadRequests]);

  useEffect(() => {
    if (
      focusedTechnician &&
      !loading &&
      !requests.some(item => item._id === focusedTechnician)
    ) {
      setSearchParams({});
    }
  }, [focusedTechnician, loading, requests, setSearchParams]);

  const assignReviewer = async (id, reviewerId) => {
    setAssigning(id);
    setError('');
    try {
      await adminApi.assignTechnicianReviewer(id, reviewerId);
      await loadRequests();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="tv-loading">
        <div className="spinner-border spinner-border-sm text-primary" />{' '}
        Loading verification requests...
      </div>
    );
  }

  if (error && !requests.length) {
    return (
      <div className="tv-empty-state">
        <FiAlertCircle />
        <strong>{error}</strong>
        <button className="tv-submit-button" onClick={loadRequests}>
          Try again
        </button>
      </div>
    );
  }

  const request = requests.find(item => item._id === focusedTechnician);
  if (focusedTechnician && request) {
    return (
      <DocumentReview
        request={request}
        requests={requests}
        onReload={loadRequests}
      />
    );
  }

  return (
    <>
      {error && (
        <div className="tv-alert" role="alert">
          <FiAlertCircle />
          {error}
        </div>
      )}
      <Dashboard
        requests={requests}
        reviewers={reviewers}
        canWrite={canWrite}
        assigning={assigning}
        onAssignReviewer={assignReviewer}
        onReview={id => setSearchParams({ technician: id })}
      />
    </>
  );
}
