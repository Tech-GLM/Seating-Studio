# Classroom Seating Studio · Tech-GLM

A lightweight, browser-local seating planner for a **hexagonal classroom**. Teachers create their own courses and paste their own student rosters at runtime; **no student names are embedded in the repository**.

## Features

- Create multiple courses with custom names.
- Paste or edit rosters (one student per line recommended; a single comma-separated line also works).
- Duplicate names are preserved and numbered automatically in the planner.
- Separate seating plan and desk geometry for every course.
- Configure rows, columns, and 1–60 desk spots.
- Drag desk spots for fine alignment or use arrow keys for precision.
- 4–8 shared A–H floor reference points to help return furniture to consistent physical positions.
- Drag student names to desks, click-to-assign, swap occupied desks, and return students to the roster.
- Search the roster and optionally display already-seated students.
- Print the selected course map.
- Autosave in browser `localStorage`.
- Export/import a complete JSON backup.
- No dependencies, build step, backend, account, or analytics.

## Privacy model

The public source contains **no roster**. Course names, student names, desk assignments, and floor-point positions live only in the browser's local storage unless a teacher explicitly exports a JSON backup.

Exported backups **do contain student names**. Store them only in an approved, access-controlled location.

Clearing browser/site data removes locally saved courses unless a backup has been exported.

## Run locally

Open `index.html` in any current desktop browser. No server is required.

## GitHub Pages

This project is static and can be published directly with GitHub Pages from the repository root on the `main` branch.

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save.

## Classroom geometry

The map is based on a six-sided classroom with each wall approximately 6 m long, a board along the lower/front side of the diagram, and two right-side door reference areas. It is schematic only.

Always verify actual desk dimensions, accessible paths, walking space, and door/exit clearance before using a printed arrangement.

## Files

- `index.html` — accessible application shell.
- `style.css` — responsive layout and print styles.
- `app.js` — course/roster management, seating, desk geometry, floor markers, local storage, and backup import/export.

## License

MIT. See `LICENSE`.
