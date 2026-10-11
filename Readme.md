# TripleA - Azure Functions TypeScript App

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or 22 LTS | `node -v` to check |
| npm | Bundled with Node | |
| Azure Functions Core Tools | v4 | Provides the `func` command |
| Azure CLI | Latest | Only needed for deployment |

Azurite (the local storage emulator) is installed per-project as a dev dependency, so no global install is needed.

### Installing Azure Functions Core Tools

```bash
# npm (all platforms)
npm i -g azure-functions-core-tools@4 --unsafe-perm true

# macOS
brew tap azure/functions && brew install azure-functions-core-tools@4

# Windows
winget install Microsoft.Azure.FunctionsCoreTools
```

Verify with `func --version` (should print 4.x).

## Getting Started

```bash
git clone <repo-url>
cd <repo-folder>
npm install
cp local.settings.sample.json local.settings.json
npm run dev
```

The app is now running at `http://localhost:7071`. For example, an HTTP function named `hello` is at `http://localhost:7071/api/hello`.

## Local Settings

`local.settings.json` holds local configuration and secrets. It is gitignored, so never commit it. Copy it from `local.settings.sample.json` and fill in real values.

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "POSTGRES_CONNECTION_STRING": "postgres://<user>:<password>@<host>:5432/<database>",
    "POSTGRES_POOL_MAX": "5"
  }
}
```

`AzureWebJobsStorage` is used by the Functions host for internal state (timer schedules, queue checkpoints, leases, Durable Functions).

| Value | When to use |
|---|---|
| `UseDevelopmentStorage=true` | Default. Uses Azurite, started by `npm run dev`. |
| Empty string | HTTP-only apps with `npm run func`. Fails if any non-HTTP trigger exists. |
| A real connection string | Use a **dev** storage account only, never a client's production one. |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the TypeScript compiler in watch mode, Azurite, and `func start` together. Waits for Azurite's ports before starting the host. Ctrl+C stops everything. |
| `npm run func` | Builds once and runs only `func start`, without Azurite. Use for HTTP-only work or when pointing at a real storage account. |
| `npm run fn -- <name> [input] [--http]` | Triggers a single function on demand (see below). |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm run watch` | Compiles in watch mode. |
| `npm run azurite` | Runs Azurite alone. |

### Running a specific function

Start the app with `npm run dev` in one terminal, then in another:

```bash
# Timer trigger: fire it now, ignoring its schedule
npm run fn -- dailyReport

# Queue trigger: the input becomes the message
npm run fn -- processOrder '{"orderId":123}'

# Input from a file
npm run fn -- processOrder @samples/order.json

# HTTP trigger
npm run fn -- hello '{"name":"Commit Crew"}' --http
```

Notes:

- The first argument is the function name as registered in code, for example `app.timer("dailyReport", ...)`, not the file name.
- Non-HTTP functions return `202 Accepted` with an empty body. Output and logs appear in the terminal running the app.
- Set `FUNC_URL` to target a different host or port: `FUNC_URL=http://localhost:7072 npm run fn -- ...`

## Database (PostgreSQL)

