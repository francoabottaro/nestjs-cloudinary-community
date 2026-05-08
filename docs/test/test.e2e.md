# Tests (unit, scripts, e2e)

This repo uses Jest for unit tests and also runs **script tests** and **e2e tests**.

## Install

```bash
yarn install
```

## Unit tests (includes script tests)

```bash
yarn test
```

To run **only** the script tests:

```bash
yarn test:scripts
```

## E2E tests

```bash
yarn test:e2e
```

### Environment

Some tests may require Cloudinary credentials if they hit the real SDK. Ensure these are set if needed by the test suite you’re running:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Common failure modes

- Missing `CLOUDINARY_*` env vars (when running integration-style tests)
- TypeScript build errors (run `yarn lint` / `yarn build` to confirm)
