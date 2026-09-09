// FILE: backend/tests/setup.ts
//
// Ambiente per i test. I segreti sono finti e servono solo a far partire la
// validazione della configurazione: nessuno di questi valori esiste altrove.

process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';
process.env['JWT_SECRET'] ??= 'segreto-di-test-non-usato-in-produzione-1';
process.env['JWT_REFRESH_SECRET'] ??= 'segreto-di-test-non-usato-in-produzione-2';
process.env['DATABASE_URL'] ??= 'postgresql://nina:ninadev@127.0.0.1:5432/nina_test';
process.env['AI_PROVIDER'] = 'none';
process.env['SMTP_HOST'] = '';

// I limiti restano attivi ma alzati: con il valore di produzione (10 al minuto)
// ogni file di test si bloccherebbe da solo dopo dieci registrazioni. Che il
// meccanismo funzioni davvero lo verifica tests/integration/limiti.test.ts,
// che li abbassa apposta.
//
// Assegnazione secca e non `??=`: questo file viene eseguito prima di *ogni*
// file di test, ma il processo che lo esegue è riutilizzato. Con `??=`, dopo
// limiti.test.ts il valore abbassato resterebbe in giro e il file successivo
// si bloccherebbe da solo — un fallimento che dipende dall'ordine, cioè il
// tipo peggiore da capire.
process.env['RATE_LIMIT_MAX'] = '5000';
process.env['RATE_LIMIT_AUTH_MAX'] = '2000';
process.env['RATE_LIMIT_WINDOW'] = '1 minute';
