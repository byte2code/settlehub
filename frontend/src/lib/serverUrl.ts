/** Sending logins to a plain-http or unknown scheme address would expose passwords, so only https (or local dev hosts) is accepted. */
export function isAllowedServerUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
  } catch {
    return false;
  }
}
