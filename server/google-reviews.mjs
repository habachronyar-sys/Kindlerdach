const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const GOOGLE_PROFILE = 'https://maps.google.com/?cid=7330068497940735570';

export class ReviewError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}

export function createReviewService({ env = process.env, request = fetch, now = Date.now } = {}) {
  let cached = null;
  let inFlight = null;
  let token = null;
  let tokenExpires = 0;
  let retryAfter = 0;
  const ttl = 30_000;
  const parent = env.GOOGLE_BUSINESS_LOCATION;
  const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN && /^accounts\/\d+\/locations\/\d+$/.test(parent || ''));

  async function accessToken() {
    if (token && now() < tokenExpires) return token;
    const response = await request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ReviewError('GOOGLE_AUTH_FAILED');
    const body = await response.json();
    if (typeof body.access_token !== 'string' || !body.access_token) throw new ReviewError('GOOGLE_AUTH_FAILED');
    token = body.access_token;
    tokenExpires = now() + Math.max(0, (Number(body.expires_in) || 3600) - 60) * 1000;
    return token;
  }

  async function synchronize() {
    const bearer = await accessToken();
    const reviews = new Map();
    const seenPages = new Set();
    let pageToken = '';
    let averageRating = 0;
    let totalReviewCount = 0;
    do {
      if (seenPages.has(pageToken) || seenPages.size >= 200) throw new ReviewError('GOOGLE_PAGINATION_FAILED');
      seenPages.add(pageToken);
      const url = new URL(`https://mybusiness.googleapis.com/v4/${parent}/reviews`);
      url.searchParams.set('pageSize', '50');
      url.searchParams.set('orderBy', 'updateTime desc');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await request(url, { headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        if (response.status === 401) { token = null; tokenExpires = 0; }
        throw new ReviewError('GOOGLE_UNAVAILABLE');
      }
      const data = await response.json();
      if (seenPages.size === 1) {
        averageRating = Number(data.averageRating ?? 0);
        totalReviewCount = Number(data.totalReviewCount ?? 0);
        if (!Number.isFinite(averageRating) || averageRating < 0 || averageRating > 5 || !Number.isInteger(totalReviewCount) || totalReviewCount < 0) throw new ReviewError('GOOGLE_INVALID_RESPONSE');
      }
      if (data.reviews !== undefined && !Array.isArray(data.reviews)) throw new ReviewError('GOOGLE_INVALID_RESPONSE');
      for (const review of data.reviews || []) {
        if (typeof review.reviewId !== 'string' || !STARS[review.starRating]) throw new ReviewError('GOOGLE_INVALID_RESPONSE');
        // Only public review fields are sent to visitors. Tokens, account IDs,
        // reviewer profile URLs and owner/admin data never leave the server.
        reviews.set(review.reviewId, {
          id: review.reviewId,
          author: review.reviewer?.isAnonymous ? 'Anonyme Bewertung' : String(review.reviewer?.displayName || 'Google-Nutzer'),
          rating: STARS[review.starRating],
          text: typeof review.comment === 'string' ? review.comment : '',
          createdAt: review.createTime || null,
          updatedAt: review.updateTime || review.createTime || null,
        });
      }
      pageToken = data.nextPageToken || '';
      if (typeof pageToken !== 'string') throw new ReviewError('GOOGLE_INVALID_RESPONSE');
    } while (pageToken);

    // Replace only after every page succeeds: no partial list masquerades as
    // all reviews, and reviews removed on Google disappear on the next sync.
    const result = {
      source: 'google-business-profile',
      status: 'connected',
      complete: true,
      averageRating,
      totalReviewCount,
      reviews: [...reviews.values()].sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)),
      fetchedAt: new Date(now()).toISOString(),
      profileUrl: GOOGLE_PROFILE,
    };
    cached = { data: result, timestamp: now() };
    return result;
  }

  async function getReviews() {
    if (!configured) throw new ReviewError('GOOGLE_NOT_CONFIGURED');
    if (cached && now() - cached.timestamp < ttl) return cached.data;
    if (now() < retryAfter) {
      if (cached && now() - cached.timestamp < 300_000) return { ...cached.data, status: 'stale' };
      throw new ReviewError('GOOGLE_UNAVAILABLE');
    }
    if (!inFlight) {
      inFlight = synchronize().catch(error => {
        retryAfter = now() + ttl;
        if (cached && now() - cached.timestamp < 300_000) return { ...cached.data, status: 'stale' };
        throw error instanceof ReviewError ? error : new ReviewError('GOOGLE_UNAVAILABLE');
      }).finally(() => { inFlight = null; });
    }
    return inFlight;
  }
  return { getReviews };
}
