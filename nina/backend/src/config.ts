// FILE: backend/src/config.ts
//
// Tutta la configurazione passa da qui, e viene validata all'avvio.
// Se manca qualcosa di essenziale il processo non parte: meglio un errore
// chiaro adesso che una richiesta che fallisce in modo incomprensibile fra tre
// settimane.

import 'dotenv/config';

export type NodeEnv = 'development' | 'test' | 'production';
export type AiProvider = 'anthropic' | 'openai' | 'none';

class ConfigError extends Error {
  constructor(message: string) {
    super(`Configurazione non valida: ${message}`);
    this.name = 'ConfigError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new ConfigError(
      `manca la variabile d'ambiente ${name}. ` +
        `Copia backend/.env.example in backend/.env e compilala.`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function integer(name: string, fallback: number): number {
  const raw = optional(name);
  if (raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`${name} deve essere un numero intero, trovato "${raw}"`);
  }
  return parsed;
}

const nodeEnv = (optional('NODE_ENV', 'development') as NodeEnv);
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new ConfigError(`NODE_ENV deve essere development, test o production`);
}

// In produzione un segreto corto è un invito. 32 caratteri è il minimo che
// accettiamo, e lo verifichiamo qui invece di sperare che qualcuno se lo ricordi.
function secret(name: string): string {
  const value = required(name);
  if (nodeEnv === 'production' && value.length < 32) {
    throw new ConfigError(
      `${name} è troppo corto (${value.length} caratteri). ` +
        `Generane uno con: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
  return value;
}

const jwtSecret = secret('JWT_SECRET');
const jwtRefreshSecret = secret('JWT_REFRESH_SECRET');

if (jwtSecret === jwtRefreshSecret) {
  throw new ConfigError(
    'JWT_SECRET e JWT_REFRESH_SECRET devono essere diversi: se un segreto trapela, ' +
      'l\'altro deve continuare a proteggere le sessioni.',
  );
}

const aiProvider = optional('AI_PROVIDER', 'none') as AiProvider;
if (!['anthropic', 'openai', 'none'].includes(aiProvider)) {
  throw new ConfigError(`AI_PROVIDER deve essere anthropic, openai oppure none`);
}

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',

  server: {
    port: integer('PORT', 3000),
    host: optional('HOST', '0.0.0.0'),
    publicBaseUrl: optional('PUBLIC_BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
    corsOrigins: optional('CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  logging: {
    level: optional('LOG_LEVEL', nodeEnv === 'test' ? 'silent' : 'info'),
  },

  database: {
    url: required('DATABASE_URL'),
    // Neon chiude le connessioni inattive: un pool piccolo con timeout brevi
    // funziona meglio di un pool grande che tiene aperte connessioni morte.
    maxConnections: integer('DB_POOL_MAX', 10),
    idleTimeoutMs: integer('DB_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMs: integer('DB_CONNECT_TIMEOUT_MS', 10_000),
    statementTimeoutMs: integer('DB_STATEMENT_TIMEOUT_MS', 15_000),
  },

  auth: {
    jwtSecret,
    jwtRefreshSecret,
    accessTokenTtl: optional('ACCESS_TOKEN_TTL', '15m'),
    refreshTokenTtlDays: integer('REFRESH_TOKEN_TTL_DAYS', 60),
    emailVerificationTtlHours: integer('EMAIL_VERIFICATION_TTL_HOURS', 48),
    passwordResetTtlMinutes: integer('PASSWORD_RESET_TTL_MINUTES', 30),

    // Parametri Argon2id. 19 MiB e 2 passate è la configurazione consigliata
    // da OWASP: resistente e sostenibile su un server piccolo.
    argon: {
      memoryCost: integer('ARGON_MEMORY_KIB', 19_456),
      timeCost: integer('ARGON_TIME_COST', 2),
      parallelism: integer('ARGON_PARALLELISM', 1),
    },
  },

  mail: {
    host: optional('SMTP_HOST'),
    port: integer('SMTP_PORT', 587),
    user: optional('SMTP_USER'),
    password: optional('SMTP_PASSWORD'),
    from: optional('SMTP_FROM', 'Nina <no-reply@localhost>'),
    get enabled(): boolean {
      return optional('SMTP_HOST') !== '';
    },
  },

  ai: {
    provider: aiProvider,
    apiKey: optional('AI_API_KEY'),
    model: optional('AI_MODEL', 'claude-sonnet-5'),
    dailyMessageLimit: integer('AI_DAILY_MESSAGE_LIMIT', 40),
    timeoutMs: integer('AI_TIMEOUT_MS', 20_000),
  },

  sync: {
    // Quante righe al massimo restituisce una singola pagina di /sync/changes.
    maxChangesPerPage: integer('SYNC_MAX_CHANGES', 500),
    // Quante modifiche accetta una singola /sync/push.
    maxPushBatch: integer('SYNC_MAX_PUSH_BATCH', 200),
  },
} as const;

export type Config = typeof config;
