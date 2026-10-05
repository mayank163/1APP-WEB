import React from 'react';
import ReactQuill from 'react-quill-new';

export const RATING_LABELS = ['Far below', 'Below', 'Met', 'Exceeded', 'Far exceeded'];
export const RATING_CRITERIA = [
  ['checkInTimeliness', 'Check-in timeliness'], ['responsiveness', 'Responsiveness'],
  ['communication', 'Communication'], ['followingInstructions', 'Following instructions'],
  ['preparedness', 'Preparedness'], ['workQuality', 'Work quality'],
  ['onsiteEfficiency', 'On-site efficiency'], ['deliverableAccuracy', 'Deliverable accuracy'],
  ['deliverableTimeliness', 'Deliverable timeliness'], ['clientSatisfaction', 'Client satisfaction'],
  ['professionalism', 'Professionalism'], ['technicalSkills', 'Technical skills'],
];
export const emptyFeedback = () => ({ score: null, note: '', criteria: {} });
export default function TechnicianRatingForm({ value, onChange, disabled }) {
  const toggle = (key, vote) => {
    const criteria = { ...value.criteria };
    if (criteria[key] === vote) delete criteria[key];
    else criteria[key] = vote;
    onChange({ ...value, criteria });
  };
  return <fieldset className="tj-rating-form" disabled={disabled}>
    <legend>Rate this technician’s overall service compared to the expectations stated in the work order</legend>
    <div className="tj-rating-scale" role="group" aria-label="Overall service rating">
      {RATING_LABELS.map((label, index) => <button type="button" key={label} aria-pressed={value.score === index + 1} className={value.score === index + 1 ? 'selected' : ''} onClick={() => onChange({ ...value, score: index + 1 })}>{label}</button>)}
    </div>
    <label className="tj-label">Add a note for your team — Optional</label>
    <ReactQuill theme="snow" value={value.note} readOnly={disabled} onChange={note => onChange({ ...value, note })} placeholder="Add notes about this provider to share with your team." modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }]] }} />
    <div className="tj-rating-criteria">
      {RATING_CRITERIA.map(([key, label]) => <div key={key}>
        <button type="button" aria-label={`${label}: thumbs up`} aria-pressed={value.criteria[key] === 'up'} onClick={() => toggle(key, 'up')}>👍</button>
        <button type="button" aria-label={`${label}: thumbs down`} aria-pressed={value.criteria[key] === 'down'} onClick={() => toggle(key, 'down')}>👎</button>
        <span>{label}</span>
      </div>)}
    </div>
    <small>The overall rating is visible to the technician. Team notes and detailed feedback are private to admins.</small>
  </fieldset>;
}
