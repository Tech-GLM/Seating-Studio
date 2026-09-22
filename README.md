# Grade 9 · Hexagonal Seating Studio

Teacher-only, offline-capable seating planner for 9A, 9B and 9C. The hexagonal room follows the supplied drawing: board along the bottom/front wall, 9A door on the lower right, and 9B/9C door on the upper right. Each of the six walls is approximately 6 m; desk sizes and clearances are **schematic, not surveyed measurements**.

## Start

Download the classroom ZIP or repository as a ZIP and extract it. Open `index.html` in a browser with `app.js`, `style.css`, `floor-points.js`, `floor-points.css`, and `roster-v4.js` next to it. No installation, server, or internet connection is needed.

## Roster (current revision 4)

The roster has **20 names in 9A, 19 in 9B and 19 in 9C**. The authoritative current names are listed in `roster-v4.js`, loaded **after** the base app and floor-marker enhancement. This retains all existing desk layout and floor reference features. `Isabella L 9C Dianita` is displayed literally as provided.

Four students moved between groups: `Lucia` and `Maria Adelaida` swap between 9A and 9C, and `Ana Lucia` and `Maria Antonia` swap between 9B and 9C. The **first time** this revision opens an older plan on a device, their four obsolete ID-based assignments are removed while keeping every other student in the same desk and retaining room geometry and shared floor points. Reassign those students in their new groups. Current backups carry a `rosterRevision: 4` marker; older imported backups are migrated the same way so that a former student is never silently replaced by a different student in a desk.

## Desk spots and physical floor anchors

Choose a group, then set **Rows**, **Columns**, and **Desk spots** and click **Apply grid**. You can move desks individually in **Move desks** mode and assign students by dragging names or by selecting a name followed by a desk. Swapping occupied desks works the same way. A group keeps its own desk geometry and seating assignments.

The six default **physical floor reference points** (A–F) are located at back left, back right, front left, front right, back center, and front center. The references are floor **marks, not desks**. Set any count between 4 and 8, or use **Move floor points** to drag the lettered anchors to a workable position; arrow keys offer finer adjustment. The floor markers are **shared by all three groups** so that you need only one set of physical marks in the actual classroom. Use school-approved removable tape or stickers with the same letters. Keep markers visible between desks and outside walking routes, door approaches, and accessible pathways. If the actual geometry differs, move the anchors before marking the physical floor. A printable map includes the letters and a legend.

The map does not supply exact measured coordinates. Check desk widths, physical distances, access and emergency clearances on site before positioning furniture or applying floor markers. Floor reference descriptions (e.g., “back left”) describe the starting positions; a moved marker keeps its letter even if moved to another zone.

## Saving, printing, and privacy

The browser saves each group's layout and the shared reference points automatically **on that device only**. **Export backup** writes a version-3 JSON with desk layouts, student assignments, floor reference coordinates and a roster-revision marker on every room. **Import backup** accepts versions 1, 2 and 3; importing an older backup restores its desks and uses the default six floor points. **Print map** prints the currently selected group, including floor reference marks.

**Create the new Tech-GLM repository as private.** Source files include student names and class assignments. Only give access to authorized school staff. Backups also contain seating assignments; store them in school-approved, access-controlled storage. Avoid public GitHub Pages and do not distribute this version outside authorized staff. The tool has no backend and does not transmit seating plans to an external server.


## Upload as a new Tech-GLM repository

Create a **private** GitHub repository in the Tech-GLM organization named `Hexagonal-Seating-Studio`. Upload all seven files from this folder to the repository root, **not** the outer ZIP. Keep the default `main` branch. Open `index.html` after downloading a repository ZIP to run the app locally. GitHub Pages is not required and may make a site accessible outside the private repository.
