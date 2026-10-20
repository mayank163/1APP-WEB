import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Modal, Alert } from 'react-bootstrap';
import {
  FiDownload,
  FiSearch,
  FiRotateCcw,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiCheck,
} from 'react-icons/fi';
import '../styles/TechnicianPayouts.css';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    value
  );
const actions = {
  pending: [
    ['approve', 'Approve'],
    ['reject', 'Reject'],
  ],
  approved: [
    ['mark-sent', 'Record payment sent'],
    ['cancel', 'Cancel'],
  ],
  sent: [
    ['mark-paid', 'Confirm paid'],
    ['mark-failed', 'Record failed / returned'],
  ],
};
export default function TechnicianPayouts() {
  const { can } = useAdminAuth();
  const canWrite = can('technician_jobs', 'write');
  const [payoutMode, setPayoutMode] = useState('manual');
  const [rows, setRows] = useState([]),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null),
    [reason, setReason] = useState(''),
    [reference, setReference] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [bank, setBank] = useState(null);
  const [selected, setSelected] = useState(null),
    [detailTab, setDetailTab] = useState('Overview');
  const [search, setSearch] = useState(''),
    [method, setMethod] = useState(''),
    [date, setDate] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getWithdrawals({ status, page });
      setRows(result.data.withdrawals);
      setPayoutMode(result.data.payoutMode || 'manual');
      setTotal(result.data.pagination.total);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load payouts.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);
  useEffect(() => {
    load();
  }, [load]);
  const open = (row, action, label) => {
    setReason('');
    setReference('');
    setConfirmed(false);
    setError('');
    setDialog({ row, action, label });
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (dialog.action === 'link-recipient') {
        await adminApi.linkPayoutRecipient(dialog.row.technician._id, {
          userToken: reason.trim(),
          bankToken: reference.trim(),
        });
      } else
        await adminApi.updateWithdrawal(dialog.row._id, dialog.action, {
          reason,
          transferReference: reference,
          fundsReturnedConfirmed: confirmed,
          paymentCompletedConfirmed: confirmed,
        });
      setDialog(null);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not update payout.');
    } finally {
      setBusy(false);
    }
  };
  const reveal = async (row) => {
    setBusy(true);
    setError('');
    try {
      const result = await adminApi.getWithdrawalBank(row._id);
      setBank(result.data.bank);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load bank destination.');
    } finally {
      setBusy(false);
    }
  };
  const amount = (row) =>
    money(row.amountCents !== undefined ? row.amountCents / 100 : row.amount);
  const stamp = (value) =>
    value
      ? new Date(value).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '—';
  const transaction = (row) => `TRX-${row._id.slice(-8).toUpperCase()}`;
  const visible = rows.filter((row) => {
    const now = new Date(),
      requested = new Date(row.createdAt);
    return (
      (!search ||
        [
          transaction(row),
          row.technician?.name,
          row.technician?.technicianId,
        ].some((value) =>
          value?.toLowerCase().includes(search.toLowerCase())
        )) &&
      (!method || row.method === method) &&
      (!date ||
        (requested.getMonth() === now.getMonth() &&
          requested.getFullYear() === now.getFullYear()))
    );
  });
  const exportRows = () => {
    const values = [
      ['Transaction', 'Technician', 'Bank', 'Amount', 'Requested on', 'Status'],
      ...visible.map((row) => [
        transaction(row),
        row.technician?.name,
        row.bankSnapshot?.bankName,
        amount(row),
        stamp(row.createdAt),
        row.status,
      ]),
    ];
    const blob = new Blob(
      [
        '\uFEFF' +
          values
            .map((row) =>
              row
                .map(
                  (value) =>
                    '"' +
                    String(value ?? '')
                      .replace(/"/g, '""')
                      .replace(/^[=+@-]/, "'$&") +
                    '"'
                )
                .join(',')
            )
            .join('\r\n'),
      ],
      { type: 'text/csv;charset=utf-8;' }
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'technician-payouts.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const rowActions = (row) =>
    row.payout?.provider
      ? ['processing', 'paid'].includes(row.status)
        ? [
            ['reconcile', 'Refresh Provider Status'],
            ...(['FAILED', 'RETURNED', 'CANCELLED', 'EXPIRED'].includes(
              row.payout.providerStatus
            )
              ? [['confirm-returned', 'Confirm returned funds']]
              : []),
          ]
        : []
      : actions[row.status] || [];
  const fields = (entries) => (
    <dl className="payout-fields">
      {entries.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value ?? '—'}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
  const copy = (value) =>
    navigator.clipboard
      ?.writeText(value)
      .catch(() => setError('Could not copy to clipboard.'));
  return (
    <div className="technician-payouts">
      <header className="payout-heading">
        <div>
          <h2>Technician Payouts</h2>
          <p>
            Manage technician payout requests, review bank details and
            transaction status.
          </p>
        </div>
        <button
          className="payout-primary"
          onClick={exportRows}
          disabled={!visible.length}
        >
          <FiDownload /> Export
        </button>
      </header>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {payoutMode !== 'manual' && (
        <div className="payout-mode">
          {payoutMode === 'hyperwallet-mock'
            ? 'Simulation · No money is sent'
            : 'Hyperwallet sandbox · Test payments only'}
        </div>
      )}
      <nav className="payout-tabs" aria-label="Payout categories">
        {[
          ['', 'Earnings Ledger'],
          ['pending', 'Pending Earnings'],
          ['rejected', 'Rejected'],
          ['cancelled', 'Cancelled'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`${status === value ? 'active' : ''} ${value === 'rejected' ? 'rejected' : ''}`}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {label}
            {status === value && <span>{total}</span>}
          </button>
        ))}
      </nav>
      <div className="payout-filters">
        {/* <span
          className="payout-filter-static"
          title="Tier information is not available for withdrawal requests"
        >
          Tech Tier: All Levels
        </span> */}
        <label className="payout-search">
          <input
            aria-label="Search current page"
            placeholder="Filter by TXN or Tech Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FiSearch />
        </label>
        <select
          aria-label="Earning state"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Earning State: All</option>
          {[
            'pending',
            'approved',
            'processing',
            'sent',
            'paid',
            'rejected',
            'cancelled',
            'failed',
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {/* <select
          aria-label="Payment type"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="">Type: All Types</option>
          <option value="bank-transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="wallet">Wallet</option>
        </select> */}
        <select
          aria-label="Payout date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        >
          <option value="">Date: All Dates</option>
          <option value="month">Date: This Month</option>
        </select>
        <button
          className="payout-reset"
          onClick={() => {
            setSearch('');
            setMethod('');
            setDate('');
            setStatus('');
            setPage(1);
          }}
        >
          <FiRotateCcw /> Reset
        </button>
      </div>
      <section className="payout-ledger">
        <div className="payout-ledger-heading">
          <div>
            <h3>Latest earning transactions</h3>
            <p>Most recent ledger activity</p>
          </div>
          <button
            onClick={() => {
              setStatus('');
              setSearch('');
              setMethod('');
              setDate('');
              setPage(1);
            }}
          >
            View full ledger →
          </button>
        </div>
        <div className="payout-table-wrap">
          <table className="payout-table">
            <thead>
              <tr>
                {[
                  'Transaction',
                  'Technician',
                  'Job',
                  'Account Details',
                  'Amount',
                  'Requested On',
                  'Status',
                  'Action',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row._id}>
                  <td className="payout-bold">{transaction(row)}</td>
                  <td>{row.technician?.name || 'Deleted technician'}</td>
                  <td className="payout-job">—</td>
                  <td className="payout-bold">
                    {row.bankSnapshot?.bankName || 'Unavailable'}
                    <br />
                    {row.bankSnapshot?.last4
                      ? `xxxx-xxxx-${row.bankSnapshot.last4}`
                      : '—'}
                  </td>
                  <td className="payout-bold">{amount(row)}</td>
                  <td>{stamp(row.createdAt)}</td>
                  <td>
                    <span className={`payout-status ${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="payout-view"
                      onClick={() => {
                        setSelected(row);
                        setDetailTab('Overview');
                        setBank(null);
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={8} className="payout-empty">
                    {loading ? 'Loading payouts…' : 'No payout requests found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="payout-pagination">
          <span>
            {total
              ? `Showing ${visible.length} of ${total} transactions · Page ${page}`
              : '0 transactions'}
            {(search || method || date) && ' · Filters apply to current page'}
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              <FiChevronLeft />
            </button>
            {Array.from(
              { length: Math.min(3, Math.ceil(total / 20)) },
              (_, i) =>
                Math.max(1, Math.min(page - 1, Math.ceil(total / 20) - 2)) + i
            ).map((number) => (
              <button
                key={number}
                className={page === number ? 'active' : ''}
                disabled={loading}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}
            <button
              aria-label="Next page"
              disabled={page * 20 >= total || loading}
              onClick={() => setPage(page + 1)}
            >
              <FiChevronRight />
            </button>
          </div>
        </footer>
      </section>
      <Modal
        show={!!selected && !dialog && !bank}
        onHide={() => setSelected(null)}
        dialogClassName="payout-detail-modal"
        contentClassName="payout-detail-content"
      >
        <Modal.Header closeButton>
          <Modal.Title>Payout Details</Modal.Title>
        </Modal.Header>
        {selected && (
          <>
            <Modal.Body>
              <div className="payout-person">
                <div className="payout-avatar">
                  {selected.technician?.name
                    ?.split(' ')
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join('') || '?'}
                </div>
                <div>
                  <div className="payout-person-name">
                    {selected.technician?.name || 'Deleted technician'}{' '}
                    <small>ID {selected.technician?.technicianId || '—'}</small>
                  </div>
                  <p>
                    {selected.technician?.email || '—'} <span>•</span>{' '}
                    {selected.technician?.phone || '—'}
                  </p>
                </div>
              </div>
              <nav className="payout-detail-tabs">
                {['Overview', 'Bank Details', 'Timeline'].map((tab) => (
                  <button
                    key={tab}
                    className={detailTab === tab ? 'active' : ''}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
              {detailTab === 'Overview' && (
                <>
                  <div className="payout-overview-card">
                    <div className="payout-amount">
                      <div>
                        <small>Payout Amount</small>
                        <strong>{amount(selected)}</strong>
                      </div>
                      <div>
                        <span className={`payout-status ${selected.status}`}>
                          • {selected.status}
                        </span>
                        {selected.paidAt && (
                          <small>Completed on {stamp(selected.paidAt)}</small>
                        )}
                      </div>
                    </div>
                    {fields([
                      ['Requested On', stamp(selected.createdAt)],
                      [
                        'Payment Method',
                        selected.payout?.provider || selected.method,
                      ],
                      [
                        'Reference ID',
                        selected.payout?.paymentToken ||
                        selected.transferReference ? (
                          <span className="payout-reference">
                            {selected.payout?.paymentToken ||
                              selected.transferReference}
                            <button
                              aria-label="Copy reference ID"
                              onClick={() =>
                                copy(
                                  selected.payout?.paymentToken ||
                                    selected.transferReference
                                )
                              }
                            >
                              <FiCopy />
                            </button>
                          </span>
                        ) : (
                          '—'
                        ),
                      ],
                      [
                        'Transaction ID',
                        <span className="payout-reference">
                          {transaction(selected)}
                          <button
                            aria-label="Copy transaction ID"
                            onClick={() => copy(selected._id)}
                          >
                            <FiCopy />
                          </button>
                        </span>,
                      ],
                    ])}
                    {selected.status === 'paid' && (
                      <div className="payout-success">
                        <FiCheck />
                        <div>
                          <strong>Payout successful</strong>
                          <small>
                            The amount has been marked as paid in the system.
                          </small>
                        </div>
                      </div>
                    )}
                    {(selected.rejectionReason ||
                      selected.failureReason ||
                      selected.payout?.lastError) && (
                      <Alert variant="warning">
                        {selected.rejectionReason ||
                          selected.failureReason ||
                          selected.payout.lastError}
                      </Alert>
                    )}
                  </div>
                  {/* <h4 className="payout-section-title">
                    Technician Information
                  </h4>
                  {fields([
                    ['Name', selected.technician?.name],
                    ['Technician ID', selected.technician?.technicianId],
                    ['Email', selected.technician?.email],
                    ['Phone', selected.technician?.phone],
                    ['Total Earnings (Lifetime)', '—'],
                    ['Completed Jobs', '—'],
                    ['Rating', '—'],
                  ])}
                  <h4 className="payout-section-title">
                    Job / Earnings Summary
                  </h4>
                  {fields([
                    ['Related Jobs', '—'],
                    ['Earning Period', '—'],
                    ['Service Type', '—'],
                    ['Platform Fee (if any)', '—'],
                    ['Net Payable', <strong>{amount(selected)}</strong>],
                  ])} */}
                </>
              )}
              {detailTab === 'Bank Details' && (
                <>
                  <h4 className="payout-section-title">
                    Registered payout destination
                  </h4>
                  {fields([
                    ['Account Holder', selected.bankSnapshot?.accountHolder],
                    ['Bank Name', selected.bankSnapshot?.bankName],
                    ['Account Type', selected.bankSnapshot?.accountType],
                    [
                      'Account Number',
                      selected.bankSnapshot?.last4
                        ? `xxxx-xxxx-${selected.bankSnapshot.last4}`
                        : '—',
                    ],
                  ])}
                  {canWrite &&
                    selected.bankSnapshot?.last4 &&
                    ['pending', 'approved'].includes(selected.status) && (
                      <button
                        className="payout-primary"
                        disabled={busy}
                        onClick={() => reveal(selected)}
                      >
                        View bank details
                      </button>
                    )}
                </>
              )}
              {detailTab === 'Timeline' && (
                <ol className="payout-timeline">
                  {(selected.auditHistory?.length
                    ? selected.auditHistory
                    : [{ action: 'requested', at: selected.createdAt }]
                  ).map((event, index) => (
                    <li key={index}>
                      <strong>{event.action.replace(/-/g, ' ')}</strong>
                      <small>{stamp(event.at)}</small>
                      {event.note && <p>{event.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Modal.Body>
            <Modal.Footer>
              <button
                className="payout-close"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
              <div className="payout-detail-actions">
                {canWrite &&
                  payoutMode === 'hyperwallet-sandbox' &&
                  selected.status === 'pending' && (
                    <button
                      className="payout-close"
                      onClick={() =>
                        open(
                          selected,
                          'link-recipient',
                          'Link sandbox recipient'
                        )
                      }
                    >
                      Link sandbox recipient
                    </button>
                  )}
                {canWrite &&
                  rowActions(selected).map(([action, label]) => (
                    <button
                      key={action}
                      className="payout-primary"
                      disabled={
                        busy ||
                        loading ||
                        (action === 'approve' && !selected.bankSnapshot?.last4)
                      }
                      onClick={() => open(selected, action, label)}
                    >
                      {action === 'reconcile' && <FiRotateCcw />}
                      {label}
                    </button>
                  ))}
              </div>
            </Modal.Footer>
          </>
        )}
      </Modal>
      <Modal show={!!dialog} onHide={() => !busy && setDialog(null)}>
        <Form onSubmit={submit}>
          <Modal.Header closeButton={!busy}>
            <Modal.Title>{dialog?.label}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <p>
              {dialog && money(dialog.row.amount)} to{' '}
              {dialog?.row.technician?.name}, account ending{' '}
              {dialog?.row.bankSnapshot?.last4}.
            </p>
            {dialog?.action === 'approve' && (
              <p>
                {payoutMode === 'manual'
                  ? 'Review the registered bank destination before approving. Approval does not send money.'
                  : 'Approval queues a sandbox payout to the registered bank destination. No live money will move.'}
              </p>
            )}
            {dialog?.action === 'reconcile' && (
              <p>
                Check the existing provider payment. This does not create
                another payment.
              </p>
            )}
            {dialog?.action === 'link-recipient' && (
              <>
                <p>
                  Register the technician and their onboarding bank in the
                  sandbox program first. The backend verifies the recipient
                  belongs to this technician and the bank matches.
                </p>
                <Form.Label>Hyperwallet user token</Form.Label>
                <Form.Control
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="usr-…"
                />
                <Form.Label>Bank transfer-method token</Form.Label>
                <Form.Control
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="trm-…"
                />
              </>
            )}
            {dialog?.action === 'mark-sent' && (
              <>
                <p>
                  Submit only after initiating this payment through your bank.
                </p>
                <Form.Label>Bank transfer reference</Form.Label>
                <Form.Control
                  required
                  maxLength={200}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </>
            )}
            {['reject', 'cancel', 'mark-failed', 'confirm-returned'].includes(
              dialog?.action
            ) && (
              <>
                <Form.Label>Reason</Form.Label>
                <Form.Control
                  as="textarea"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            )}
            {dialog?.action === 'mark-paid' && (
              <Form.Check
                className="mt-3"
                required
                label="I verified the bank transfer completed successfully."
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
            )}
            {['mark-failed', 'confirm-returned'].includes(dialog?.action) && (
              <Form.Check
                className="mt-3"
                required
                label="I verified the funds were not delivered or have been returned. Release the reserved amount."
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Confirm'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal show={!!bank} onHide={() => setBank(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Registered payout destination</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Use these details for this request. Access is recorded in the audit
            history.
          </p>
          {bank && (!bank.routingNumber || !bank.accountType) && (
            <Alert variant="warning">
              This onboarding account is missing US routing or account-type
              details. Resolve these through the technician profile before
              sending payment. Corrected destinations require a new withdrawal
              request.
            </Alert>
          )}
          {bank && (
            <dl>
              {Object.entries(bank).map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setBank(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
