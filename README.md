# X-Camp homework debugging form

An independent, responsive redesign of the existing X-Camp homework debugging Google Form. It is a static site for GitHub Pages, with no build step or application server.

## Run and check

With Node.js and Python 3 installed:

```sh
npm start
```

Open `http://127.0.0.1:4173`. Run the automated checks with `npm test`. The tests cover field mapping, report formatting, source preservation in serialization, validation, safe review rendering, and final POST behavior with a simulated DOM. They do not submit a request to Google.

## Submission behavior

The guided form keeps the original six required questions. Optional language, issue, and debugging context are combined with the source code in the original form’s code answer. On the final send, the browser posts directly to Google Forms and opens Google’s response page. That page shows the actual submission confirmation or error; this site does not display an assumed success message.

The destination and entry IDs are in `submission.js`. These were checked against the public responder form. This direct POST follows the form’s current HTML interface, which is not a documented Google Forms submission API. If the original form changes its questions, permissions, or availability, check the mappings and submission behavior again. The original form is linked throughout as a fallback.

No live response was submitted during development, so receipt by the TA team has not been independently verified. The reply window shown on the site comes from the original form.

## Data and files

Drafts stay in the current page’s memory. There is no local-storage or server-side draft persistence; reloading or closing the page can lose the draft. Loading a code file reads it on the visitor’s device. Downloading a request copy creates a local text file. Student details and code are sent to the original Google Form only when the visitor chooses the final send button.

The site uses Google Fonts with system fallbacks. It contains no analytics or application backend.

## Publish with GitHub Pages

Publish this directory from the repository’s `main` branch and `/ (root)` folder in **Settings → Pages**. The `.nojekyll` file keeps the static files unchanged. All local asset paths are relative, so the site works under a repository Pages path.

Keep `index.html`, `styles.css`, `app.js`, `submission.js`, `favicon.svg`, and `.nojekyll` together. Update `index.html` for wording and form layout, `styles.css` for appearance, and `submission.js` for the submission destination and payload mapping. Re-run `npm test` after changing field names or submission logic.
