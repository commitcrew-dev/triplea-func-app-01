# Users example (not compiled, not registered)

Reference for the table-model pattern. These are `.ts.sample` files so `tsc` and the Functions host ignore them.

To use it for a real table: copy each file into the matching folder, drop the `.sample` suffix, and rename the table and columns.

| Sample | Copy to |
|---|---|
| `user.types.ts.sample` | `src/types/<table>.types.ts` |
| `user.repository.ts.sample` | `src/repositories/<table>.repository.ts` |
| `user.service.ts.sample` | `src/services/<table>.service.ts` |
| `getUser.ts.sample` | `src/functions/<name>.ts` |
