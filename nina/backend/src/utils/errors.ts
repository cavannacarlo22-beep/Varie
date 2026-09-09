// FILE: backend/src/utils/errors.ts
//
// Un solo tipo di errore applicativo, con un codice stabile che l'app iOS può
// interpretare. Il `message` è pensato per essere mostrato all'utente in
// italiano: l'app può usarlo così com'è quando non ha un testo migliore.

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_USED'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_DISABLED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REUSED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'AI_DAILY_LIMIT'
  | 'INTERNAL';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Devi accedere per continuare.'): AppError {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Non hai i permessi per questa operazione.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Non abbiamo trovato quello che cercavi.'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(code: ErrorCode, message: string, details?: unknown): AppError {
    return new AppError(409, code, message, details);
  }

  static internal(message = 'Qualcosa è andato storto 😅 Riproviamo tra un secondo.'): AppError {
    return new AppError(500, 'INTERNAL', message);
  }
}

/**
 * Traduce gli errori di PostgreSQL in errori applicativi.
 *
 * I codici sono quelli standard di PostgreSQL: 23505 unique_violation,
 * 23503 foreign_key_violation, 23514 check_violation. Intercettarli qui
 * significa che un vincolo del database diventa automaticamente un messaggio
 * sensato per l'utente, senza scrivere controlli duplicati in ogni rotta.
 */
export function translateDatabaseError(error: unknown): AppError | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const pgError = error as { code?: string; constraint?: string; detail?: string };

  switch (pgError.code) {
    case '23505': {
      const byConstraint: Record<string, AppError> = {
        users_email_key: AppError.conflict(
          'EMAIL_ALREADY_USED',
          'Questa email è già registrata. Vuoi accedere?',
        ),
        moods_one_per_day_key: AppError.conflict(
          'CONFLICT',
          'Hai già registrato come stai oggi. Puoi modificarlo.',
        ),
        habit_completions_one_per_day_key: AppError.conflict(
          'CONFLICT',
          'Questa abitudine è già spuntata per oggi.',
        ),
      };
      return (
        (pgError.constraint ? byConstraint[pgError.constraint] : undefined) ??
        AppError.conflict('CONFLICT', 'Questo elemento esiste già.')
      );
    }

    case '23503':
      return AppError.validation(
        'Il collegamento a un altro elemento non è valido: forse è stato cancellato.',
      );

    case '23514':
      return AppError.validation(
        'Alcuni dati non sono validi. Controlla i campi e riprova.',
        pgError.constraint ? { constraint: pgError.constraint } : undefined,
      );

    // 57014: query annullata dallo statement_timeout.
    case '57014':
      return new AppError(
        503,
        'INTERNAL',
        'Il server ci sta mettendo troppo. Riproviamo tra un attimo.',
      );

    default:
      return undefined;
  }
}
