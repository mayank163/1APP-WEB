const calculateTechnicianSummary = ({
  totalJobsDone = 0,
  totalEarnings = 0,
  totalWithdrawn = 0,
  pendingBalance,
}) => {
  const availableBalance = pendingBalance !== undefined
    ? pendingBalance
    : Math.max(totalEarnings - totalWithdrawn, 0);

  return {
    totalJobsDone,
    totalEarnings,
    totalWithdrawn,
    availableBalance,
  };
};

const getRequestStatusTone = (status = 'pending') => {
  const normalized = String(status).toLowerCase();

  if (normalized === 'accepted') return 'success';
  if (normalized === 'rejected') return 'danger';
  if (normalized === 'counter-offer' || normalized === 'counteroffer') return 'warning';
  return 'info';
};

module.exports = {
  calculateTechnicianSummary,
  getRequestStatusTone,
};
