# Security Specification — Portal CMJ Flandes

## 1. Data Invariants & Role Matrix
1. **Zero PII in public collections**: `public_councilors` exposes only public names, role labels, commissions, bios, and social handles. Survey PII (`survey_responses` emails) and contact inbox (`contact_messages`) are locked strictly behind granular server permissions (`encuestas.ver_respuestas`, `buzon.responder`).
2. **Granular Role Hierarchy & Dynamic Coordinator Scope (`src/lib/permissions.ts`)**:
   - **`Presidente`**: full operational, approval, signature, presidential assignment (`usuarios.asignar_presidencia`), credential rotation, sample purge, and audit oversight.
   - **`Vicepresidente`**: full commission supervision, validations, commitments, votes, portal moderation, and approval step 2/3. Cannot assign `Presidente`, cannot purge database samples, and cannot modify audit logs.
   - **`Secretario`**: sessions, attendance, actas drafting/publishing, official letter templates, surveys, citizen inbox responses, documents, and final approval step 3/3. Cannot assign `Presidente` or rotate credentials unless granted.
   - **`Consejero`**: self-check-in attendance, voting (1 ballot per open vote), own commitments, bank of ideas, own profile, and special permission requests.
   - **Dynamic Commission Coordinator (`commissions.coordinatorUid`)**: any active councilor assigned as coordinator inherits scoped privileges (`comision.editar_propia`, `comision.miembros_gestionar`, `comision.tareas_gestionar`, `comision.reportes_exportar`, `plan_trabajo.editar`, `documentos.subir`, `galeria.gestionar`) strictly scoped to their `commissionId`.
3. **Sequential 3-Step Special Permission Workflow**:
   - Path: `1. Presidente` (`pendiente_presidente`) -> `2. Vicepresidente` (`pendiente_vicepresidente`) -> `3. Secretario` (`pendiente_secretario`) -> `aprobada`.
   - Mandatory non-gibberish justification (>= 100 chars, anti-repetition check, coherent word diversity).
   - **Anti-Self-Escalation & Anti-Self-Approval**: users cannot edit their own role/tier, cannot approve/decide/delegate/revoke their own request or step (`decidedByUid != requesterUid`), and automatic grants are written server-side into `granted_permissions` with automatic deactivation when `expiresAt` passes or when user is suspended/deleted.
4. **Immutable Audit Trail**: `audit_logs` is strictly append-only (`update`/`delete` blocked) with server-verified `actorUid`.
5. **Storage Rules**: Authenticated uploads bounded by strict size and MIME type limits (`image/*` <= 15 MB, `video/*` <= 150 MB, documents <= 30 MB).

## 2. Adversarial Payloads Verified Blocked
1. Unauthenticated access to `/api/private/state`, `/api/permissions/*`, or `/api/survey-responses` -> `401`/`403`
2. `Consejero` calling privileged routes (`POST /api/councilors`, `PATCH /api/portal-settings`, `PATCH /api/actas/:id` status `aprobada`) -> `403 PERMISSION_DENIED_REQUESTABLE`
3. User attempting self-role escalation (`PATCH /api/councilors/:ownUid` with `roleLabel` or `active`) -> `403`
4. `Vicepresidente`/`Secretario` attempting to create/edit/delete a `Presidente` account -> `403`
5. Approver attempting to approve or delegate their own `permission_requests` item -> `403`
6. Skipping approval order (e.g., `Secretario` deciding a `pendiente_presidente` request) -> `409`
7. Coordinator modifying another commission (`PATCH /api/commissions/:otherId` or `/members`) -> `403`
8. Spoofed `actorUid` or modifying/deleting `audit_logs` -> Blocked
9. Suspended/deleted user retaining commission coordinator privileges or active `granted_permissions` -> Auto-revoked on suspension/deletion
10. Temporal grant past `expiresAt` -> Auto-deactivated during session resolution

