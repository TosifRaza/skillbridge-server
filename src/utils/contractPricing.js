const isDirectBooking = (job, application) => {
  if (job?.bookingType === 'direct' || application?.proposalMessage === 'Direct booking by customer.') return true;

  // Older direct bookings predate bookingType and can contain a stale application bid.
  return /^Service booking with\s/i.test(String(job?.title || ''))
    && /^Direct hire request for\s/i.test(String(job?.description || ''));
};

const getContractAmount = (job, application) => {
  // A direct hire is priced at the customer's posted budget. Older records may
  // contain a stale contractAmount/bidAmount from the marketplace flow.
  if (isDirectBooking(job, application)) return Number(job?.budget) || 0;
  if (job?.contractAmount !== null && job?.contractAmount !== undefined && Number.isFinite(Number(job.contractAmount))) {
    return Number(job.contractAmount);
  }
  return Number(application?.bidAmount);
};

module.exports = { isDirectBooking, getContractAmount };
