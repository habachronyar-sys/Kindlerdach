import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewService, GOOGLE_PROFILE } from './google-reviews.mjs';

const env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REFRESH_TOKEN: 'test-refresh', GOOGLE_BUSINESS_LOCATION: 'accounts/123/locations/456' };
const review = (id, rating = 'FIVE', text = `Text ${id}`) => ({ reviewId: id, starRating: rating, comment: text, reviewer: { displayName: `Person ${id}` }, createTime: '2026-10-01T12:00:00Z', updateTime: '2026-10-02T12:00:00Z' });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('without owner configuration no Google call or fake reviews are returned', async () => {
  const service = createReviewService({ env: {}, request: () => { throw new Error('must not be called'); } });
  await assert.rejects(service.getReviews(), error => error.code === 'GOOGLE_NOT_CONFIGURED' && error.status === 503);
});

test('retrieves more than 50 reviews, all rating levels and duplicates only once', async () => {
  const calls = [];
  const service = createReviewService({ env, request: async (url, options) => {
    const address = String(url);
    calls.push(address);
    if (address.includes('oauth2')) {
      assert.equal(options.body.get('grant_type'), 'refresh_token');
      return json({ access_token: 'test-access', expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    if (!new URL(url).searchParams.has('pageToken')) return json({ averageRating: 4.6, totalReviewCount: 54, reviews: Array.from({ length: 50 }, (_, i) => review(String(i), i === 0 ? 'ONE' : 'FIVE')), nextPageToken: 'next' });
    return json({ reviews: [review('49'), ...Array.from({ length: 4 }, (_, i) => review(String(i + 50)))] });
  }});
  const result = await service.getReviews();
  assert.equal(result.reviews.length, 54);
  assert.equal(result.totalReviewCount, 54);
  assert.equal(result.averageRating, 4.6);
  assert(result.reviews.some(item => item.rating === 1));
  assert.equal(result.complete, true);
  assert.equal(result.profileUrl, GOOGLE_PROFILE);
  assert.equal(calls.length, 3);
  for (const secret of ['test-secret', 'test-refresh', 'test-access', 'accounts/123']) assert(!JSON.stringify(result).includes(secret));
});

test('refresh replaces old data, including deleted reviews, rather than appending', async () => {
  let time = Date.parse('2026-10-19T12:00:00Z');
  let phase = 0;
  let tokenCalls = 0;
  const service = createReviewService({ env, now: () => time, request: async url => {
    if (String(url).includes('oauth2')) { tokenCalls++; return json({ access_token: 'test-access', expires_in: 3600 }); }
    return json({ averageRating: 5, totalReviewCount: 1, reviews: [review(phase ? 'new' : 'deleted')] });
  }});
  const first = await service.getReviews();
  phase = 1;
  assert.strictEqual(await service.getReviews(), first);
  time += 30_001;
  const next = await service.getReviews();
  assert.deepEqual(next.reviews.map(item => item.id), ['new']);
  assert.notEqual(first.fetchedAt, next.fetchedAt);
  assert.equal(tokenCalls, 1);
});

test('concurrent requests share a synchronization', async () => {
  let reviewCalls = 0;
  const service = createReviewService({ env, request: async url => {
    if (String(url).includes('oauth2')) return json({ access_token: 'test-access' });
    reviewCalls++;
    return json({ averageRating: 5, totalReviewCount: 1, reviews: [review('1')] });
  }});
  const [first, second] = await Promise.all([service.getReviews(), service.getReviews()]);
  assert.strictEqual(first, second);
  assert.equal(reviewCalls, 1);
});

test('a failed later page is never exposed as a complete review list', async () => {
  const service = createReviewService({ env, request: async url => {
    if (String(url).includes('oauth2')) return json({ access_token: 'test-access' });
    if (new URL(url).searchParams.has('pageToken')) return json({}, 503);
    return json({ averageRating: 5, totalReviewCount: 54, reviews: [review('1')], nextPageToken: 'next' });
  }});
  await assert.rejects(service.getReviews(), error => error.code === 'GOOGLE_UNAVAILABLE');
});

test('last successful result is marked stale during an outage, not falsely fresh', async () => {
  let time = Date.parse('2026-10-19T12:00:00Z');
  let failing = false;
  const service = createReviewService({ env, now: () => time, request: async url => {
    if (String(url).includes('oauth2')) return json({ access_token: 'test-access' });
    return failing ? json({}, 429) : json({ averageRating: 5, totalReviewCount: 1, reviews: [review('1')] });
  }});
  const good = await service.getReviews();
  time += 31_000;
  failing = true;
  const stale = await service.getReviews();
  assert.equal(stale.status, 'stale');
  assert.equal(stale.fetchedAt, good.fetchedAt);
  time += 300_001;
  await assert.rejects(service.getReviews(), error => error.code === 'GOOGLE_UNAVAILABLE');
});

test('repeated next-page tokens fail safely instead of looping', async () => {
  const service = createReviewService({ env, request: async url => String(url).includes('oauth2') ? json({ access_token: 'test-access' }) : json({ averageRating: 5, totalReviewCount: 54, reviews: [review('1')], nextPageToken: 'same' }) });
  await assert.rejects(service.getReviews(), error => error.code === 'GOOGLE_PAGINATION_FAILED');
});

test('anonymous authors remain anonymous and empty review text remains empty', async () => {
  const service = createReviewService({ env, request: async url => String(url).includes('oauth2') ? json({ access_token: 'test-access' }) : json({ averageRating: 2, totalReviewCount: 1, reviews: [{ ...review('1', 'TWO', ''), reviewer: { isAnonymous: true, displayName: 'Private name' } }] }) });
  const result = await service.getReviews();
  assert.equal(result.reviews[0].author, 'Anonyme Bewertung');
  assert.equal(result.reviews[0].text, '');
  assert(!JSON.stringify(result).includes('Private name'));
});
