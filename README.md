# Snip backend

A zero-dependency Bun URL shortener API. Links are stored in memory and are cleared when the server restarts.

## Run

```sh
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it, `BASE_URL` to set the origin used in generated short links, or `RAILWAY_PUBLIC_DOMAIN` to use `https://<domain>` when `BASE_URL` is unset. `BASE_URL` defaults to `http://localhost:<PORT>`.

Set `PUBLIC_DIR` to also serve static files from a directory; `/` serves its `index.html`. Existing files take precedence over matching short codes.

## API

- `POST /api/links` with `{"url":"https://example.com"}` creates a link and returns `201` with `{code, url, shortUrl, hits, createdAt}`. Invalid JSON or non-HTTP(S) URLs return `400` with an `error` field.
- `GET /api/links` returns all links.
- `GET /:code` redirects to the original URL with `302` and increments its hit count; unknown codes return `404`.

The API enables cross-origin browser requests with CORS.
