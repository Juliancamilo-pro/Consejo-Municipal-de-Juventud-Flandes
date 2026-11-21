# Especificación de Seguridad Firestore — CMJ Flandes (2026–2029)

## 1. Invariantes de Datos y Control de Acceso (RBAC)
1. **Separación de PII**: Los correos electrónicos en `/users/{uid}` solo pueden ser leídos por el propio dueño o por usuarios activos con rol `secretario_admin`, `presidente` o `vicepresidente`. El directorio público `/public_directory/{uid}` no contiene correo ni datos sensibles.
2. **Cuenta inamovible del Administrador**: Un documento `/users/{uid}` con `role == 'secretario_admin'` nunca puede ser eliminado ni degradado a otro rol ni suspendido.
3. **Bootstrap único**: `/settings/bootstrap` solo se crea una vez (`!exists(...)`). Nadie puede volver a asignarse `secretario_admin` tras la activación inicial.
4. **Cuentas pendientes y suspendidas**: Todo consejero recién registrado entra con `status == 'pendiente'` y `role == 'consejero'`. Un usuario `pendiente` o `suspendido` no puede leer colecciones internas ni votar ni crear contenido.
5. **Voto secreto y único**: En `/elections/{electionId}`, un consejero activo solo puede votar si la elección está `abierta`, escribe atómicamente su recibo `/ballot_receipts/{request.auth.uid}` (si no existía) y una papeleta anónima `/ballots/{ballotId}` sin `uid`. Las papeletas solo se leen cuando `status == 'cerrada'`.
6. **Buzón sin enumeración**: Los ciudadanos pueden radicar en `/mailbox` y `/mailbox_tracking/{trackingCode}` (creación validada), pero `list` en `/mailbox` está restringido a consejeros activos, y `list` en `/mailbox_tracking` está prohibido (`allow list: if false`) para evitar raspado de radicados.
7. **Auditoría inmutable**: `/audit_logs` solo permite `create` por usuarios autenticados con `actorUid == request.auth.uid` y `createdAt == request.time`. `update` y `delete` están prohibidos incluso para el administrador.

## 2. Payloads Adversarios ("Dirty Dozen")
1. Auto-asignación de rol `secretario_admin` al crear perfil tras bootstrap existente -> **DENIED**.
2. Cambio propio de `role` o `status` de `pendiente` a `activo` por parte de un consejero -> **DENIED**.
3. Eliminación o degradación del documento `users/{adminUid}` por parte de `presidente` -> **DENIED**.
4. Lectura de `/users` (lista con correos) por usuario no autenticado o `pendiente` -> **DENIED**.
5. Lectura de documentos internos (`visibility == 'interno'`) o borradores por usuario anónimo -> **DENIED**.
6. Doble voto en `/elections/{id}/ballots` cuando ya existe `ballot_receipts/{uid}` -> **DENIED**.
7. Lectura de papeletas `/elections/{id}/ballots` mientras la elección está `abierta` -> **DENIED**.
8. Actualización de estado terminal (`status == 'cerrada'`) en votación o `status == 'archivada'` por no-admin -> **DENIED**.
9. Inyección de campos sombra (`isVerified: true`) en creación de noticia o usuario -> **DENIED**.
10. ID de documento malicioso > 128 caracteres o con barras `/` -> **DENIED**.
11. Falsificación de `createdAt` o `authorUid` distinto a `request.auth.uid` -> **DENIED**.
12. `list` sobre `/mailbox_tracking` para enumerar códigos ciudadanos -> **DENIED**.
