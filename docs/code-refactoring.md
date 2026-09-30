# app.js refactoring tasks

This file lists improvements found while reviewing `app.js`. Line numbers refer to the version at commit `9875c82` and may shift as you edit, so each task also quotes the code it is about.

## Context

- `app.js` is the whole service: an Express 5 app (CommonJS) with a single endpoint, `GET /api/feed/:name?size=N`. It fetches `${MEDIUM_BASE_URL}/feed/@<name>`, parses the RSS with `xml2js`, and returns a JSON array of `{ title, link, pubDate, creator, categories, content }`. Results are cached in memory with `node-cache`.
- Environment variables, loaded through `dotenv`: `PORT`, `ALLOWED_ORIGIN`, `API_CACHE_TTL`, `MEDIUM_BASE_URL`, `USER_AGENT`.
- The `Dockerfile` copies only `app.js` and runs `node app.js`. Keep the service in that single file unless a task says otherwise.
- There are no tests. Check your changes by running the service and calling it with curl (see "Verification" at the end).

## Constraints

- Successful responses must keep the same JSON array and the same item fields, because existing clients rely on them.
- Stay on CommonJS (`require`) and on the dependencies already listed in `package.json`. Don't add new ones.
- Match the existing style: 4-space indentation, semicolons, and the `logMessage`/`logError` helpers.

## Required tasks

Do these in order. Tasks 2, 4 and 6 all change the route handler, so do them together.

### 1. Validate the `name` route parameter

Current code (around line 54 and line 58):
```js
const mediumName = req.params.name;
const feedUrl = `${process.env.MEDIUM_BASE_URL}/feed/@${mediumName}`;
```
**Problem:** Express decodes route params, so `/api/feed/..%2F..%2Fx` gives `mediumName = "../../x"`. When the URL is built, the dot segments are normalised, and the service can then request other paths on the Medium host. The raw value is also written to the logs unchanged, so it can contain newlines.

**Change:** Check the name at the start of the handler, before it is logged or used anywhere. If it fails the check, return `400 { error: 'Invalid username' }`.
```js
if (!/^[A-Za-z0-9._-]{1,50}$/.test(mediumName)) {
    return res.status(400).json({ error: 'Invalid username' });
}
```

### 2. Clamp `size` and cache per user instead of per user+size

Current code (around lines 56 and 61):
```js
const size = parseInt(req.query.size) || 5;
const cacheKey = `${mediumName}:${size}`;
```
**Problems:**
- `size=-1` is passed to `slice(0, -1)`, which returns every item except the last one.
- `size=0` quietly becomes 5, because `0 || 5` picks 5.
- Every different `size` value creates its own cache entry and a new request to Medium for the same feed. Anyone can fill the cache just by changing `size`.

**Change:**
- Parse and clamp the value: `Math.min(Math.max(parseInt(req.query.size, 10) || 5, 1), 20)`. The maximum of 20 is a suggestion; Medium feeds usually contain about 10 items.
- Use `mediumName` alone as the cache key. Store the full list of mapped items (after the `.map(...)` that builds each item) under that key.
- On every request, whether or not the data came from the cache, respond with `items.slice(0, size)`.

### 3. Add a timeout to the upstream request

Current code (around line 28): `axios.get(feedUrl, { headers: {...} })` has no timeout, so a slow or hanging Medium response keeps the client request open indefinitely.

**Change:** Add `timeout: 10000` to the axios options.

### 4. Return meaningful status codes for upstream failures

Current code (around line 86): every error becomes `500 { error: 'Failed to fetch or parse RSS feed' }`.

**Change:** In the handler's `catch`:
- `error.response?.status === 404`: return `404 { error: 'Feed not found' }`. Medium returns 404 for unknown users.
- Any other error from the axios call, a timeout, or a parse failure: return `502 { error: 'Failed to fetch or parse RSS feed' }`.

Do not cache error responses. The current code already doesn't; make sure it stays that way.

