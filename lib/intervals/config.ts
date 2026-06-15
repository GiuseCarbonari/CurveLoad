/**
 * Configurazione OAuth Intervals.icu — SOLO endpoint verificati insieme
 * (regola ferma n. 6). Fonte: documentazione ufficiale intervals.icu,
 * verificata in Milestone 1. Vedi docs/INTERVALS_API_NOTES.md.
 *
 * Fatti chiave verificati:
 *  - NON esistono refresh token: l'access token è permanente.
 *  - Athlete ID "0" = atleta del token corrente in qualsiasi endpoint.
 *  - Token response attesa: { access_token, scope, athlete: { id, name } }.
 *
 * Nessun altro endpoint Intervals.icu va chiamato finché non viene
 * verificato e aggiunto qui.
 */

export const INTERVALS_AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
export const INTERVALS_TOKEN_URL = "https://intervals.icu/api/oauth/token";

// Scope minimi necessari (PRD §9.4): lettura attività/wellness/soglie,
// scrittura calendario. Separatore virgola come da documentazione Intervals.
export const INTERVALS_SCOPES =
  "ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:READ";

// Cookie che trasporta lo state CSRF tra /login e /callback.
export const OAUTH_STATE_COOKIE = "intervals_oauth_state";

/** Forma della risposta di POST /api/oauth/token (verificata). */
export interface IntervalsTokenResponse {
  access_token: string;
  scope: string;
  athlete: {
    id: string | number;
    name: string;
  };
}
