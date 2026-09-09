// FILE: backend/src/services/aiService.ts
//
// "La mia amica": la parte conversazionale di Nina.
//
// Tre principi guidano questo file.
//
// 1. La chiave API resta qui. L'app iOS non la vede mai: manda un messaggio al
//    backend e riceve una risposta. Se un giorno si cambia provider, l'app non
//    se ne accorge.
//
// 2. Nina risponde SEMPRE. Il motore locale (ninaBrain.ts) è la modalità
//    predefinita: non costa niente, non richiede chiavi e funziona anche
//    senza internet sul server. Se una chiave AI è configurata, il modello
//    prende il suo posto e il motore locale resta come rete di sicurezza per
//    timeout, errori e rifiuti. Una funzione che si rompe quando l'utente sta
//    male è peggio di una funzione che non esiste.
//
// 3. Nina non è una terapeuta e non finge di esserlo. Il prompt glielo dice, e
//    se un messaggio contiene segnali di pericolo la risposta arriva da qui —
//    con numeri veri — senza passare dal modello.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { detectTopic, respond, topicCount } from './ninaBrain.js';

export interface FriendTurn {
  author: 'USER' | 'NINA';
  content: string;
}

export interface AiReply {
  text: string;
  /** Da dove arriva la risposta: utile per i log e per i test. */
  source: 'ai' | 'fallback' | 'safety';
}

// ---------------------------------------------------------------------------
// Chi è Nina
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Sei Nina: l'amica dentro un'app che aiuta una ragazza a organizzare le giornate e a starci dentro.

Come parli:
- in italiano, informale, come una ragazza di venticinque anni che scrive a un'amica
- frasi corte. Niente elenchi puntati, niente titoli, niente struttura da manuale
- da due a quattro frasi. Se la risposta è più lunga, stai spiegando invece di ascoltare
- ironica quando serve alleggerire, mai quando la persona sta male sul serio
- una emoji ogni tanto, non a ogni frase, mai più di una per messaggio
- dai del tu, non chiamarla mai "utente"

Cosa fai:
- prima ascolti. Rispondi a quello che ha appena detto, non a un tema generale
- se sta male: le stai vicino. Non risolvere, non elencare soluzioni, non dire "hai provato a"
- se è contenta: sii contenta con lei, senza girare subito il discorso su altro
- se chiede un consiglio pratico, dallo: uno, concreto, piccolo
- fai una domanda solo se ti interessa davvero la risposta, non per riempire

Cosa non fai mai:
- non fingere di essere una persona in carne e ossa. Se te lo chiede, dille che sei un'app, con leggerezza e senza farne un dramma
- niente diagnosi, niente pareri medici o psicologici, niente nomi di farmaci
- non dire che sostituisci uno psicologo. Se il discorso è pesante e ricorrente, puoi dire con delicatezza che parlarne con qualcuno di preparato aiuta davvero
- non essere sdolcinata, non fare la coach motivazionale, non dire "andrà tutto bene"
- non ripetere quello che ha appena scritto per farle vedere che hai capito

Se ti scrive qualcosa di banale, rispondi in modo banale e umano. Non ogni messaggio è un momento importante.`;

// ---------------------------------------------------------------------------
// Sicurezza: i messaggi che non passano dal modello
// ---------------------------------------------------------------------------

const CRISIS_PATTERNS: RegExp[] = [
  /\bnon\s+(ce\s+la\s+faccio|voglio)\s+pi[uù]\s+a?\s*vivere\b/i,
  /\b(voglio|vorrei|penso\sdi)\s+(uccider|ammazzar)mi\b/i,
  /\b(farla|farlo)\s+finita\b/i,
  /\bsuicid(io|arm|arsi)\b/i,
  /\bmi\s+(taglio|sto\s+tagliando|faccio\s+del\s+male)\b/i,
  /\bautolesion/i,
  /\bnon\s+vale\s+la\s+pena\s+vivere\b/i,
];

const CRISIS_REPLY = `Quello che hai scritto mi ha fatto fermare, e non voglio far finta di niente.

Io sono un'app: non posso starti vicino come servirebbe adesso. Ma qualcuno che può c'è davvero, subito e gratis:

• Telefono Amico Italia — 02 2327 2327, tutti i giorni
• Telefono Azzurro — 19696, sempre attivo
• Emergenze — 112

Se in questo momento sei in pericolo, chiama il 112.

