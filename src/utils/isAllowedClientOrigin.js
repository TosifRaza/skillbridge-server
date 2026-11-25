const LOCAL_APP_PROTOCOLS = new Set(['http:', 'https:', 'capacitor:', 'ionic:']);

const isAllowedClientOrigin = (origin, configuredClientUrl) => {
  if (!origin) return true;
  if (origin === configuredClientUrl) return true;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (
    ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname) &&
    LOCAL_APP_PROTOCOLS.has(parsedOrigin.protocol)
  ) {
    return true;
  }

  return parsedOrigin.hostname.endsWith('.onrender.com');
};

module.exports = isAllowedClientOrigin;
