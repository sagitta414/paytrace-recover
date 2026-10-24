// Optional adapter for a separate course-access service. Only sandbox purchases use it.
// The service owns its entitlement records and protected lesson; PayTrace never writes
// directly to that service's database.
export function courseAccessClient(env, fetcher = fetch) {
  if (Boolean(env.COURSE_ACCESS_URL) !== Boolean(env.COURSE_ACCESS_API_KEY)) throw Error('Set both COURSE_ACCESS_URL and COURSE_ACCESS_API_KEY to use a separate course service.');
  const configured = Boolean(env.COURSE_ACCESS_URL && env.COURSE_ACCESS_API_KEY);
  if (!configured) return null;
  const base = new URL(env.COURSE_ACCESS_URL);
  if (!['https:', 'http:'].includes(base.protocol) || (base.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(base.hostname))) {
    throw Error('COURSE_ACCESS_URL must use HTTPS, except for localhost development.');
  }
  if (base.username || base.password || base.search || base.hash) throw Error('COURSE_ACCESS_URL must be a service origin or path without credentials or query parameters.');
  const request = async (path, data, idempotencyKey) => {
    const url = new URL(base.href.replace(/\/?$/, '/') + path);
    const response = await fetcher(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.COURSE_ACCESS_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Error(`Course access service returned HTTP ${response.status}.`);
    return response.json();
  };
  const identity = s => ({ caseId: s.id, userId: s.order.userId, courseId: s.order.courseId, captureId: s.capture?.id || null });
  const check = async s => {
    const value = await request('v1/access/check', identity(s));
    if (value?.userId !== s.order.userId || value?.courseId !== s.order.courseId || typeof value.active !== 'boolean') {
      throw Error('Course access service returned a mismatched entitlement.');
    }
    if (value.active && value.captureId !== s.capture?.id) throw Error('Course access belongs to a different payment.');
    return { userId: value.userId, courseId: value.courseId, active: value.active, captureId: value.active ? value.captureId : null };
  };
  return {
    check,
    async grant(s) {
      if (s.capture?.source !== 'paypal-sandbox' || s.capture.status !== 'COMPLETED') throw Error('A completed PayPal sandbox capture is required.');
      const value = await request('v1/access/grants', identity(s), `paytrace:${s.id}:${s.capture.id}`);
      if (value?.userId !== s.order.userId || value?.courseId !== s.order.courseId || value?.captureId !== s.capture.id || value?.active !== true) {
        throw Error('Course access service did not confirm the approved grant.');
      }
      return check(s);
    },
    async probe(s) {
      const value = await request('v1/access/lesson-probe', identity(s));
      if (value?.userId !== s.order.userId || value?.courseId !== s.order.courseId || value?.captureId !== s.capture?.id) {
        throw Error('Protected lesson belongs to another purchase.');
      }
      return value;
    }
  };
}
