# Local infrastructure

Spin everything the dev environment needs:

```bash
docker compose -f infra/docker-compose.yml up -d
```

| Service | Port(s) | Credentials |
|---|---|---|
| Postgres 16 | 5432 | user `app` / pw `app` / db `app` |
| MongoDB 7 (GridFS for files) | 27017 | user `app` / pw `app` |
| Redis 7 | 6379 | — |
| MailHog | 1025 (SMTP), 8025 (UI) | — |

MongoDB stores book files via GridFS. No bucket pre-creation needed; the API's first upload auto-creates the GridFS collections.

To tear down (preserving data):

```bash
docker compose -f infra/docker-compose.yml down
```

To tear down and wipe volumes:

```bash
docker compose -f infra/docker-compose.yml down -v
```
