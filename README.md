# GitHub Issues Tracker

A responsive static frontend for browsing project issues from the Phi Lab API. The app includes a guarded login page, issue status tabs, API-backed search, loading states, and a detail modal for individual issues.

## Live Flow

1. Sign in with the demo admin account.
2. Review all issues by default.
3. Switch between `All`, `Open`, and `Closed`.
4. Search issues with the provided search endpoint.
5. Click any issue card to open the full detail modal.

## Demo Credentials

```text
Username: admin
Password: admin123
```

## Features

- Login gate using `localStorage`
- Responsive dashboard layout
- Four-column card grid on large screens
- Green top border for open issues
- Purple top border for closed issues
- Loading spinner for API requests
- Empty and error states
- Search using the assignment API
- Issue detail modal using the single-issue endpoint

## Tech Stack

- HTML
- CSS
- JavaScript

## Project Files

- [index.html](/c:/Projects/A5-Issue-Tracker/B13-A5-Github-Issue-Tracker/index.html)
- [issues.html](/c:/Projects/A5-Issue-Tracker/B13-A5-Github-Issue-Tracker/issues.html)
- [styles.css](/c:/Projects/A5-Issue-Tracker/B13-A5-Github-Issue-Tracker/styles.css)
- [login.js](/c:/Projects/A5-Issue-Tracker/B13-A5-Github-Issue-Tracker/login.js)
- [issues.js](/c:/Projects/A5-Issue-Tracker/B13-A5-Github-Issue-Tracker/issues.js)

## Run Locally

There is no build step. Open the project with a static server such as VS Code Live Server, then load `index.html`.

## API Endpoints Used

- All issues: `https://phi-lab-server.vercel.app/api/v1/lab/issues`
- Single issue: `https://phi-lab-server.vercel.app/api/v1/lab/issue/{id}`
- Search: `https://phi-lab-server.vercel.app/api/v1/lab/issues/search?q={searchText}`

## JavaScript Questions

### 1. What is the difference between `var`, `let`, and `const`?

`var` is function-scoped and can be redeclared, which makes it easier to accidentally overwrite values. `let` is block-scoped, so it stays inside the nearest braces and is safer for values that will change. `const` is also block-scoped, but it is for bindings that should not be reassigned after creation.

### 2. What is the spread operator (`...`)?

The spread operator lets one array, object, or iterable be expanded into another place. I use it when I want to copy values, merge objects, or pass a list of items into a function without writing each one by hand.

### 3. What is the difference between `map()`, `filter()`, and `forEach()`?

`map()` transforms every item and returns a new array of the same length. `filter()` keeps only the items that pass a condition and returns a smaller or equal-sized array. `forEach()` just runs code for each item and does not build a new array for you.

### 4. What is an arrow function?

An arrow function is a shorter way to write a function expression. It is useful for callbacks and small helper functions, and it also keeps the surrounding `this` value instead of creating a new one.

### 5. What are template literals?

Template literals are strings written with backticks. They make it easier to insert variables with `${value}` and to write multi-line strings without stitching lines together manually.

## Notes

- The login is intentionally simple because this is a frontend-only assignment.
- Search uses the API endpoint first, then the tab buttons filter those returned results.
- The modal fetches the selected issue again so the detail view is based on the single-issue endpoint.
