# Snip Frontend

The Angular 19 client creates short links and lists their visit counts through the Snip API.

## Run locally

Start the backend on port 3000, then run:

```bash
npm install
npx ng serve
```

Open `http://localhost:4200`. The development proxy forwards `/api` requests to `http://localhost:3000`; the built UI uses relative API URLs so it works from the bundled backend on the same origin.

## Build and test

```bash
npx ng build
npx ng test --no-watch --browsers=ChromeHeadless
```

The release build is written to `dist/snip-frontend/browser`.
