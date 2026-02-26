# ARCHIVIA Frontend Delivery

Production-style, frontend-only enterprise UI for:
`ARCHIVIA - SPED Student Records Management System`

## Folder Structure

```text
ARCHIVA/
  assets/
    css/
      main.css
    images/
      SPEDbg.jpg
      SPEDlogo.jpg
    js/
      app.js
      mock-data.js
      services/
        api.js
      pages/
        login.js
        dashboard-admin.js
        dashboard-teacher.js
        students.js
        student-profile.js
        documents.js
        teacher-management.js
        activity-logs.js
        settings.js
  index.html
  dashboard-admin.html
  dashboard-teacher.html
  students.html
  student-profile.html
  documents.html
  teacher-management.html
  activity-logs.html
  settings.html
```

## Pages (Implemented)

- `index.html` (Login)
- `dashboard-admin.html`
- `dashboard-teacher.html`
- `students.html`
- `student-profile.html`
- `documents.html`
- `teacher-management.html`
- `activity-logs.html`
- `settings.html`

## Shared Components and Behaviors

Implemented via `assets/js/app.js`:

- Role guards for protected pages
- Responsive sidebar + mobile overlay/toggle
- Toast stack
- Modal open/close + focus trap
- Error banners + retry support
- Skeleton loading helpers
- Route denied messaging
- Logout flow
- Lazy reveal sections
- Full-page loader
- Reusable table/card/status/person-cell render helpers

## CSS Design System

Defined in `assets/css/main.css` using CSS variables (design tokens):

- Primary: `#1F3A5F`
- Secondary: `#F2C94C`
- Success: `#4CAF50`
- Neutral BG: `#F5F7FA`
- Text: `#2E2E2E`

Patterns included:

- Enterprise card system
- KPI metric cards
- Status badges
- Action buttons
- Dense but readable data tables
- Muted metadata and hierarchy
- Soft shadows and consistent spacing scale

## API Layer (Backend-connected)

`assets/js/services/api.js` provides:

- `login`, `logout`, `me`
- `getStudents`, `createStudent`, `updateStudent`, `deleteStudent`
- `getDocuments`, `uploadDocument`
- `getTeachers`, `addTeacher`
- `getLogs`
- `withRetry`

Example:

```js
// Load students for SY 2026-2027 and Male only
ArchiviaApi.getStudents({ sy: 'SY 2026-2027', sex: 'Male', q: '' })
  .then(rows => console.log(rows));
```

## Quality Status

- Lint clean:
  - `npm run lint:js`
  - `npm run lint:css`
  - `npm run lint:html`
- Demo-ready frontend build
- Backend required for data
