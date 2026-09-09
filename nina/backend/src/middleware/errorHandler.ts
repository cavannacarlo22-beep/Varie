// FILE: backend/src/middleware/errorHandler.ts
//
// Un solo punto in cui gli errori diventano risposte HTTP.
//
// Forma della risposta, sempre la stessa:
//   { "error": { "code": "NOT_FOUND", "message": "…", "details": … } }
//
// L'app iOS decide cosa fare guardando `code` (stabile) e può mostrare
// `message` (già in italiano, già nel tono giusto) quando non ha un testo
// migliore da usare.

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, translateDatabaseError, type ErrorCode } from '../utils/errors.js';
import { config } from '../config.js';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

function body(code: ErrorCode, message: string, details?: unknown): ErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/**
 * Rende leggibile un errore di validazione di Fastify.
 *
 * Fastify produce messaggi come "body/email must match format \"email\"".
 * Li trasformiamo in qualcosa che si può mostrare a una persona.
 */
function humanizeValidation(error: FastifyError): { message: string; details: unknown } {
  const issues = (error.validation ?? []).map((issue) => {
    const field = issue.instancePath.replace(/^\//, '').replace(/\//g, '.') || 'richiesta';
    return { field, rule: issue.keyword, message: issue.message ?? '' };
  });

  const first = issues[0];
  const readable: Record<string, string> = {
    required: 'manca un campo obbligatorio',
    format: 'il formato non è valido',
    minLength: 'è troppo corto',
    maxLength: 'è troppo lungo',
    minimum: 'è troppo piccolo',
    maximum: 'è troppo grande',
    enum: 'ha un valore non ammesso',
    type: 'ha un tipo non valido',
    pattern: 'non ha il formato richiesto',
  };

  const explanation = first ? (readable[first.rule] ?? 'non è valido') : 'non è valida';
  const where = first && first.field !== 'richiesta' ? `Il campo "${first.field}"` : 'La richiesta';

  return { message: `${where} ${explanation}.`, details: issues };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    void reply
      .status(404)
      .send(body('NOT_FOUND', `Non esiste niente su ${request.method} ${request.url}.`));
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 1. Errori applicativi: già pronti, con messaggio pensato per l'utente.
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, 'Errore applicativo');
      }
      return reply
        .status(error.statusCode)
        .send(body(error.code, error.message, error.details));
    }

    // 2. Validazione dello schema della rotta.
    if (error.validation) {
      const { message, details } = humanizeValidation(error);
      return reply.status(400).send(body('VALIDATION_ERROR', message, details));
    }

    // 3. Errori del database riconoscibili (vincoli violati e simili).
    const translated = translateDatabaseError(error);
    if (translated) {
      return reply
        .status(translated.statusCode)
        .send(body(translated.code, translated.message, translated.details));
    }

    // 4. Rate limit di Fastify.
    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send(
          body(
            'RATE_LIMITED',
            'Stiamo andando un po\' troppo veloci 😅 Riprova fra qualche secondo.',
          ),
        );
    }

    // 5. JSON malformato o payload troppo grande.
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send(body('VALIDATION_ERROR', 'La richiesta non è valida.'));
    }

    // 6. Tutto il resto: è un bug nostro. Log completo per noi, messaggio
    //    generico per l'utente — un messaggio di errore interno può rivelare
    //    dettagli sull'infrastruttura.
    request.log.error({ err: error }, 'Errore non gestito');

    return reply
      .status(500)
      .send(
        body(
          'INTERNAL',
          'Qualcosa è andato storto 😅 Riproviamo tra un secondo.',
          config.isProduction ? undefined : { original: error.message },
        ),
      );
  });
}
