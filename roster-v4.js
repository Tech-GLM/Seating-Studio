'use strict';
/* Latest teacher-supplied roster, 2026-09-22. Loaded after floor-points.js.
   Preserve stable roster IDs; do not silently assign a transferred student the
   seat previously occupied by someone else in a different class. */
(() => {
  const updated = {
    '9A': ['Isabella','Martin','Maria Adelaida','Lucas','Matias','Alejandro','Samuel','David','Emilia','Maria Camila','Juana','Juliana','Pablo','Lorenzo','Juan Sebastian','Maria Jose','Mariana','Juan Jose','Sofia','Maria Del Rosario'],
    '9B': ['Antonia C','Elena','Samuel','Maria Antonia','Antonia G','Santiago','Julieta','Gabriela','Jose Jacobo','Antonia A','Mariana','Matías','Valentina','Juana','Salomon','Jacobo O','Sofia','Jacobo P','Tomas'],
    '9C': ['Mariana B','Sara Sofia','Juan Sebastián','Alejandro','Isabella F','Jeronimo','Matias','Lucia','Belen','Isabella L 9C Dianita','Sara','Ana Lucia','Maria Jose','Juan Diego','Mariana T','Pablo','Emmanuel','David','Catalina']
  };
  for (const [grade, names] of Object.entries(updated)) {
    if (GROUPS[grade]?.length !== names.length) throw Error(`Roster length mismatch in ${grade}`);
    GROUPS[grade].forEach((student, i) => {
      student.name = names[i];
      student.label = names[i];
    });
  }

  // The old versions assigned these IDs to different students. Remove only
  // those four obsolete assignments; everyone else keeps their exact seat.
  const moved = {'9A': new Set(['9A-3']), '9B': new Set(['9B-4']),
                 '9C': new Set(['9C-8','9C-12'])};
  const flag = 'glm-grade9-roster-v4-applied';
  function removeObsoleteAssignments(data) {
    let removed = 0;
    for (const [grade, room] of Object.entries(data)) {
      for (const spot of room.spots) {
        if (moved[grade].has(spot.id)) { spot.id = null; removed++; }
      }
    }
    return removed;
  }
  function markCurrent(data) {
    Object.values(data).forEach(room => { room.rosterRevision = 4; });
    return data;
  }

  // Imported older backups are not roster-aware. A version-3 backup exported
  // by this build carries rosterRevision=4 on every room, so restored seating
  // is not cleared a second time.
  const originalValidate = validateV2;
  validateV2 = function (payload) {
    const result = originalValidate(payload);
    const isCurrent = Object.keys(updated).every(grade => payload.rooms?.[grade]?.rosterRevision === 4);
    if (!isCurrent) removeObsoleteAssignments(result);
    return markCurrent(result);
  };
  const originalLegacy = fromLegacy;
  fromLegacy = function (payload) {
    const result = originalLegacy(payload);
    removeObsoleteAssignments(result);
    return markCurrent(result);
  };

  let firstOpen = true;
  try { firstOpen = localStorage.getItem(flag) !== 'done'; } catch (error) { console.warn('Roster migration marker unavailable:', error); }
  if (firstOpen) {
    const removed = removeObsoleteAssignments(rooms);
    markCurrent(rooms);
    save();
    try { localStorage.setItem(flag, 'done'); } catch (error) { console.warn('Could not save roster migration marker:', error); }
    if (removed) toast(`${removed} transferred student(s) now need new seating assignments in their new groups.`);
  } else markCurrent(rooms);

  // This rendering also updates the printed map and the searchable roster.
  render();
})();
