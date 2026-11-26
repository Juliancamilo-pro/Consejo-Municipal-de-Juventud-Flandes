import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _schemaReadyPromise: Promise<void> | undefined;
}

function getConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  ).trim();
}

export function hasDatabaseConfig(): boolean {
  if (getConnectionString()) return true;
  return Boolean(
    process.env.SQL_HOST?.trim() &&
      process.env.SQL_USER?.trim() &&
      process.env.SQL_DB_NAME?.trim()
  );
}

function buildPoolConfig(): PoolConfig {
  const connectionString = getConnectionString();
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const pgSslMode = (process.env.PGSSLMODE || '').trim().toLowerCase();
  const envForcesSsl = Boolean(pgSslMode && pgSslMode !== 'disable');

  if (connectionString) {
    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1') ||
      connectionString.includes('/cloudsql/');
    const explicitDisable =
      connectionString.includes('sslmode=disable') || process.env.SQL_SSL === 'false';
    const explicitVerifyFull = connectionString.includes('sslmode=verify-full');

    let sanitizedUrl = connectionString;
    if (!explicitVerifyFull && !explicitDisable) {
      try {
        const parsed = new URL(connectionString);
        const mode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
        if (mode === 'require' || mode === 'prefer' || mode === 'allow') {
          parsed.searchParams.delete('sslmode');
          sanitizedUrl = parsed.toString();
        }
      } catch {
        // Mantener URL original si no es parseable con URL()
      }
    }

    const sslConfig =
      isLocal || explicitDisable
        ? envForcesSsl
          ? { rejectUnauthorized: false }
          : false
        : explicitVerifyFull
          ? true
          : { rejectUnauthorized: false };

    return {
      connectionString: sanitizedUrl,
      ssl: sslConfig,
      max: isServerless ? 5 : 10,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 15000,
    };
  }

  const host = process.env.SQL_HOST;
  const isUnixSocket = Boolean(host && host.startsWith('/'));
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const useSsl =
    process.env.SQL_SSL === 'true' ||
    envForcesSsl ||
    (Boolean(host) && !isUnixSocket && !isLocalHost && process.env.SQL_SSL !== 'false');

  return {
    host,
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: useSsl && process.env.SQL_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    max: isServerless ? 5 : 10,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 15000,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

export async function ensureDatabaseTables(): Promise<void> {
  if (global._schemaReadyPromise) {
    return global._schemaReadyPromise;
  }

  global._schemaReadyPromise = (async () => {
    const tableDefinitions: Array<[string, string]> = [
      [
        'users',
        `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          access_tier TEXT NOT NULL DEFAULT 'tier_4_member',
          role_label TEXT NOT NULL DEFAULT 'Consejero',
          commission_id TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          must_change_password BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'allowed_accounts',
        `CREATE TABLE IF NOT EXISTS allowed_accounts (
          email_hash TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          active BOOLEAN NOT NULL DEFAULT true,
          access_tier TEXT NOT NULL DEFAULT 'tier_4_member',
          role_label TEXT NOT NULL DEFAULT 'Consejero',
          commission_id TEXT NOT NULL DEFAULT '',
          affiliation_type TEXT NOT NULL DEFAULT '',
          affiliation_name TEXT NOT NULL DEFAULT '',
          account_provisioned BOOLEAN NOT NULL DEFAULT false,
          must_change_password BOOLEAN NOT NULL DEFAULT true,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'portal_security',
        `CREATE TABLE IF NOT EXISTS portal_security (
          id TEXT PRIMARY KEY,
          invite_code_hash TEXT NOT NULL,
          initial_password_hash TEXT NOT NULL,
          updated_by_uid TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'portal_settings',
        `CREATE TABLE IF NOT EXISTS portal_settings (
          id TEXT PRIMARY KEY,
          hero_title TEXT NOT NULL,
          hero_subtitle TEXT NOT NULL,
          hero_image_url TEXT NOT NULL DEFAULT '',
          hero_storage_path TEXT NOT NULL DEFAULT '',
          about_text TEXT NOT NULL DEFAULT '',
          mission_text TEXT NOT NULL DEFAULT '',
          vision_text TEXT NOT NULL DEFAULT '',
          contact_email TEXT NOT NULL DEFAULT '',
          contact_address TEXT NOT NULL DEFAULT '',
          active_theme TEXT NOT NULL DEFAULT 'default',
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'public_councilors',
        `CREATE TABLE IF NOT EXISTS public_councilors (
          id TEXT PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          role_label TEXT NOT NULL,
          commission_id TEXT NOT NULL DEFAULT '',
          commission_name TEXT NOT NULL DEFAULT 'Sin comisión',
          affiliation_type TEXT NOT NULL DEFAULT '',
          affiliation_name TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          bio TEXT NOT NULL DEFAULT '',
          photo_url TEXT NOT NULL DEFAULT '',
          photo_thumb_url TEXT NOT NULL DEFAULT '',
          photo_medium_url TEXT NOT NULL DEFAULT '',
          storage_path TEXT NOT NULL DEFAULT '',
          instagram TEXT NOT NULL DEFAULT '',
          facebook TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          display_order INTEGER NOT NULL DEFAULT 50,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'commissions',
        `CREATE TABLE IF NOT EXISTS commissions (
          id TEXT PRIMARY KEY,
          number INTEGER NOT NULL,
          name TEXT NOT NULL,
          icon_name TEXT NOT NULL DEFAULT 'BookOpen',
          accent_color TEXT NOT NULL DEFAULT '#2563EB',
          cover_url TEXT NOT NULL DEFAULT '',
          storage_path TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL,
          coordinator_name TEXT NOT NULL,
          coordinator_uid TEXT NOT NULL DEFAULT '',
          work_plan_summary TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'commission_tasks',
        `CREATE TABLE IF NOT EXISTS commission_tasks (
          id TEXT PRIMARY KEY,
          commission_id TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendiente',
          assigned_name TEXT NOT NULL DEFAULT '',
          due_date TEXT NOT NULL DEFAULT '',
          created_by_uid TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'news_events',
        `CREATE TABLE IF NOT EXISTS news_events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'noticia',
          summary TEXT NOT NULL,
          content TEXT NOT NULL,
          cover_url TEXT NOT NULL DEFAULT '',
          storage_path TEXT NOT NULL DEFAULT '',
          commission_id TEXT NOT NULL,
          event_date TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'publicado',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'gallery_albums',
        `CREATE TABLE IF NOT EXISTS gallery_albums (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          commission_id TEXT NOT NULL DEFAULT '',
          event_date TEXT NOT NULL DEFAULT '',
          cover_url TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'publicado',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'gallery_items',
        `CREATE TABLE IF NOT EXISTS gallery_items (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          media_type TEXT NOT NULL DEFAULT 'image',
          video_source TEXT NOT NULL DEFAULT 'upload',
          url TEXT NOT NULL,
          thumbnail_url TEXT NOT NULL DEFAULT '',
          storage_path TEXT NOT NULL DEFAULT '',
          thumbnail_storage_path TEXT NOT NULL DEFAULT '',
          commission_id TEXT NOT NULL,
          album_id TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          event_date TEXT NOT NULL DEFAULT '',
          mime_type TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'publicado',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'documents',
        `CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          folder TEXT NOT NULL DEFAULT 'General',
          category TEXT NOT NULL,
          version TEXT NOT NULL DEFAULT '1.0',
          version_history JSONB NOT NULL DEFAULT '[]'::jsonb,
          file_url TEXT NOT NULL,
          storage_path TEXT NOT NULL DEFAULT '',
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          visibility TEXT NOT NULL DEFAULT 'privado',
          commission_id TEXT NOT NULL DEFAULT '',
          uploaded_by_uid TEXT NOT NULL,
          uploaded_by_name TEXT NOT NULL,
          approved_by_presidente BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'calls_surveys',
        `CREATE TABLE IF NOT EXISTS calls_surveys (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'convocatoria',
          description TEXT NOT NULL,
          deadline TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'abierta',
          options JSONB NOT NULL DEFAULT '[]'::jsonb,
          response_count INTEGER NOT NULL DEFAULT 0,
          created_by_uid TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'survey_responses',
        `CREATE TABLE IF NOT EXISTS survey_responses (
          id TEXT PRIMARY KEY,
          survey_id TEXT NOT NULL,
          selected_option TEXT NOT NULL,
          respondent_name TEXT NOT NULL,
          respondent_email TEXT NOT NULL DEFAULT '',
          comment TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'contact_messages',
        `CREATE TABLE IF NOT EXISTS contact_messages (
          id TEXT PRIMARY KEY,
          sender_name TEXT NOT NULL,
          sender_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Consulta',
          status TEXT NOT NULL DEFAULT 'nuevo',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'sessions',
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          session_type TEXT NOT NULL,
          date_iso TEXT NOT NULL,
          time_range TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL,
          agenda TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'programada',
          acta_url TEXT NOT NULL DEFAULT '',
          attendance JSONB NOT NULL DEFAULT '{}'::jsonb,
          excuses JSONB NOT NULL DEFAULT '{}'::jsonb,
          check_in_code TEXT NOT NULL DEFAULT '',
          check_in_expires_at TEXT NOT NULL DEFAULT '',
          qr_rotated_at TEXT NOT NULL DEFAULT '',
          quorum_required INTEGER NOT NULL DEFAULT 1,
          created_by_uid TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'actas',
        `CREATE TABLE IF NOT EXISTS actas (
          id TEXT PRIMARY KEY,
          consecutive TEXT NOT NULL,
          year INTEGER NOT NULL,
          title TEXT NOT NULL,
          session_id TEXT NOT NULL DEFAULT '',
          commission_id TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          meeting_date TEXT NOT NULL DEFAULT '',
          time_range TEXT NOT NULL DEFAULT '',
          quorum_count INTEGER NOT NULL DEFAULT 0,
          quorum_required INTEGER NOT NULL DEFAULT 1,
          agenda TEXT NOT NULL DEFAULT '',
          development TEXT NOT NULL DEFAULT '',
          propositions TEXT NOT NULL DEFAULT '',
          commitments_summary TEXT NOT NULL DEFAULT '',
          linked_vote_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          status TEXT NOT NULL DEFAULT 'borrador',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
          comments JSONB NOT NULL DEFAULT '[]'::jsonb,
          history JSONB NOT NULL DEFAULT '[]'::jsonb,
          verification_hash TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'votes',
        `CREATE TABLE IF NOT EXISTS votes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          commission_id TEXT NOT NULL DEFAULT '',
          session_id TEXT NOT NULL DEFAULT '',
          vote_mode TEXT NOT NULL DEFAULT 'nominal',
          majority_type TEXT NOT NULL DEFAULT 'simple',
          options JSONB NOT NULL DEFAULT '[]'::jsonb,
          tallies JSONB NOT NULL DEFAULT '{}'::jsonb,
          nominal_ballots JSONB NOT NULL DEFAULT '{}'::jsonb,
          voter_uids JSONB NOT NULL DEFAULT '[]'::jsonb,
          quorum_required INTEGER NOT NULL DEFAULT 1,
          opens_at TEXT NOT NULL DEFAULT '',
          closes_at TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'abierta',
          result_summary TEXT NOT NULL DEFAULT '',
          deadline TEXT NOT NULL DEFAULT '',
          created_by_uid TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'commitments',
        `CREATE TABLE IF NOT EXISTS commitments (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          responsible_uid TEXT NOT NULL,
          responsible_name TEXT NOT NULL,
          commission_id TEXT NOT NULL,
          due_date TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pendiente',
          progress INTEGER NOT NULL DEFAULT 0,
          created_by_uid TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'ideas_inbox',
        `CREATE TABLE IF NOT EXISTS ideas_inbox (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          commission_id TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'nueva',
          upvoter_uids JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'letter_templates',
        `CREATE TABLE IF NOT EXISTS letter_templates (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          header_text TEXT NOT NULL DEFAULT '',
          body_template TEXT NOT NULL,
          signatory_role TEXT NOT NULL,
          updated_by_uid TEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'work_plans',
        `CREATE TABLE IF NOT EXISTS work_plans (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          axis TEXT NOT NULL,
          commission_id TEXT NOT NULL,
          quarter TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'planeado',
          progress INTEGER NOT NULL DEFAULT 0,
          evidence_count INTEGER NOT NULL DEFAULT 0,
          updated_by_uid TEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'audit_logs',
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_uid TEXT NOT NULL,
          actor_name TEXT NOT NULL,
          actor_role_label TEXT NOT NULL,
          action TEXT NOT NULL,
          module TEXT NOT NULL,
          target_title TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'media_files',
        `CREATE TABLE IF NOT EXISTS media_files (
          id TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          content_base64 TEXT NOT NULL,
          uploaded_by_uid TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'permission_requests',
        `CREATE TABLE IF NOT EXISTS permission_requests (
          id TEXT PRIMARY KEY,
          requester_uid TEXT NOT NULL,
          requester_name TEXT NOT NULL,
          requester_email TEXT NOT NULL,
          requester_role_label TEXT NOT NULL,
          permission_key TEXT NOT NULL,
          permission_label TEXT NOT NULL,
          target_module TEXT NOT NULL,
          target_commission_id TEXT NOT NULL DEFAULT '',
          target_commission_name TEXT NOT NULL DEFAULT '',
          reason TEXT NOT NULL,
          purpose TEXT NOT NULL DEFAULT '',
          duration_type TEXT NOT NULL DEFAULT 'temporal',
          expires_at TEXT NOT NULL DEFAULT '',
          attachment_url TEXT NOT NULL DEFAULT '',
          attachment_name TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pendiente_presidente',
          current_step_order INTEGER NOT NULL DEFAULT 1,
          rejection_reason TEXT NOT NULL DEFAULT '',
          decided_by_name TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'permission_approval_steps',
        `CREATE TABLE IF NOT EXISTS permission_approval_steps (
          id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          step_order INTEGER NOT NULL,
          approver_role TEXT NOT NULL,
          expected_approver_uid TEXT NOT NULL DEFAULT '',
          expected_approver_name TEXT NOT NULL DEFAULT '',
          delegated_from_uid TEXT NOT NULL DEFAULT '',
          delegated_reason TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pendiente',
          decided_by_uid TEXT NOT NULL DEFAULT '',
          decided_by_name TEXT NOT NULL DEFAULT '',
          comment TEXT NOT NULL DEFAULT '',
          reminder_sent_at TEXT NOT NULL DEFAULT '',
          decided_at TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'granted_permissions',
        `CREATE TABLE IF NOT EXISTS granted_permissions (
          id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          user_uid TEXT NOT NULL,
          user_name TEXT NOT NULL,
          user_email TEXT NOT NULL,
          permission_key TEXT NOT NULL,
          permission_label TEXT NOT NULL,
          target_module TEXT NOT NULL,
          target_commission_id TEXT NOT NULL DEFAULT '',
          duration_type TEXT NOT NULL DEFAULT 'temporal',
          expires_at TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          revoked_at TEXT NOT NULL DEFAULT '',
          revoked_by_uid TEXT NOT NULL DEFAULT '',
          revoked_by_name TEXT NOT NULL DEFAULT '',
          revocation_reason TEXT NOT NULL DEFAULT '',
          granted_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'notifications',
        `CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_uid TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'general',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          link_module TEXT NOT NULL DEFAULT '',
          related_id TEXT NOT NULL DEFAULT '',
          read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'dept_proposals',
        `CREATE TABLE IF NOT EXISTS dept_proposals (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          target_entity TEXT NOT NULL,
          thematic_axis TEXT NOT NULL DEFAULT 'Política Pública de Juventud',
          commission_id TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL,
          justification TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'borrador',
          visibility TEXT NOT NULL DEFAULT 'privado',
          publication_status TEXT NOT NULL DEFAULT 'privado',
          public_approved BOOLEAN NOT NULL DEFAULT false,
          rejection_reason TEXT NOT NULL DEFAULT '',
          approved_by_uid TEXT NOT NULL DEFAULT '',
          approved_by_name TEXT NOT NULL DEFAULT '',
          approved_at TEXT NOT NULL DEFAULT '',
          attachment_url TEXT NOT NULL DEFAULT '',
          attachment_name TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'dept_oversight',
        `CREATE TABLE IF NOT EXISTS dept_oversight (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          watched_entity TEXT NOT NULL,
          policy_or_plan TEXT NOT NULL,
          commission_id TEXT NOT NULL DEFAULT '',
          findings TEXT NOT NULL,
          recommendations TEXT NOT NULL DEFAULT '',
          risk_level TEXT NOT NULL DEFAULT 'medio',
          status TEXT NOT NULL DEFAULT 'en_seguimiento',
          visibility TEXT NOT NULL DEFAULT 'privado',
          publication_status TEXT NOT NULL DEFAULT 'privado',
          public_approved BOOLEAN NOT NULL DEFAULT false,
          rejection_reason TEXT NOT NULL DEFAULT '',
          approved_by_uid TEXT NOT NULL DEFAULT '',
          approved_by_name TEXT NOT NULL DEFAULT '',
          approved_at TEXT NOT NULL DEFAULT '',
          evidence_url TEXT NOT NULL DEFAULT '',
          evidence_name TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'dept_reports',
        `CREATE TABLE IF NOT EXISTS dept_reports (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          report_period TEXT NOT NULL,
          session_date TEXT NOT NULL DEFAULT '',
          departamental_space TEXT NOT NULL DEFAULT 'Consejo Departamental de Juventud del Tolima',
          commission_id TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL,
          agreements TEXT NOT NULL DEFAULT '',
          participation_strategies TEXT NOT NULL DEFAULT '',
          visibility TEXT NOT NULL DEFAULT 'privado',
          publication_status TEXT NOT NULL DEFAULT 'privado',
          public_approved BOOLEAN NOT NULL DEFAULT false,
          rejection_reason TEXT NOT NULL DEFAULT '',
          approved_by_uid TEXT NOT NULL DEFAULT '',
          approved_by_name TEXT NOT NULL DEFAULT '',
          approved_at TEXT NOT NULL DEFAULT '',
          attachment_url TEXT NOT NULL DEFAULT '',
          attachment_name TEXT NOT NULL DEFAULT '',
          author_uid TEXT NOT NULL,
          author_name TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
      [
        'session_agenda_proposals',
        `CREATE TABLE IF NOT EXISTS session_agenda_proposals (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          title TEXT NOT NULL,
          justification TEXT NOT NULL,
          proposer_uid TEXT NOT NULL,
          proposer_name TEXT NOT NULL,
          proposer_role_label TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendiente',
          decision_notes TEXT NOT NULL DEFAULT '',
          decided_by_uid TEXT NOT NULL DEFAULT '',
          decided_by_name TEXT NOT NULL DEFAULT '',
          decided_at TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
      ],
    ];

    try {
      const existingRes = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`
      );
      const existingTables = new Set(existingRes.rows.map((r) => r.table_name));

      for (const [tableName, createSql] of tableDefinitions) {
        if (!existingTables.has(tableName)) {
          await pool.query(createSql);
        }
      }

      const colRes = await pool.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()`
      );
      const existingCols = new Set(colRes.rows.map((r) => `${r.table_name}.${r.column_name}`));

      const columnPatches: Array<[string, string]> = [
        ['allowed_accounts.affiliation_type', `ALTER TABLE allowed_accounts ADD COLUMN IF NOT EXISTS affiliation_type TEXT NOT NULL DEFAULT ''`],
        ['allowed_accounts.affiliation_name', `ALTER TABLE allowed_accounts ADD COLUMN IF NOT EXISTS affiliation_name TEXT NOT NULL DEFAULT ''`],
        ['public_councilors.affiliation_type', `ALTER TABLE public_councilors ADD COLUMN IF NOT EXISTS affiliation_type TEXT NOT NULL DEFAULT ''`],
        ['public_councilors.affiliation_name', `ALTER TABLE public_councilors ADD COLUMN IF NOT EXISTS affiliation_name TEXT NOT NULL DEFAULT ''`],
        ['public_councilors.email', `ALTER TABLE public_councilors ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''`],
        ['public_councilors.phone', `ALTER TABLE public_councilors ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`],
        ['public_councilors.photo_thumb_url', `ALTER TABLE public_councilors ADD COLUMN IF NOT EXISTS photo_thumb_url TEXT NOT NULL DEFAULT ''`],
        ['public_councilors.photo_medium_url', `ALTER TABLE public_councilors ADD COLUMN IF NOT EXISTS photo_medium_url TEXT NOT NULL DEFAULT ''`],
        ['sessions.excuses', `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS excuses JSONB NOT NULL DEFAULT '{}'::jsonb`],
        ['sessions.check_in_expires_at', `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS check_in_expires_at TEXT NOT NULL DEFAULT ''`],
        ['sessions.qr_rotated_at', `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_rotated_at TEXT NOT NULL DEFAULT ''`],
        ['votes.session_id', `ALTER TABLE votes ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT ''`],
        ['votes.majority_type', `ALTER TABLE votes ADD COLUMN IF NOT EXISTS majority_type TEXT NOT NULL DEFAULT 'simple'`],
        ['votes.result_summary', `ALTER TABLE votes ADD COLUMN IF NOT EXISTS result_summary TEXT NOT NULL DEFAULT ''`],
        ['documents.version_history', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_history JSONB NOT NULL DEFAULT '[]'::jsonb`],
        ['gallery_items.album_id', `ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS album_id TEXT NOT NULL DEFAULT ''`],
        ['gallery_items.sort_order', `ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`],
        ['gallery_items.event_date', `ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS event_date TEXT NOT NULL DEFAULT ''`],
        ['gallery_items.mime_type', `ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT ''`],
      ];

      for (const [key, alterSql] of columnPatches) {
        if (!existingCols.has(key)) {
          await pool.query(alterSql);
        }
      }
    } catch (err) {
      global._schemaReadyPromise = undefined;
      throw err;
    }
  })();

  return global._schemaReadyPromise;
}
