const crypto = require('crypto');
const config = require('../src/config');
const chatController = require('../src/controllers/chatController');

describe('authenticated call ICE configuration', () => {
  const originalUrls = config.turnUrls;
  const originalSecret = config.turnSharedSecret;

  afterEach(() => {
    config.turnUrls = originalUrls;
    config.turnSharedSecret = originalSecret;
  });

  test('returns TURN credentials minted for the authenticated caller', async () => {
    config.turnUrls = ['turn:turn.example.test:3478?transport=udp'];
    config.turnSharedSecret = 'deployment-only-shared-secret';
    const req = { user: { id: 'worker-123' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await chatController.getIceServers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    const turn = response.data.iceServers[1];
    expect(turn.urls).toEqual(config.turnUrls);
    expect(turn.username).toMatch(/^\d+:worker-123$/);
    const expectedCredential = crypto.createHmac('sha1', config.turnSharedSecret).update(turn.username).digest('base64');
    expect(turn.credential).toBe(expectedCredential);
    expect(next).not.toHaveBeenCalled();
  });
});
