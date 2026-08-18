# PayNest v1 Rebuilt
Architecture-first rebuild from the supplied PayNest project.

- Single LocalStorage key: `paynest_v1_data`
- Migration + normalization pipeline
- Central calculation engine
- Firebase/Auth/Firestore separated from UI
- PWA registration separated
- New Firebase accounts do NOT silently receive old LocalStorage data
- Existing `index.legacy.html` is retained as a UI reference

Before Firebase use, replace placeholders in `js/services/firebase.js`.
Next migration step: move the existing Contract/Customer/Payment UI into `app.js` without changing the data model.