### 5. Read the cache TTL as a number and fix the comment

Current code (around lines 18–19):
```js
// Cache items for 15 minutes (900 seconds)
const cache = new NodeCache({ stdTTL: process.env.API_CACHE_TTL || 1800 });
```
**Problems:**
- The comment says 15 minutes, but the default is 1800 seconds, which is 30 minutes.
- The environment value is a string. In node-cache, `"0"` behaves differently from the number `0`, which means "never expire".

**Change:** Use `const cacheTtl = Number(process.env.API_CACHE_TTL) || 1800;` and update the comment to say 30 minutes.

### 6. Stop logging errors twice

Current code: `fetchFeed` (around lines 36–39) catches the error, logs it and rethrows it, and then the route handler logs it again.

**Change:** Remove the `try/catch` from `fetchFeed`. The route handler's `catch` should be the only place that logs the error.

### 7. Check configuration at startup

**Problem:** If `MEDIUM_BASE_URL` is not set, the service starts anyway and then requests `undefined/feed/@name`, which fails with a confusing error.

**Change:** Default it to Medium's address: `const mediumBaseUrl = process.env.MEDIUM_BASE_URL || 'https://medium.com';`. Read all environment variables once, near the top of the file, into constants.

**Decided by the project owner:** use the `https://medium.com` default. Do not make the service exit at startup when the variable is missing.

### 8. Parse the feed defensively

Current code (around line 34): `parsedFeed.rss.channel[0].item || []` throws a `TypeError` if Medium returns HTML (for example an error page) instead of RSS.

**Change:** If `parsedFeed?.rss?.channel?.[0]` is missing, throw a clear `Error('Unexpected feed format')`. Task 4 then turns it into a 502. A channel that has no `item` entries is still valid and should return `[]`.

### 9. Tidy up order and style

- Move `app.listen(...)` to the bottom of the file, after the helpers and routes, and keep the returned `server` in a variable (task 10 needs it).
- Add the missing semicolons at the end of the `allowedOrigins` line (around line 10) and at the end of `logError` (around line 50).
- Remove the stale `// Example User-Agent string` comment.

## Optional tasks

Do these only once the required tasks are finished.

### 10. Shut down cleanly on SIGTERM

The container runs `node app.js` as PID 1. Node running as PID 1 ignores SIGTERM unless the program handles it, so `docker stop` waits 10 seconds and then kills the container. Add:
```js
process.on('SIGTERM', () => {
    logMessage('SIGTERM received, shutting down');
    server.close(() => process.exit(0));
});
```

### 11. Add a `Cache-Control` header

On successful responses, set `Cache-Control: public, max-age=<cacheTtl>` so browsers and CDNs can cache them too.

### 12. Allow several CORS origins

Split `ALLOWED_ORIGIN` on commas and pass the resulting array to `cors`. Keep `'*'` as the default when the variable is not set.

### 13. Add a health endpoint

Add `GET /health`, which returns `200 { status: 'ok' }` and never calls Medium.

### 14. Fix package.json

- Change `"main": "index.js"` to `"main": "app.js"`.
- Add `"start": "node app.js"` to `scripts`.

## Verification

Start the service with `node app.js`, then run these requests. If `MEDIUM_BASE_URL` is not set, the default from task 7 applies.

| Request | Expected |
|---|---|
| `GET /api/feed/<real user>` | 200, at most 5 items, same fields as before |
| `GET /api/feed/<real user>?size=2` right after the request above | 200, 2 items, log says "Serving from cache" |
| `GET /api/feed/<real user>?size=-1` | 200, 1 item |
| `GET /api/feed/<real user>?size=999` | 200, at most 20 items |
| `GET /api/feed/..%2F..%2Fx` | 400 `Invalid username` |
| `GET /api/feed/this-user-does-not-exist-xyz123` | 404 `Feed not found` |
| `MEDIUM_BASE_URL=http://127.0.0.1:9` and any valid name | 502 |

For every request, the log should show one line per error, never two.
