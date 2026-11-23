const Message = require('../src/models/Message');

describe('post-acceptance messaging schema', () => {
  test('messages are keyed by a job conversation and sender', () => {
    expect(Message.schema.path('conversationId').isRequired).toBe(true);
    expect(Message.schema.path('conversationId').options.index).toBe(true);
    expect(Message.schema.path('sender').options.ref).toBe('User');
  });
});