The app uses the [`pg`](https://node-postgres.com) driver. [`src/clients/postgres.client.ts`](src/clients/postgres.client.ts) creates one connection pool per worker process on first use and reuses it across invocations. Import from it in services; never create a `Pool` elsewhere.

```ts
import { query, withTransaction } from "../clients/postgres.client";

const users = await query<User>("SELECT * FROM users WHERE id = $1", [id]);   // always parameterize

await withTransaction(async (client) => {                                       // BEGIN/COMMIT, ROLLBACK on throw
  await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amt, from]);
  await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [amt, to]);
});
```

| App setting | Required | Notes |
|---|---|---|
| `POSTGRES_CONNECTION_STRING` | Yes | `postgres://user:password@host:5432/dbname`. For Azure Database for PostgreSQL add `?sslmode=require`. |
| `POSTGRES_POOL_MAX` | No (default 5) | Max connections **per instance**. Total connections = instances × this value, so keep it small on Flex Consumption and stay under the server's connection limit. |

**Local setup:** set `POSTGRES_CONNECTION_STRING` in `local.settings.json` to a Postgres you can reach (a local install or a shared **dev** database, never production), then run `npm run dev`. Check the connection with `curl http://localhost:7071/api/health/db`, which returns `200` with the server time, or `503` with the error.

**In Azure:** set `POSTGRES_CONNECTION_STRING` as an application setting (see Deployment). The `dbHealth` endpoint uses function-level auth, so call it with `?code=<function key>`.

### Table models

There is no ORM (no Sequelize, TypeORM or Prisma). A "model" is a plain interface in `src/types/<table>.types.ts` that mirrors the table's columns, and all SQL for that table lives in `src/repositories/<table>.repository.ts`. Services call repositories and never write SQL. The schema is managed outside this repo, so there are no migrations here. When a table changes, update its row interface and repository. A ready-to-copy example (types, repository, service, function) is in [samples/user-example/](samples/user-example/). It is not compiled, so it needs no table.

## Project Structure

```
.
├── src/
│   ├── functions/       # Entry points only: one file per function (app.http, app.timer, ...)
│   ├── services/        # Business logic, one file per domain (greeting.service.ts, order.service.ts)
│   ├── repositories/    # SQL for one table per file (<table>.repository.ts); the only place queries are written
│   ├── clients/         # Clients for external systems: DB, Storage, Service Bus, third-party APIs
│   ├── config/          # Reading app settings / environment variables (env.ts)
│   ├── constants/       # Shared constant values (index.ts)
│   ├── types/           # Shared TypeScript interfaces, including table row types
│   └── utils/           # Small, generic, stateless helpers (index.ts)
├── scripts/
│   └── run-fn.mjs       # Helper for `npm run fn`
├── samples/             # Sample payloads for `npm run fn`, and samples/user-example/ (table-model pattern, not compiled)
├── dist/                # Compiled output (gitignored)
├── .azurite/            # Local emulator data (gitignored)
├── host.json            # Functions host configuration
├── local.settings.json  # Local secrets (gitignored)
├── local.settings.sample.json
├── package.json
└── tsconfig.json
```

Functions are registered in code with the v4 model. There is no `function.json`. The `main` field in `package.json` points to `dist/src/functions/*.js`, so the project must be built before the host can find any functions. **Only put function registrations in `src/functions/`**, because the host loads every file there.

### Where does my code go?

Dependencies flow one way: `functions → services → repositories → clients`. Any layer can use `config`, `constants`, `types` and `utils`.

| Folder | Put here | Don't put here |
|---|---|---|
| `functions/` | `app.http(...)`/`app.timer(...)` registration and a thin handler: read the input, call a service, return or log the result | Business rules, SQL, SDK calls |
| `services/` | The actual logic of the feature. It takes plain values and returns plain values, so it is easy to unit-test | `HttpRequest`/`InvocationContext` or other Functions types |
| `repositories/` | One file per table or aggregate. Parameterized SQL (`$1`, `$2`) with explicit column lists, returning the row types from `types/`. Uses `query` / `withTransaction` from the Postgres client | Business rules, HTTP concerns |
| `clients/` | Creating and reusing SDK clients (`CosmosClient`, `BlobServiceClient`, axios instances). Create them once at module level so they are reused across invocations | Feature logic |
| `config/` | `requireEnv("DB_CONNECTION")`, so a missing setting fails loudly in one place | Direct `process.env.X` reads scattered through the code |
| `constants/` | Fixed values such as queue names, default values, limits | Secrets (those go in app settings) |
| `types/` | Interfaces and types shared by more than one folder, including one row interface per table that mirrors its columns | Types used by a single file (keep those in that file) |
| `utils/` | Small, pure helpers with no project knowledge (string, date, validation) | Anything that calls a service or a client |

Naming conventions:

- Function files are named after the registered function, in camelCase, e.g. `processOrder.ts` registers `app.storageQueue('processOrder', ...)`.
- Repository files use `<domain>.repository.ts`, service files use `<domain>.service.ts`, client files use `<system>.client.ts`, and type files use `<domain>.types.ts`.
- Each folder exposes shared items through `index.ts`, so imports read `import { X } from "../constants"`.

`hello.ts` → `greeting.service.ts` → `constants` / `utils` is the reference example of this layout.

## Adding a Function

```bash
func new --name myFunction --template "HTTP trigger" --authlevel anonymous
```

Run `func templates list -l typescript` to see other triggers (Timer, Queue, Service Bus, Blob, and so on). `func new` creates the file in `src/functions/`. Keep that file thin and move the logic into a matching file in `src/services/` so it can be unit-tested.

## Deployment

The app targets the **Flex Consumption** plan (Linux).

```bash
az login

az functionapp create -g <resource-group> -n <app-name> \
  --storage-account <storage-account> \
  --flex-consumption-location <region> \
  --runtime node --runtime-version 22

npm run build
func azure functionapp publish <app-name>
```

Application settings (connection strings, API keys) are configured on the Azure function app, not read from `local.settings.json`:

```bash
az functionapp config appsettings set -g <resource-group> -n <app-name> \
  --settings KEY=value
```

For CI/CD, use the `Azure/functions-action` GitHub Action or an Azure DevOps pipeline.

## Troubleshooting

| Problem | Fix |
|---|---|
| `No job functions found` on start | `dist/` is missing or stale. Run `npm run build`. |
| Error that `AzureWebJobsStorage` is required | A non-HTTP trigger exists. Run `npm run dev` or provide a storage connection string. |
| `npm run dev` fails on Azurite startup | Ports 10000-10002 are in use, often by a global Azurite instance. Stop it and retry. |
| `Missing required app setting: POSTGRES_CONNECTION_STRING` | Add it to `local.settings.json` (see the sample file) or to the Azure app settings. |
| `ECONNREFUSED` / connection timeout | The database isn't running or isn't reachable from your machine. Check the host and port in the connection string, and the server's firewall if it's on Azure. |
| `no pg_hba.conf entry` / SSL errors against Azure | Add `?sslmode=require` to the connection string and allow the function app in the server's firewall. |
| Port 7071 already in use | Another `func` instance is running. Stop it, or use `func start --port 7072`. |
| `func: command not found` | Install Core Tools (see Prerequisites) and reopen the terminal. |
| Code changes not picked up | The host normally restarts when `dist/` changes. If not, restart `npm run dev`. |