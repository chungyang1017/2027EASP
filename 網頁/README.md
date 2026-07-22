# EASP 2027 — Conference Website

Website for the **2027 International Conference of the East Asian Social Policy
(EASP) research network**.

This is a lightweight static site (plain HTML / CSS / JavaScript — no build step)
designed to be hosted for free on **GitHub Pages**.

## 🌐 Live site

Once GitHub Pages is enabled, the site is published at:

```
https://chungyang1017.github.io/2027EASP/
```

## 📁 Structure

| File          | Purpose                                  |
| ------------- | ---------------------------------------- |
| `index.html`  | All page content (single-page site)      |
| `styles.css`  | Styling and responsive layout            |
| `script.js`   | Mobile menu + scroll reveal animations   |
| `.nojekyll`   | Tells GitHub Pages to skip Jekyll        |

## ✏️ How to edit

Open `index.html` and replace the placeholder text. Look for:

- **Dates** — search for `TBA` and fill in real deadlines / conference dates.
- **Venue** — host institution, city, travel & accommodation.
- **Theme** — the official 2027 conference theme.
- **Speakers** — keynote names and affiliations.
- **Registration form** — currently a placeholder. Connect it to Google Forms,
  Mailchimp, or [Formspree](https://formspree.io) to collect real responses.
- **Contact email** — replace `info@example.org` in the footer.

## 🚀 Deploy / update

After editing, push your changes:

```bash
git add -A
git commit -m "Update conference details"
git push
```

GitHub Pages redeploys automatically within a minute or two.

## 💻 Preview locally

Just open `index.html` in a browser, or run a tiny local server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
