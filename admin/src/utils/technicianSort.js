export const TECHNICIAN_SORT_OPTIONS = [
  { value: 'best_match', label: 'Best match' },
  { value: 'distance', label: 'Distance (straight-line)' },
  { value: 'success', label: 'Provider success score' },
  { value: 'completed', label: 'Jobs completed' },
];

export function sortTechnicians(technicians, sort) {
  const field = { distance: 'distanceKm', success: 'providerSuccessScore', completed: 'completedJobCount' }[sort];
  if (!field) return [...technicians];
  return [...technicians].sort((a, b) => {
    const aKnown = typeof a[field] === 'number' && Number.isFinite(a[field]);
    const bKnown = typeof b[field] === 'number' && Number.isFinite(b[field]);
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (!aKnown) return 0;
    return sort === 'distance' ? a[field] - b[field] : b[field] - a[field];
  });
}
