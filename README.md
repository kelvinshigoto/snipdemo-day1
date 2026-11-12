# Snip CLI

A zero-dependency Node.js command-line client for the Snip URL shortener.
Node.js 20 or newer is required for the built-in `fetch` API.

Set `SNIP_API` to the backend origin when it is not running at
`http://localhost:3000`.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

The `snip` shell, `snip.cmd`, and `snip.ps1` wrappers forward their arguments
to `cli.js`.
