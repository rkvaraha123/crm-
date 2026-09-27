# Apply the Task 4 health patch

This patch is for an RK Varaha CRM checkout that already contains the Task 4 RBAC implementation.

1. Back up `E:\crm` and preserve your private `E:\crm\.env`.
2. Copy the patch files over the matching paths in `E:\crm`.
3. Do not replace or commit `.env`.
4. Recreate only the API container:

```powershell
cd E:\crm
docker compose -f compose.yaml stop api
docker compose -f compose.yaml rm -f api
docker compose -f compose.yaml up -d --build api
docker compose -f compose.yaml ps
```

5. Verify:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
```

Expected status is `ok`.

If Docker still reports `OCI runtime exec failed`, restart Docker Desktop (or `wsl --shutdown`, then reopen Docker Desktop) and retry. Do not use `docker compose down -v` for this healthcheck problem because it deletes database volumes.
