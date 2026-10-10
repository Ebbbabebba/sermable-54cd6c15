# Architecture rules

- Use standalone CSS in `src/styles-foundation.css` for migrated responsive/state primitives and `src/styles-app.css` for semantic app design; no utility-framework compilation is required, preserving established layouts without a styling runtime.
- New screens and controls use descriptive CSS classes and semantic color variables; the migrated `s-*` classes exist only for compatibility with existing screens.
- Compose migrated class overrides through `cn` and its directional conflict table so existing state-dependent styles retain their cascade behavior without Tailwind Merge.
- Retain the existing React, routing, speech-recognition, scheduling, and cloud integrations during visual redesigns so appearance changes cannot alter learning rules.
