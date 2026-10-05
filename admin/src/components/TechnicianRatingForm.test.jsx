import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TechnicianRatingForm, { emptyFeedback } from './TechnicianRatingForm';
jest.mock('react-quill-new', () => function Editor({ value, onChange, readOnly }) {
  return <textarea aria-label="Team note" value={value} disabled={readOnly} onChange={e => onChange(e.target.value)} />;
});
function Harness() {
  const [value, setValue] = useState(emptyFeedback);
  return <><TechnicianRatingForm value={value} onChange={setValue} /><output data-testid="feedback">{JSON.stringify(value)}</output></>;
}
test('rating is optional, selecting an expectation records its score', () => {
  render(<Harness />);
  expect(JSON.parse(screen.getByTestId('feedback').textContent).score).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Exceeded' }));
  expect(JSON.parse(screen.getByTestId('feedback').textContent).score).toBe(4);
  expect(screen.getByRole('button', { name: 'Exceeded' })).toHaveAttribute('aria-pressed', 'true');
});
test('criteria can be changed and cleared, and team notes are preserved', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Communication: thumbs up' }));
  fireEvent.click(screen.getByRole('button', { name: 'Communication: thumbs down' }));
  expect(JSON.parse(screen.getByTestId('feedback').textContent).criteria.communication).toBe('down');
  fireEvent.click(screen.getByRole('button', { name: 'Communication: thumbs down' }));
  expect(JSON.parse(screen.getByTestId('feedback').textContent).criteria.communication).toBeUndefined();
  fireEvent.change(screen.getByLabelText('Team note'), { target: { value: 'For our team' } });
  expect(JSON.parse(screen.getByTestId('feedback').textContent).note).toBe('For our team');
});
test('feedback controls are disabled while saving', () => {
  render(<TechnicianRatingForm value={emptyFeedback()} onChange={() => {}} disabled />);
  expect(screen.getByRole('button', { name: 'Met' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Work quality: thumbs up' })).toBeDisabled();
});
