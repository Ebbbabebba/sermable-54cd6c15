# Architecture rules

- Use standalone CSS in `src/styles-foundation.css` for migrated responsive/state primitives and `src/styles-app.css` for semantic app design; no utility-framework compilation is required, preserving established layouts without a styling runtime.
- New screens and controls use descriptive CSS classes and semantic color variables; the migrated `s-*` classes exist only for compatibility with existing screens.
- Compose migrated class overrides through `cn` and its directional conflict table so existing state-dependent styles retain their cascade behavior without Tailwind Merge.
- Retain the existing React, routing, speech-recognition, scheduling, and cloud integrations during visual redesigns so appearance changes cannot alter learning rules.
- Scope shared interface typography through the route wrapper and use dedicated reading-text classes for practice and presentation; this keeps text hierarchy consistent without changing word-state behavior.
- Use the shared `policy-document` class for legal articles with explicit heading, paragraph, and list styles; policy readability must not depend on a removed typography plugin.
- Home overview components consume read-only cloud progress through `useSpeechOverview`; keep visual milestones separate from actual review scheduling so redesigns never overwrite learning dates.
- Bundle the selected interface font locally via Fontsource imports; native offline app rendering must not depend on external font requests.
- Own native practice recognition through `nativeSpeechSession`: serialize restarts, detach listeners before stopping, and trim pre-reset utterance prefixes so audio races cannot replay words or reopen a healthy microphone.
