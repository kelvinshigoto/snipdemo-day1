# Snip

Snip is a small URL shortener with one backend and two clients: an Angular web app and a Node.js CLI. The component branches have independent histories; `main` pins each component commit as a Git submodule.

## Layout

| Path | Branch | Contents |
| --- | --- | --- |
| `backend/` | `backend` | Bun API server |
| `frontend/` | `frontend` | Angular 19 web app |
| `cli/` | `cli` | Zero-dependency Node.js CLI |

Links are stored in an in-memory `Map` and are cleared when the backend restarts.

## API

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/links` | Send `{"url":"https://example.com"}`; returns `201` and `{code, url, shortUrl, hits, createdAt}`. Invalid JSON or non-HTTP(S) URLs return `400`. |
| `GET` | `/api/links` | Returns the array of links. |
| `GET` | `/:code` | Redirects with `302` and increments `hits`; unknown codes return `404`. |

## Clone and run

Clone with submodules initialized; a plain clone leaves the component directories empty:

```sh
git clone --recurse-submodules https://github.com/kelvinshigoto/snipdemo-day1.git
cd snipdemo-day1
```

Run each component in a separate terminal:

```sh
cd backend && bun start
```

```sh
cd frontend && npm install && npx ng serve
```

```sh
cd cli && node cli.js ls
```

The backend listens on port `3000` by default. The frontend development proxy forwards `/api` requests to it. The CLI uses `SNIP_API` or defaults to `http://localhost:3000`.

## Updating a component

Commit and push changes from inside the component submodule, then advance and commit its pointer in the superproject:

```sh
cd backend
git add -A && git commit -m "Describe backend change" && git push
cd ..
git submodule update --remote backend
git add backend && git commit -m "Bump backend submodule" && git push
```

Repeat with `frontend` or `cli` as needed. A superproject commit pins the exact component commit, so pushing a component branch alone does not update `main`.
