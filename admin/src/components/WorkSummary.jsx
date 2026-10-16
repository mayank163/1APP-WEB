import React, { useEffect, useState } from 'react';
import API from '../services/adminApi';
import '../styles/WorkSummary.css';

export default function WorkSummary({ technicianId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    API.getTechnicianWorkSummary(technicianId)
      .then((result) => { if (active) setData(result.data); })
      .catch(() => { if (active) setError('Unable to load work summary.'); });
    return () => { active = false; };
  }, [technicianId, retry]);
  const count = (n) => `${n} ${n === 1 ? 'Job' : 'Jobs'}`;
  const rows = (items) => items.map((item) => (
    <div className="work-summary-detail" key={item.id}>
      <div><span>{item.name}</span><small>★ {item.averageRating == null ? 'N/A' : `${item.averageRating} / 5`}</small>
        {item.lastCompletedAt && <small>Last completed {new Date(item.lastCompletedAt).toLocaleDateString()}</small>}
      </div><span className="work-summary-count">{count(item.jobCount)}</span>
    </div>
  ));
  return <section className="work-summary" aria-label="Work summary">
    <h3>Work summary {data && <small>{count(data.totalJobs)} completed</small>}</h3>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setRetry((v) => v + 1)}>Retry</button></p>
      : !data ? <p role="status">Loading work summary…</p>
      : !data.workTypes.length ? <p>No completed jobs yet.</p>
      : data.workTypes.map((work) => <details key={work.id}>
          <summary><span>{work.name} {work.averageHourlyRate != null && <small>${work.averageHourlyRate} / hr</small>}</span><span className="work-summary-count">{count(work.jobCount)}</span></summary>
          {work.subTypes.length > 0 && <div className="work-summary-breakdown"><h4>Work subtypes</h4>{rows(work.subTypes)}</div>}
          {work.serviceTypes.length > 0 && <div className="work-summary-breakdown"><h4>Service types</h4>{rows(work.serviceTypes)}</div>}
          {!work.subTypes.length && !work.serviceTypes.length && <p>No service type recorded for these jobs.</p>}
        </details>)}
  </section>;
}
