import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');

describe('Reglas de seguridad Firestore y Storage', () => {
  it('mantiene bloqueo global por defecto en firestore.rules', () => {
    expect(firestoreRules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  });

  it('protege la privacidad de /users, /mailbox y /ballots', () => {
    expect(firestoreRules).toMatch(/match \/users\/\{userId\}[\s\S]*allow list: if isActiveUser\(\);/);
    expect(firestoreRules).toMatch(/match \/mailbox\/\{mailboxId\}[\s\S]*allow list: if isActiveUser\(\);/);
    expect(firestoreRules).toMatch(/match \/mailbox_tracking\/\{trackingCode\}[\s\S]*allow list: if false;/);
    expect(firestoreRules).toMatch(/match \/ballots\/\{ballotId\}[\s\S]*status == 'cerrada'/);
  });

  it('garantiza publicación pública solo para documentos y proyectos publicados', () => {
    expect(firestoreRules).toMatch(
      /match \/documents\/\{documentId\}[\s\S]*existing\(\)\.visibility == 'publico' && existing\(\)\.status == 'publicada'/,
    );
    expect(firestoreRules).toMatch(/match \/document_counters\/\{counterId\}[\s\S]*allow list: if false;/);
  });

  it('impone límites de peso y rol en Firebase Storage', () => {
    expect(storageRules).toMatch(/request\.resource\.size <= 50 \* 1024 \* 1024/);
    expect(storageRules).toMatch(/request\.resource\.size <= 2 \* 1024 \* 1024/);
    expect(storageRules).toMatch(/match \/public\/\{allPaths=\*\*\}[\s\S]*allow write: if isLeaderOrBoard\(\)/);
  });

  it('protege certificados QR, plan anual, iniciativas juveniles y analítica sin cookies', () => {
    expect(firestoreRules).toMatch(/match \/certificates\/\{code\}[\s\S]*allow get: if isValidId\(code\);/);
    expect(firestoreRules).toMatch(/match \/certificates\/\{code\}[\s\S]*allow list: if isActiveUser\(\);/);
    expect(firestoreRules).toMatch(/match \/annual_action_plans\/\{itemId\}[\s\S]*allow get, list: if true;/);
    expect(firestoreRules).toMatch(/match \/youth_initiatives\/\{initiativeId\}[\s\S]*incoming\(\)\.supportCount == 0/);
    expect(firestoreRules).toMatch(/match \/support\/\{deviceId\}[\s\S]*allow list: if false;/);
    expect(firestoreRules).toMatch(/match \/site_analytics\/\{docId\}[\s\S]*allow list: if isBoard\(\);/);
  });

  it('permite edición de perfil público de secretario_admin y valida campos opcionales de gestión', () => {
    expect(firestoreRules).toMatch(/existing\(\)\.role == 'secretario_admin'[\s\S]*'guardianAuthorizationNote'/);
    expect(firestoreRules).toMatch(/function isValidElection[\s\S]*'closesAt'/);
    expect(firestoreRules).toMatch(/function isValidCommitment[\s\S]*'comments'/);
    expect(firestoreRules).toMatch(/function isValidMailboxEntry[\s\S]*'assignedToUid', 'assignedToName', 'history'/);
    expect(firestoreRules).toMatch(/function isValidNews[\s\S]*'scheduledPublishAt'/);
  });

  it('blinda public_directory contra PII, exige Mesa para publicar y permite despublicar al titular', () => {
    expect(firestoreRules).toMatch(
      /match \/public_directory\/\{userId\}[\s\S]*allow create, update: if isValidId\(userId\)[\s\S]*isBoard\(\)[\s\S]*isValidPublicDirectory\(incoming\(\)\)/,
    );
    expect(firestoreRules).toMatch(
      /match \/public_directory\/\{userId\}[\s\S]*allow delete: if isValidId\(userId\) && \(isBoard\(\) \|\| \(isActiveUser\(\) && request\.auth\.uid == userId\)\)/,
    );
    const publicValidatorMatch = firestoreRules.match(/function isValidPublicDirectory\(data\)[\s\S]*?\n    \}/);
    expect(publicValidatorMatch).not.toBeNull();
    const publicValidator = publicValidatorMatch![0];
    expect(publicValidator).toContain("'workAxes'");
    expect(publicValidator).toContain("'achievements'");
    expect(publicValidator).toContain("'skills'");
    expect(publicValidator).toContain("'featuredQuote'");
    expect(publicValidator).not.toContain("'email'");
    expect(publicValidator).not.toContain("'guardianAuthorizationNote'");
    expect(publicValidator).not.toContain("'habeasDataAccepted'");
  });

  it('respalda historial de apariencia, SEO de noticias, SHA-256 documental y encuestas/convocatorias ampliadas', () => {
    expect(firestoreRules).toMatch(/match \/site_content_versions\/\{versionId\}[\s\S]*allow update, delete: if false;/);
    expect(firestoreRules).toMatch(/function isValidNews[\s\S]*'tags',[\s\S]*'seoTitle', 'seoDescription'/);
    expect(firestoreRules).toMatch(/function isValidDocument[\s\S]*'contentSha256'/);
    expect(firestoreRules).toMatch(/function isValidDocumentVersion[\s\S]*'contentSha256'/);
    expect(firestoreRules).toMatch(/function isValidPublicPoll[\s\S]*'questions', 'audience', 'anonymity'[\s\S]*'responseCount'/);
    expect(firestoreRules).toMatch(/function isValidPublicCall[\s\S]*'extraFields'/);
  });
});
