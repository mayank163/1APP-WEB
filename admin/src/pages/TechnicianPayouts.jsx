import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Modal, Table, Alert } from 'react-bootstrap';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const actions = { pending: [['approve','Approve'],['reject','Reject']], approved: [['mark-sent','Record payment sent'],['cancel','Cancel']], sent: [['mark-paid','Confirm paid'],['mark-failed','Record failed / returned']] };
export default function TechnicianPayouts() {
  const { can } = useAdminAuth();
  const canWrite = can('technician_jobs','write');
  const [payoutMode,setPayoutMode] = useState('manual');
  const [rows,setRows] = useState([]), [status,setStatus] = useState('pending'), [page,setPage] = useState(1), [total,setTotal] = useState(0);
  const [error,setError] = useState(''), [loading,setLoading] = useState(false), [busy,setBusy] = useState(false);
  const [dialog,setDialog] = useState(null), [reason,setReason] = useState(''), [reference,setReference] = useState(''), [confirmed,setConfirmed] = useState(false), [bank,setBank] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await adminApi.getWithdrawals({ status, page }); setRows(result.data.withdrawals); setPayoutMode(result.data.payoutMode || 'manual'); setTotal(result.data.pagination.total); }
    catch(e) { setError(e.response?.data?.message || 'Could not load payouts.'); }
    finally { setLoading(false); }
  },[status,page]);
  useEffect(() => { load(); },[load]);
  const open = (row, action, label) => { setReason(''); setReference(''); setConfirmed(false); setError(''); setDialog({ row, action, label }); };
  const submit = async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      if (dialog.action === 'link-recipient') {
        await adminApi.linkPayoutRecipient(dialog.row.technician._id,{ userToken: reason.trim(),bankToken: reference.trim() });
      } else await adminApi.updateWithdrawal(dialog.row._id,dialog.action,{ reason, transferReference: reference, fundsReturnedConfirmed: confirmed, paymentCompletedConfirmed: confirmed });
      setDialog(null); await load();
    } catch(e) { setError(e.response?.data?.message || 'Could not update payout.'); }
    finally { setBusy(false); }
  };
  const reveal = async row => {
    setBusy(true); setError('');
    try { const result = await adminApi.getWithdrawalBank(row._id); setBank(result.data.bank); }
    catch(e) { setError(e.response?.data?.message || 'Could not load bank destination.'); }
    finally { setBusy(false); }
  };
  return <div className="container-fluid py-4">
    <h2>Technician payouts</h2>
    {payoutMode === 'manual' ? <p>Approve withdrawal requests, send payments through your business bank, then record the transfer and confirm completion.</p> : <Alert variant="info">{payoutMode === 'hyperwallet-mock' ? 'SIMULATION: Approval queues a fake bank payout. No money is sent.' : 'HYPERWALLET SANDBOX: Approval queues a test bank payout to a linked recipient. No live money is sent.'}</Alert>}
    {error && <Alert variant="danger" role="alert">{error}</Alert>}
    <Form.Select aria-label="Filter payouts by status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="mb-3" style={{ maxWidth: 260 }}>
      <option value="">All statuses</option>{['pending','approved','processing','sent','paid','rejected','cancelled','failed'].map(s => <option key={s} value={s}>{s}</option>)}
    </Form.Select>
    <Card><Table responsive className="mb-0" striped><thead><tr><th>Technician</th><th>Amount</th><th>Destination</th><th>Requested</th><th>Status / reference</th><th>Actions</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row._id}>
        <td>{row.technician?.name || 'Deleted technician'}<br/><small>{row.technician?.email}</small></td>
        <td>{money(row.amountCents !== undefined ? row.amountCents/100 : row.amount)}</td>
        <td>{row.bankSnapshot?.bankName || 'Legacy request — resubmission required'}<br/>{row.bankSnapshot?.last4 && `Account ending ${row.bankSnapshot.last4}`}</td>
        <td>{new Date(row.createdAt).toLocaleString()}</td>
        <td>{row.status}<br/>{row.payout?.provider && <small>{row.payout.provider} · {row.payout.providerStatus || row.payout.state}<br/>{row.payout.lastError}</small>}<br/><small>{row.transferReference || row.rejectionReason || row.failureReason}</small></td>
        <td>{canWrite && <div className="d-flex gap-2 flex-wrap">
          {row.bankSnapshot?.last4 && ['pending','approved'].includes(row.status) && <Button size="sm" variant="outline-secondary" disabled={busy || loading} onClick={() => reveal(row)}>View bank details</Button>}
          {payoutMode === 'hyperwallet-sandbox' && row.status === 'pending' && <Button size="sm" variant="outline-secondary" disabled={busy || loading} onClick={() => open(row,'link-recipient','Link sandbox recipient')}>Link sandbox recipient</Button>}
          {(row.payout?.provider ? (['processing','paid'].includes(row.status) ? [['reconcile','Refresh provider status'], ...(['FAILED','RETURNED','CANCELLED','EXPIRED'].includes(row.payout.providerStatus) ? [['confirm-returned','Confirm returned funds']] : [])] : []) : (actions[row.status] || [])).map(([action,label]) => <Button key={action} size="sm" disabled={busy || loading || (action === 'approve' && !row.bankSnapshot?.last4)} onClick={() => open(row,action,label)}>{action === 'approve' && payoutMode !== 'manual' ? 'Approve test payout' : label}</Button>)}
        </div>}</td>
      </tr>)}{!rows.length && <tr><td colSpan={6}>{loading ? 'Loading…' : 'No withdrawal requests.'}</td></tr>}</tbody>
    </Table></Card>
    <div className="d-flex gap-3 align-items-center mt-3"><Button disabled={page <= 1 || loading} onClick={() => setPage(page-1)}>Previous</Button><span>Page {page} · {total} requests</span><Button disabled={page*20 >= total || loading} onClick={() => setPage(page+1)}>Next</Button></div>
    <Modal show={!!dialog} onHide={() => !busy && setDialog(null)}><Form onSubmit={submit}><Modal.Header closeButton={!busy}><Modal.Title>{dialog?.label}</Modal.Title></Modal.Header><Modal.Body>
      {error && <Alert variant="danger">{error}</Alert>}
      <p>{dialog && money(dialog.row.amount)} to {dialog?.row.technician?.name}, account ending {dialog?.row.bankSnapshot?.last4}.</p>
      {dialog?.action === 'approve' && <p>{payoutMode === 'manual' ? 'Review the registered bank destination before approving. Approval does not send money.' : 'Approval queues a sandbox payout to the registered bank destination. No live money will move.'}</p>}
      {dialog?.action === 'reconcile' && <p>Check the existing provider payment. This does not create another payment.</p>}
      {dialog?.action === 'link-recipient' && <><p>Register the technician and their onboarding bank in the sandbox program first. The backend verifies the recipient belongs to this technician and the bank matches.</p><Form.Label>Hyperwallet user token</Form.Label><Form.Control required value={reason} onChange={e => setReason(e.target.value)} placeholder="usr-…"/><Form.Label>Bank transfer-method token</Form.Label><Form.Control required value={reference} onChange={e => setReference(e.target.value)} placeholder="trm-…"/></>}
      {dialog?.action === 'mark-sent' && <><p>Submit only after initiating this payment through your bank.</p><Form.Label>Bank transfer reference</Form.Label><Form.Control required maxLength={200} value={reference} onChange={e => setReference(e.target.value)}/></>}
      {['reject','cancel','mark-failed','confirm-returned'].includes(dialog?.action) && <><Form.Label>Reason</Form.Label><Form.Control as="textarea" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></>}
      {dialog?.action === 'mark-paid' && <Form.Check className="mt-3" required label="I verified the bank transfer completed successfully." checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>}
      {['mark-failed','confirm-returned'].includes(dialog?.action) && <Form.Check className="mt-3" required label="I verified the funds were not delivered or have been returned. Release the reserved amount." checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>}
    </Modal.Body><Modal.Footer><Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>Close</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button></Modal.Footer></Form></Modal>
    <Modal show={!!bank} onHide={() => setBank(null)}><Modal.Header closeButton><Modal.Title>Registered payout destination</Modal.Title></Modal.Header><Modal.Body>
      <p>Use these details for this request. Access is recorded in the audit history.</p>
      {bank && (!bank.routingNumber || !bank.accountType) && <Alert variant="warning">This onboarding account is missing US routing or account-type details. Resolve these through the technician profile before sending payment. Corrected destinations require a new withdrawal request.</Alert>}
      {bank && <dl>{Object.entries(bank).map(([label,value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>}
    </Modal.Body><Modal.Footer><Button onClick={() => setBank(null)}>Close</Button></Modal.Footer></Modal>
  </div>;
}
