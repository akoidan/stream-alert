---
trigger: always_on
description: 
globs: 
---

- use yarn instead of npm
- DO not install any additional dependencies. If they are required ask me before installing them
- do not use npx, use yarn script section to run nodejs files
- In Node.js native `.cc` files, use **throw Napi::Error::New** to signal failure instead of implementing functions that return `false` to indicate errors.
- Use `yarn cmake` as the standard way to build the native project.