jest.mock('../src/models/Job', () => ({ findById: jest.fn() }));

const Job = require('../src/models/Job');
const ChatService = require('../src/services/chatService');

const customerId = '64b000000000000000000001';
const workerId = '64b000000000000000000002';
const unrelatedId = '64b000000000000000000003';

describe('call participant lookup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the hired worker when the customer starts a call', async () => {
    Job.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ customer: customerId, hiredProvider: workerId }) });

    await expect(ChatService.getCallParticipant(`job_${'64b000000000000000000004'}`, customerId)).resolves.toBe(workerId);
  });

  test('returns the customer when the hired worker starts a call', async () => {
    Job.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ customer: customerId, hiredProvider: workerId }) });

    await expect(ChatService.getCallParticipant(`job_${'64b000000000000000000004'}`, workerId)).resolves.toBe(customerId);
  });

  test('does not expose call signaling to unrelated users or malformed conversations', async () => {
    Job.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ customer: customerId, hiredProvider: workerId }) });

    await expect(ChatService.getCallParticipant('job_64b000000000000000000004', unrelatedId)).resolves.toBeNull();
    await expect(ChatService.getCallParticipant('not-a-job-id', unrelatedId)).resolves.toBeNull();
  });
});
