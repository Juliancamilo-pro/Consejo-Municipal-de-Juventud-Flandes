# Security Specification — Portal CMJ Flandes

## 1. Data Invariants & Role Matrix
1. **Zero PII in public collections**: `public_councilors` exposes only public names, role labels, commissions, bios, and social handles. `allowed_accounts/{emailHash}` uses SHA-256 hex IDs with `allow list: if false` so emails cannot be enumerated.
2. **Role Hierarchy (no privileged escalation)**:
   - Leadership (`Presidente`, `Vicepresidente`, `Secretario`): full read/write management of users, commissions, sessions, votes, documents, portal content, and audit logs.
   - `Consejero`: can update own profile (`bio`, `photoUrl`, `instagram`, `facebook`, `fullName`), self-check-in attendance on active sessions, cast 1 ballot per open vote, manage tasks in commissions, upload evidence/documents (internal/pending approval), submit ideas, and update own commitments.
3. **Self-Healing Account Provisioning**: An authenticated user in `allowed_accounts/{emailHash}` (or the bootstrap Secretary `trujillogordilooo@gmail.com`) can repair missing `roles/{uid}`, `public_councilors/{uid}`, and `councilor_private/{uid}` records ONLY for their own UID and matching their allowlisted `accessTier` / `roleLabel`.
4. **Immutable Audit Trail**: `audit_logs/{logId}` is append-only (`allow update, delete: if false`) with `actorUid == request.auth.uid`.
5. **Storage Rules**: Public reads for published assets; authenticated password-provider writes bounded by strict file size and MIME type limits (`image/*` <= 15 MB, `video/*` <= 150 MB, documents <= 30 MB); deletions allowed for owners and leadership.

## 2. Adversarial Payloads Verified Blocked
1. Unauthenticated `list` on `/allowed_accounts` -> `PERMISSION_DENIED`
2. Unauthenticated `get` on `/portal_security/leader_config` -> `PERMISSION_DENIED`
3. `Consejero` creating/updating `/roles/{uid}` with `accessTier: "tier_3_sec"` -> `PERMISSION_DENIED`
4. `Consejero` modifying `accessTier` or `roleLabel` in `/councilor_private/{uid}` -> `PERMISSION_DENIED`
5. Shadow field injection on `/news_events/{id}` or `/commission_tasks/{id}` -> `PERMISSION_DENIED`
6. Unauthenticated `list` on `/documents` without `visibility == 'publico'` -> `PERMISSION_DENIED`
7. `Consejero` casting a second vote on `/votes/{voteId}` -> `PERMISSION_DENIED`
8. Spoofed `actorUid` on `/audit_logs/{id}` -> `PERMISSION_DENIED`
9. Oversized or invalid document IDs -> `PERMISSION_DENIED`
10. Public caller setting `status: 'publicado'` or `approvedByPresidente: true` -> `PERMISSION_DENIED`
