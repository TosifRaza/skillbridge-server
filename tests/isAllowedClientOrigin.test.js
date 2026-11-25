const isAllowedClientOrigin = require('../src/utils/isAllowedClientOrigin');

describe('Android and web client origin allowlist', () => {
  test.each(['https://localhost', 'capacitor://localhost', 'http://localhost:5173'])(
    'allows local app origin %s',
    (origin) => {
      expect(isAllowedClientOrigin(origin, 'https://skillbridge.example')).toBe(true);
    }
  );

  test('allows the configured production client origin', () => {
    expect(isAllowedClientOrigin('https://skillbridge.example', 'https://skillbridge.example')).toBe(true);
  });

  test('allows Render-hosted web clients', () => {
    expect(isAllowedClientOrigin('https://skillbridge-client.onrender.com', '')).toBe(true);
  });

  test('rejects unconfigured external origins', () => {
    expect(isAllowedClientOrigin('https://attacker.example', 'https://skillbridge.example')).toBe(false);
  });
});
