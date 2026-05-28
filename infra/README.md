# Local infrastructure

Spin everything the dev environment needs:

```bash
docker compose -f infra/docker-compose.yml up -d
```

| Service | Port(s) | Credentials |
|---|---|---|
| Postgres 16 | 5432 | user `app` / pw `app` / db `app` |
| Redis 7 | 6379 | — |
| MinIO (S3-compatible) | 9000 (API), 9001 (UI) | `minioadmin` / `minioadmin` |
| MailHog | 1025 (SMTP), 8025 (UI) | — |

The MinIO console is at http://localhost:9001 — create buckets `books-files`, `books-covers`, `exports` on first run (the API would do this on boot in production via an init job).

To tear down (preserving data):

```bash
docker compose -f infra/docker-compose.yml down
```

To tear down and wipe volumes:

```bash
docker compose -f infra/docker-compose.yml down -v
```
