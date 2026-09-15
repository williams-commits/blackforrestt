# Domain package template

Copy this folder to `src/domains/<key>/` and follow the checklist in
`domain.config.ts`, the full workflow in
[`.platform/workflows/new-domain.md`](../../../.platform/workflows/new-domain.md),
and the validation gate `npm run test:domains`.

A domain package owns:

```
src/domains/<key>/
├── domain.config.ts   ← hosts, designs, brand defaults, features (pure data)
└── content.ts         ← typed content assembly (src/content/contracts.ts)
```

What a new domain NEVER brings: its own backend, database, authentication,
trading engine, CRM, or realtime layer — those are shared platform services
(`src/server/**`, `prisma/`, `src/lib/**`, `crm/`).
