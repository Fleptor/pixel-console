# Pixel recovery console

The Save Pixel Computer Society CTF-like mini-ARG.

The console is published at https://belalhamdan.com/pixel-console/ by the
GitHub Pages workflow. Only the public HTML, CSS, JavaScript, and audio are
included in the Pages artifact.

Players recover four fragments from the diagnostic archive and use
`submit [frag1] [frag2] [frag3] [frag4]`. No terminal login is required.
The editable role cookie is an intentional puzzle mechanic. The `admin_token`
command forwards its value to the verifier to request the final fragment.

## Verification service

`netlify/functions/verify.js` runs on the separate Netlify project
`pixel-console-verifier`. Expected fragments are loaded from the Netlify secret
environment variable `PIXEL_EXPECTED_FRAGMENTS`, a JSON array of four strings
in recovery order. Set it through Netlify's environment-variable settings;
never put solution values in code, tests, build output, or Git history.

The function handles `POST` requests with either
`{ "action": "verify", "frags": [...] }` or
`{ "action": "admin_token", "role": "..." }`. Verification returns only
boolean checks and overall success. Fragment disclosure requires the puzzle's
admin role. Browser requests are allowed from `https://belalhamdan.com`.

Run backend checks with `node --test tests/verify.test.cjs`. Tests use synthetic
fixtures, never the real puzzle answers.

Deploy backend changes from this directory with:

```sh
netlify deploy --site pixel-console-verifier --prod --no-build --context production
```

Deploy the backend before pushing dependent frontend changes to `main`.
Environment-variable changes also require a new backend deploy. GitHub Pages
publishes the frontend automatically on pushes to `main`.