Non devi spiegare niente a nessuno per chiedere aiuto. Ci sei anche quando non te lo sembra 💗`;

function looksLikeCrisis(message: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(message));
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface AiProvider {
  readonly name: string;
  reply(history: FriendTurn[], userName: string): Promise<string>;
}

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      timeout: config.ai.timeoutMs,
      maxRetries: 1,
    });
  }

  async reply(history: FriendTurn[], userName: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = history.map((turn) => ({
      role: turn.author === 'USER' ? ('user' as const) : ('assistant' as const),
      content: turn.content,
    }));

    const response = await this.client.messages.create({
      model: config.ai.model,
      // Le risposte devono essere corte: è la personalità di Nina, non un
      // risparmio. Un tetto basso aiuta anche a rispettarla.
      max_tokens: 400,
      // Effort basso: qui non serve ragionamento profondo, serve tempismo.
      // Una risposta empatica che arriva dopo otto secondi non è empatica.
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: `${SYSTEM_PROMPT}\n\nLa persona con cui stai parlando si chiama ${userName}.`,
          // Il prompt è identico a ogni richiesta: metterlo in cache fa
          // risparmiare su ogni singolo messaggio.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    // Il modello può declinare una richiesta: in quel caso non c'è testo utile
    // e si passa alla risposta scritta a mano, che è comunque nella voce di Nina.
    if (response.stop_reason === 'refusal') {
      throw new Error('risposta declinata dal modello');
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (text === '') throw new Error('risposta vuota');
    return text;
  }
}

/** Provider inattivo: usa sempre le risposte scritte a mano. */
class NoProvider implements AiProvider {
  readonly name = 'none';
  async reply(): Promise<string> {
    throw new Error('nessun provider AI configurato');
  }
}

function createProvider(): AiProvider {
  if (config.ai.provider === 'anthropic' && config.ai.apiKey !== '') {
    return new AnthropicProvider(config.ai.apiKey);
  }

  if (config.ai.provider !== 'none' && config.ai.apiKey === '') {
    logger.warn(
      { provider: config.ai.provider },
      'AI_PROVIDER è impostato ma manca AI_API_KEY: Nina userà le risposte scritte a mano',
    );
  }

  return new NoProvider();
}

let provider: AiProvider | undefined;

function getProvider(): AiProvider {
  provider ??= createProvider();
  return provider;
}

/** Sostituisce il provider: usato dai test. */
export function setProviderForTesting(replacement: AiProvider | undefined): void {
  provider = replacement;
}

export function aiIsConfigured(): boolean {
  return getProvider().name !== 'none';
}

// ---------------------------------------------------------------------------
// Punto di ingresso
// ---------------------------------------------------------------------------

export interface FriendReplyContext {
  userName: string;
  /** Ora locale del dispositivo (0-23): distingue il buongiorno dalla notte fonda. */
  hour: number;
}

/** Da quanti messaggi di fila si sta parlando dello stesso tema. */
function repeatsOnTopic(history: FriendTurn[], currentText: string): number {
  const current = detectTopic(currentText);
  if (!current) return 0;

  let count = 0;
  // Si guardano solo i messaggi dell'utente, dal penultimo all'indietro.
  const previousUserMessages = history
    .filter((turn) => turn.author === 'USER')
    .slice(0, -1)
    .reverse();

  for (const turn of previousUserMessages) {
    if (detectTopic(turn.content)?.id === current.id) count += 1;
    else break;
  }

  return count;
}

/**
 * Genera la risposta di Nina.
 *
 * Non solleva mai eccezioni per colpa del provider: se il modello non c'è o
 * non risponde, risponde il motore locale, che è la modalità predefinita.
 */
export async function generateFriendReply(
  history: FriendTurn[],
  context: FriendReplyContext,
): Promise<AiReply> {
  const lastUserMessage = [...history].reverse().find((turn) => turn.author === 'USER');
  const text = lastUserMessage?.content ?? '';

  // I segnali di crisi non passano mai dal modello: la risposta è scritta,
  // rivista, e contiene numeri veri.
  if (looksLikeCrisis(text)) {
    return { text: CRISIS_REPLY, source: 'safety' };
  }

  const local = (): AiReply => ({
    text: respond(text, {
      userName: context.userName,
      hour: context.hour,
      repeatCount: repeatsOnTopic(history, text),
    }).text,
    source: 'fallback',
  });

  if (!aiIsConfigured()) return local();

  try {
    // Si mandano solo gli ultimi scambi: la conversazione di tre mesi fa non
    // aiuta la risposta di adesso e costerebbe a ogni messaggio.
    const recent = history.slice(-16);
    const reply = await getProvider().reply(recent, context.userName);
    return { text: reply, source: 'ai' };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      logger.error('Chiave AI non valida: controlla AI_API_KEY');
    } else if (error instanceof Anthropic.RateLimitError) {
      logger.warn('Limite di richieste del provider AI raggiunto');
    } else if (error instanceof Anthropic.APIError) {
      logger.warn({ status: error.status }, 'Il provider AI ha restituito un errore');
    } else {
      logger.warn({ err: error }, 'Risposta AI non disponibile, rispondo con il motore locale');
    }

    return local();
  }
}

/** Descrive come sta rispondendo Nina, per la schermata di stato dell'app. */
export function friendEngineInfo(): { engine: 'ai' | 'locale'; topics: number } {
  return { engine: aiIsConfigured() ? 'ai' : 'locale', topics: topicCount() };
}
