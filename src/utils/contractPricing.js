const isDirectBooking = (job, application) => {
  if (job?.bookingType === 'direct' || application?.proposalMessage === 'Direct booking by customer.') return true;

  // Older direct bookings predate bookingType and can contain a stale application bid.
  return /^Service booking with\s/i.test(String(job?.title || ''))
    && /^Direct hire request for\s/i.test(String(job?.description || ''));
};

const getContractAmount = (job, application) => {
  // The posted service price is the single source of truth for every job type.
  // Proposal amounts and legacy contractAmount values must not change it.
  const budget = Number(job?.budget);
  return Number.isFinite(budget) ? budget : 0;
};

module.exports = { isDirectBooking, getContractAmount };
