![Ren](images/ren-logo.png)

### Putting Ren on your own site

This covers what Ren needs from the page around it (how it can be loaded, the content security
policy, and what it does to the page) and the risks of letting users save reports.

#### Loading it

`ren.js` can go on the page:
- As a classic `<script>`, in the head or the body
- As a `<script type="module">`, or `ren.esm.js` imported as an ES module
- Bundled (`import` of `ren.esm.js`, or `require` of `ren.js`)
- After the page has loaded (injected, lazy-loaded, or by a single-page app), when it starts up
  straight away rather than waiting for `DOMContentLoaded`

However it's loaded, `Ren` is also `window.Ren`, as its elements need it, and
write-excel-file has to be a global (`window.writeXlsxFile`) before it's used.
Nothing else Ren declares is a global, except Prism, which it includes and which sets
`window.Prism`.  A page with its own Prism will find it replaced.

#### Content security policy

These are what a policy has to allow, beyond the scripts and styles themselves:

| Directive | Needed for | Without it |
|---|---|---|
| `script-src 'unsafe-eval'`, or a nonce | Functions written into a report ("Custom..." functions, and those a report's settings add), the page's own format functions and HTML templates, and the library's `custom-format`, which are compiled when they're used | They don't run, and show `#VALUE!` |
| `worker-src blob:` | The parse worker, which parses large data sources off the main thread | Parsing falls back to the main thread, with a warning in the console |
| `style-src 'unsafe-inline'` | The `<style>` elements Ren adds to the page (each visualisation's styles, the drag cursor, and the one hiding `<ren-*>` elements until they're set up), and `style` attributes in its markup | Those styles aren't applied |
| `connect-src` | Each of the page's `endpoints`, and the data sources' URLs | Those requests fail |

The library's own HTML templates and format, calculation and binning functions are compiled by
the build, so a report that uses only those renders without `unsafe-eval`.  Their parameters'
values are passed to them as data, rather than written into their code, and are HTML-escaped for
a function that gives HTML.

Where the policy blocks eval, Ren compiles the rest in a `<script>` element carrying the page's
nonce, so a policy such as `script-src 'self' 'nonce-…'` runs them without `unsafe-eval`.  Ren
reads the nonce from the script it was loaded by, or failing that from any script on the page with
one, so load `ren.js` with the nonce.  Without a nonce it doesn't try.  (Each function Ren compiles
this way is allowed by the nonce, so treat it as allowing a report's code as much as
`unsafe-eval` does.)

Turning rows into objects uses a generated function too, but falls back to building them by
assignment where the policy blocks it.

#### What Ren does to the page

Ren doesn't style the host's own elements: `ren.css` only styles classes starting `ren-`.  (So a
host that relied on Ren's old `body` margin has to set its own.)  Two of its features act on the
whole page, and each has a feature flag in `ren.config` to turn it off:
- `globalErrorHandler: false` stops Ren catching the page's uncaught errors, to log them to
  `renLogInsert` and show its error indicator.  It only catches them at all where `renLogInsert`
  is configured, since otherwise there's nowhere for them to go.  It listens for `error` and
  `unhandledrejection` alongside the page's own handlers rather than replacing them, but a page
  with an error tracker of its own will usually want it off.  Ren doesn't touch `console.error`:
  it logs its own errors itself, so the page's `console.error` calls stay the page's.
- `saveShortcut: false` leaves Ctrl+S to the browser, rather than having it save the report's
  settings.

```json
{ "featureFlags": { "globalErrorHandler": false, "saveShortcut": false } }
```

#### Reports run code

A report's settings can hold code: format, calculation and binning functions, HTML templates, and
parameter values that are code (such as `custom-format`'s).  Ren runs them in the page, with the page's
cookies and access to everything on it.  So where one user can save a report and another can open
it, a saved report is a stored cross-site scripting risk, as the person who saved it can run code
in the browser of anyone who opens it.

That's fine where the people saving reports are trusted to run code on the site anyway.  Where
they aren't, turn off `userFunctions`:

```json
{ "featureFlags": { "userFunctions": false } }
```

Then Ren won't run:
- Functions or HTML written into report settings, or into the function editor (which says it's
  turned off rather than opening)
- Functions that a report's settings add
- Parameter values from report settings that aren't a string, number, boolean or empty
- Parameter values from report settings that are code (declared `{code}`, or written straight
  into a function compiled on the page) with any of ``= ( ) [ ] { } ; ' " ` \`` or a line break
- Parameter values from report settings with a `<`, for a function that doesn't give HTML, as Ren
  shows what a function gives as HTML where it has one

Each of those shows `#VALUE!`.  The library's own functions and templates, and those the page
provides itself (its template and function elements, and `Ren.Extensions` registrations), still
run, as they come with the page rather than with the report.

`userFunctions: false` limits what a report can run; it isn't a sandbox.  In particular:
- It trusts the page's own functions and templates.  One that writes a parameter or a data value
  into the page as HTML can still be used to inject it.
- Other parameter values are passed to a function as data, so they can't leave a string, but
  the check on those that are code is a deny-list of characters.  A function that passes a
  parameter on to something that runs it (`eval`, a `Function`, `innerHTML`) can still be made to
  run it.
- It doesn't cover data.  Ren escapes data values it shows as text, but a template or function
  that shows them as HTML trusts the data source.

A page's own messages can contain HTML: `Ren.PopupMessage(message)` writes `message` into the
page as HTML, so escape anything in it that came from a user or a data source
(`Ren.HtmlUtils.escapeHtml`).
