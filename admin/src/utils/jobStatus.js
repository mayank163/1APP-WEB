/**
 * Shared job-status utilities for the admin portal.
 */

export const JOB_STATUS_OPTIONS = ['open', 'assigned', 'in-progress', 'completed', 'cancelled'];

const STATUS_META = {
  'open':        { label: 'Open',        tone: 'primary'   },
  'assigned':    { label: 'Assigned',    tone: 'info'      },
  'in-progress': { label: 'In Progress', tone: 'warning'   },
  'completed':   { label: 'Completed',   tone: 'success'   },
  'cancelled':   { label: 'Cancelled',   tone: 'danger'    },
};

/**
 * Returns the human-readable label for a job status.
 * Falls back to capitalising the raw value if unknown.
 */
export const getJobStatusLabel = (status) => {
  if (!status) return 'Unknown';
  return STATUS_META[status]?.label
    ?? (status.charAt(0).toUpperCase() + status.slice(1));
};

/**
 * Returns the Bootstrap colour tone (e.g. "success", "danger") for a job status.
 * Used with `text-bg-{tone}` badge classes.
 */
export const getJobStatusTone = (status) => {
  if (!status) return 'secondary';
  return STATUS_META[status]?.tone ?? 'secondary';
};
