# Medium RSS Wrapper

Medium RSS Wrapper is a small Node.js (Express) service that fetches the RSS feed of a Medium profile and returns it as a simplified JSON array. Feeds are cached in memory to improve response times and reduce the number of requests made to Medium.

## Features

- Retrieves and parses RSS feeds from Medium profiles.
- Returns each feed item with these fields: `title`, `link`, `pubDate`, `creator`, `categories` and `content`.
- Caches each user's feed in memory (30 minutes by default, configurable) and sets a matching `Cache-Control` header on responses.
- Validates the username and `size` parameters and returns clear error responses.
- Configurable CORS policy (single origin, list of origins, or any origin).
- `/health` endpoint for container and load balancer health checks.
- Graceful shutdown on `SIGTERM`.
- Docker image published to GitHub Container Registry on every push to `main`.

## Prerequisites

- Node.js 18 or higher (the Docker image uses Node.js 22)
- npm

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jklancic/medium-rss-wrapper.git
   cd medium-rss-wrapper
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Optionally create a `.env` file in the project root to override the defaults (see [Configuration](#configuration)).

## Usage

### Start the server

```bash
npm start
```

This starts the server at http://localhost:3000 (or on the port set in `PORT`).

### API endpoints

#### `GET /api/feed/:name`

Returns the latest items from a Medium user's feed.

- `:name` – the Medium username, without the `@`. Allowed characters are letters, digits, `.`, `_` and `-`, up to 50 characters.
- `size` (query, optional) – number of items to return, an integer from 1 to 20. Defaults to 5.

Example request:

```bash
curl "http://localhost:3000/api/feed/john.doe?size=1"
```

Example response:

```json
[
  {
    "title": "Article title",
    "link": "https://medium.com/@john.doe/article-title-123abc",
    "pubDate": "Mon, 01 Sep 2025 10:00:00 GMT",
    "creator": "John Doe",
    "categories": ["javascript", "nodejs"],
    "content": "<p>Full article HTML…</p>"
  }
]
```

Error responses are JSON objects of the form `{ "error": "<message>" }`:

| Status | When |
| ------ | ---- |
| `400`  | The username is invalid, or `size` is not an integer between 1 and 20. |
| `404`  | Medium returned 404 for the feed (the user does not exist). |
| `502`  | The feed could not be fetched (network error, 10 second timeout) or parsed. |

Only successful responses are cached. The full feed is cached per user, so requests with different `size` values share the same cache entry.

#### `GET /health`

Returns `{ "status": "ok" }`.

## Configuration

All settings are read from environment variables. A `.env` file in the project root is loaded automatically via `dotenv`.

| Variable          | Default                                                   | Description |
| ----------------- | --------------------------------------------------------- | ----------- |
| `PORT`            | `3000`                                                    | Port the server listens on. |
| `ALLOWED_ORIGIN`  | `*`                                                       | Allowed CORS origin(s). Use a comma-separated list for multiple origins, or `*` (or leave unset) to allow any origin. Only `GET` requests are allowed. |
| `API_CACHE_TTL`   | `1800`                                                    | Cache lifetime in seconds. `0` means entries never expire and no `Cache-Control` header is sent. Invalid values fall back to the default. |
| `MEDIUM_BASE_URL` | `https://medium.com`                                      | Base URL feeds are fetched from (`<base>/feed/@<name>`). |
| `USER_AGENT`      | `medium-rss-wrapper/1.0 (klancic.me; klancic@hotmail.com)` | `User-Agent` header sent to Medium. Set this to identify your own deployment. |

Example `.env`:

```dotenv
PORT=3000
ALLOWED_ORIGIN="http://localhost:4200"
API_CACHE_TTL=900
MEDIUM_BASE_URL="https://medium.com"
USER_AGENT="my-app/1.0 (example.com; me@example.com)"
```

## Docker

Build and run the image locally:

```bash
docker build -t medium-rss-wrapper .
docker run --rm -p 3000:3000 -e ALLOWED_ORIGIN="http://localhost:4200" medium-rss-wrapper
```

The image is based on `node:22-alpine`, installs production dependencies only, and runs as the non-root `node` user. The `.env` file is excluded from the image, so pass configuration with `-e` or `--env-file`.

The [Build and publish Docker image](.github/workflows/docker-publish.yml) workflow builds the image on every push to `main` and publishes it as:

```
ghcr.io/jklancic/medium-rss-wrapper:latest
```

## Notes

- Ensure compliance with Medium's terms of service when making requests.
- Set `USER_AGENT` to reflect your application's identity.
- The cache is in memory, so it is cleared on restart and not shared between instances.

## Dependencies

- [Express](https://expressjs.com/) 5
- [Axios](https://axios-http.com/)
- [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js)
- [node-cache](https://github.com/node-cache/node-cache)
- [cors](https://github.com/expressjs/cors)
- [dotenv](https://github.com/motdotla/dotenv)

## License

This project is licensed under the MIT License. See LICENSE for more information.

## Author

Jernej Klancic

## Contribution

Contributions are welcome! Feel free to submit issues, feature requests, or pull requests.
