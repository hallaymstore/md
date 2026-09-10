# Build report — v2.8.2

## Fixed
- SVG progress orbit animation no longer gets disabled on ordinary 4-core devices.
- SVG rotation uses `transform-box: view-box` + centered transform origin for Chromium/Edge reliability.
- Added a lightweight rotating orbit dot so motion is visually clear without animated card backgrounds.
- Initial SVG progress arc animates from 0 to the current percentage.
- Low-end mode only triggers for Save-Data or very low-end (<=2 cores AND <=2 GB deviceMemory) devices; SVG orbit slows instead of disappearing.
- Offscreen/hidden-tab motion still pauses for efficiency.

## Role-aware profiles
- Non-student profiles now render role-specific statistics and professional details for superadmin, tech, management, magistracy, dean, department, supervisor and teacher.
- Optional staff fields: position, academic degree, academic title, office.
- Student-role account without a linked Student record shows a clear role/profile mismatch warning; superadmin gets a direct role-correction link.

## Static validation
- 68 JavaScript files passed `node --check`.
- 57 EJS templates passed delimiter balance validation.
- Full EJS runtime smoke test was not executed in the build container because dependencies are intentionally not bundled; run `npm install` then `npm test` on the target machine.
