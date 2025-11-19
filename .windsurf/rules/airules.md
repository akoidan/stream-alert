---
trigger: always_on
---

- When writing or showing command-line examples, always use **PowerShell syntax**.
- In Node.js native `.cc` files, use **throw Napi::Error::New** to signal failure instead of implementing functions that return `false` to indicate errors.
- Do **not** use the `aa && bb` chaining syntax in PowerShell commands, because PowerShell does not support this operator.
- Use `yarn build` as the standard way to build the native project.