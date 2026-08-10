import React, { useEffect, useState } from 'react';

const TechnicianDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({
    totalJobsDone: 0,
    totalEarnings: 0,
    totalWithdrawn: 0,
    availableBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('1App_token')}`,
  });

  const loadData = async () => {
    try {
      const token = localStorage.getItem('1App_token');
      if (!token) return;

      const [dashboardRes, jobsRes] = await Promise.all([
        fetch('http://localhost:5000/api/technician/dashboard', { headers: apiHeaders() }),
        fetch('http://localhost:5000/api/technician/jobs', { headers: apiHeaders() }),
      ]);

      const dashboardData = await dashboardRes.json();
      const jobsData = await jobsRes.json();

      if (dashboardData.success) {
        const tech = dashboardData.data.technician;
        setSummary({
          totalJobsDone: tech.totalJobsDone || 0,
          totalEarnings: tech.totalEarnings || 0,
          totalWithdrawn: tech.totalWithdrawn || 0,
          availableBalance: tech.availableBalance || 0,
        });
        setRequests(dashboardData.data.requests || []);
      }

      if (jobsData.success) setJobs(jobsData.data.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const requestJob = async (jobId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/technician/jobs/${jobId}/request`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ note: 'I am interested in this job and can complete it efficiently.' }),
      });
      const data = await res.json();
      alert(data.message || 'Request sent');
      if (data.success) loadData();
    } catch (err) {
      alert('Unable to request this job');
    }
  };

  const withdraw = async () => {
    try {
      const amount = Number(prompt('Enter amount to withdraw', summary.availableBalance || 0));
      if (!amount) return;
      const res = await fetch('http://localhost:5000/api/technician/withdraw', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ amount, method: 'bank-transfer', details: 'Bank transfer withdrawal' }),
      });
      const data = await res.json();
      alert(data.message || 'Withdrawal requested');
      if (data.success) loadData();
    } catch (err) {
      alert('Withdrawal failed');
    }
  };

  if (loading) return <div className="p-4">Loading technician dashboard...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>Technician Dashboard</h2>
      <div className="row g-3 mb-4">
        <div className="col-md-3"><div className="card p-3"><strong>Total Jobs</strong><h4>{summary.totalJobsDone}</h4></div></div>
        <div className="col-md-3"><div className="card p-3"><strong>Total Earnings</strong><h4>${summary.totalEarnings}</h4></div></div>
        <div className="col-md-3"><div className="card p-3"><strong>Withdrawn</strong><h4>${summary.totalWithdrawn}</h4></div></div>
        <div className="col-md-3"><div className="card p-3"><strong>Available</strong><h4>${summary.availableBalance}</h4></div></div>
      </div>

      <button className="btn btn-dark mb-4" onClick={withdraw}>Withdraw Amount</button>

      <div className="card p-3 mb-4">
        <h4>Open jobs</h4>
        {jobs.length === 0 ? <p>No open jobs.</p> : jobs.map(job => (
          <div className="border rounded p-3 mb-2" key={job._id}>
            <div className="d-flex justify-content-between"><strong>{job.title}</strong><span>${job.budget}</span></div>
            <p>{job.description}</p>
            <div className="small text-muted">{job.location}</div>
            <button className="btn btn-dark mt-2" onClick={() => requestJob(job._id)}>Request job</button>
          </div>
        ))}
      </div>

      <div className="card p-3">
        <h4>My requests</h4>
        {requests.length === 0 ? <p>No requests yet.</p> : requests.map(request => (
          <div className="border rounded p-3 mb-2" key={request._id}>
            <div className="d-flex justify-content-between"><strong>{request.job?.title}</strong><span className={`badge text-bg-${request.status === 'accepted' ? 'success' : request.status === 'rejected' ? 'danger' : request.status === 'counter-offer' ? 'warning' : 'secondary'}`}>{request.status}</span></div>
            <p>{request.note || 'No note added.'}</p>
            {request.adminMessage && <p className="text-muted">Admin: {request.adminMessage}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechnicianDashboard;
