import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JobOverviewWorkspace from './JobOverviewWorkspace';

const job = { _id: 'job1', title: 'Network setup', status: 'open' };
const requests = [
  { _id: 'r1', job: 'job1', status: 'pending', technician: { name: 'Alex', verificationStatus: 'approved' } },
  { _id: 'r2', job: { _id: 'job1' }, status: 'counter-offer', technician: { name: 'Sam' } },
  { _id: 'r3', job: 'other', status: 'pending', technician: { name: 'Other job' } }
];
test('scopes responses to the job and filters providers before opening review', () => {
  const onReview = jest.fn();
  render(<JobOverviewWorkspace job={job} requests={requests} tab="providers" onTab={jest.fn()} onReview={onReview} onRoute={jest.fn()} canWrite statusLabel="Open" payLabel="$100" />);
  expect(screen.queryByText('Other job')).toBeNull();
  fireEvent.change(screen.getByLabelText('Search providers'), { target: { value: 'Sam' } });
  expect(screen.queryByText('Alex')).toBeNull();
  fireEvent.click(screen.getByText('Review offer'));
  expect(onReview).toHaveBeenCalledWith(requests[1]);
  fireEvent.click(screen.getByLabelText('Verified providers'));
  expect(screen.getByText('No matching providers')).toBeTruthy();
});
