jest.mock('../src/services/chatService', () => ({
  markAsRead: jest.fn(),
  getCallParticipant: jest.fn(),
}));

const ChatService = require('../src/services/chatService');
const registerSocketHandler = require('../src/sockets/socketHandler');

const createConnectedSocket = (userId = 'worker-id') => {
  const socketListeners = new Map();
  const ioListeners = new Map();
  const io = {
    on: jest.fn((event, handler) => ioListeners.set(event, handler)),
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
  const socket = {
    id: 'worker-socket',
    user: {
      _id: { toString: () => userId },
      fullName: 'Test Worker',
      email: 'worker@example.test',
      avatar: { url: 'https://images.test/worker.jpg' },
    },
    on: jest.fn((event, handler) => socketListeners.set(event, handler)),
    join: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };

  registerSocketHandler(io);
  ioListeners.get('connection')(socket);
  return { io, socket, socketListeners };
};

describe('authenticated call signaling', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends a valid audio/video offer to the other authorized chat participant', async () => {
    ChatService.getCallParticipant.mockResolvedValue('customer-id');
    const { io, socket, socketListeners } = createConnectedSocket();

    await socketListeners.get('call-initiate')({
      conversationId: 'job-123',
      callId: 'call-123',
      callType: 'video',
      offer: { type: 'offer', sdp: 'test-sdp' },
    });

    expect(ChatService.getCallParticipant).toHaveBeenCalledWith('job-123', 'worker-id');
    expect(io.to).toHaveBeenCalledWith('customer-id');
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledWith('call-incoming', expect.objectContaining({
      conversationId: 'job-123',
      callId: 'call-123',
      callType: 'video',
      offer: { type: 'offer', sdp: 'test-sdp' },
      fromUserId: 'worker-id',
      caller: { id: 'worker-id', name: 'Test Worker', avatar: 'https://images.test/worker.jpg' },
    }));
  });

  test.each([
    ['call-answer', 'call-answered', { answer: { type: 'answer', sdp: 'answer-sdp' } }],
    ['call-ice-candidate', 'call-ice-candidate', { candidate: { candidate: 'ice' } }],
    ['call-decline', 'call-declined', {}],
    ['call-end', 'call-ended', {}],
  ])('relays %s to the authorized peer', async (incomingEvent, outgoingEvent, extraData) => {
    ChatService.getCallParticipant.mockResolvedValue('customer-id');
    const { io, socketListeners } = createConnectedSocket();
    const data = { conversationId: 'job-123', callId: 'call-123', ...extraData };

    await socketListeners.get(incomingEvent)(data);

    expect(ChatService.getCallParticipant).toHaveBeenCalledWith('job-123', 'worker-id');
    expect(io.to).toHaveBeenCalledWith('customer-id');
    expect(io.to.mock.results[0].value.emit).toHaveBeenCalledWith(outgoingEvent, { ...data, fromUserId: 'worker-id' });
  });

  test('does not deliver signaling to a user who is not a chat participant', async () => {
    ChatService.getCallParticipant.mockResolvedValue(null);
    const { io, socketListeners } = createConnectedSocket();

    await socketListeners.get('call-end')({ conversationId: 'private-job', callId: 'call-123' });

    expect(io.to).not.toHaveBeenCalled();
  });

  test('ignores malformed call offers', async () => {
    const { io, socketListeners } = createConnectedSocket();

    await socketListeners.get('call-initiate')({ conversationId: 'job-123', callId: 'call-123', callType: 'screen-share' });

    expect(ChatService.getCallParticipant).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });
});
