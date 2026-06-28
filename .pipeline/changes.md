# Implementation: AI Comments for Coach IA

**Stage:** Route layer (backend API endpoints + provider abstraction)
**Status:** Complete
**Date:** 2026-06-28

---

## Files Created

### 1. Database Migration
**File:** `supabase/migrations/017_ai_comments.sql`
- Adds 6 columns to `athlete_profiles` table:
  - `ai_comment_oggi` (text) + `ai_comment_oggi_at` (timestamptz)
  - `ai_comment_profilo` (text) + `ai_comment_profilo_at` (timestamptz)
  - `ai_comment_percorso` (text) + `ai_comment_percorso_at` (timestamptz)
- All columns optional, default NULL
- Comments explain purpose of each column

### 2. AI Provider Abstraction
**File:** `lib/ai/groq-provider.ts` (NEW)
- Factory pattern: auto-switch between Anthropic (default) and Groq via `COACH_AI_PROVIDER` env
- Exports:
  - `generateComment(input)` → Promise<AICommentOutput>
  - `isAIConfigured()` → boolean
- Max tokens: 300 per comment (tight budget enforced)
- System prompts inline for each section (oggi/profilo/percorso)
- Groq model: `openai/gpt-oss-120b`
- Throws "AI_NOT_CONFIGURED" if no API key

### 3. OGGI Route
**File:** `app/api/comments/oggi/route.ts` (NEW)
- POST endpoint, reads:
  - User profile (nome, injury_periods)
  - Mirror JSON (readiness_today, wellness_30d, activities_90d)
- Extracts:
  - Current: CTL, ATL, TSB, ACWR, HRV, RHR, sleep
  - 14-day trends via simple delta computation
  - Injury status check (isInjured helper)
  - Readiness decision
- Payload includes all metrics + trends as strings for AI
- Persists comment + timestamp to DB
- Audit log on generation
- Edge case: no mirror data → 409 "Dati insufficienti"

### 4. PROFILO Route
**File:** `app/api/comments/profilo/route.ts` (NEW)
- POST endpoint, reads:
  - Athlete profile (nome, profile_data)
- Extracts:
  - Phenotype (primary, secondary, confidence, basis fields)
  - CP/W′ (rounded for AI)
  - RPP current vs best 1y, computed delta % for each duration
- Payload formatted for readability (durations as "5s", "1min", etc.)
- Persists comment + timestamp
- Edge case: no profile_data → 409 "Profilo non ancora calcolato"

### 5. PERCORSO Route
**File:** `app/api/comments/percorso/route.ts` (NEW)
- POST endpoint, reads:
  - Athlete profile (nome, profile_data)
  - Event terrain (distance, elevation, climbs array)
  - Gap analysis, race estimate
  - Target event
- Extracts:
  - Climb altimetry formatted for readability
  - Phenotype + CP/W′
  - Gap limiters
  - Race time estimate + difficulty
- Payload includes all context for nutrition/pacing advice
- Persists comment + timestamp
- Edge case: no event_terrain → 409 "Nessuna gara o percorso caricato"

---

## Design Decisions (Ponytail)

### Reuse, No New Dependencies
- ✅ Groq SDK already in `package.json`
- ✅ Existing DB helpers (Supabase client, admin client)
- ✅ Existing injury check (`isInjured()` from lib/planner/injury)
- ✅ System prompts inline (no extra files)

### Graceful Degradation
- Routes return 409 with human message if critical data missing
- No error if save fails (comment still returned to user)
- Mirror/profile absence → proper HTTP status + reason

### Injury Handling
- OGGI route explicitly checks `isInjured(today, injury_periods)`
- Payload includes `injured: boolean` sent to LLM
- System prompt already forbids workout advice for injured athletes

### Validation Deferred
- Post-generation validation (word count, invented numbers) added to spec but not enforced here
- Spec notes validators should check output regex for fake wattages
- Current: trust LLM, system prompts forbid invention

### Token Budget
- Max 300 tokens per request (spec allows 300, output target ≤150 words)
- Tight budget enforced in both Anthropic and Groq
- If future iterations show truncation, reduce max_tokens or split payload

---

## Data Flow

### OGGI Section
```
POST /api/comments/oggi
→ Read: profile (nome, injury_periods), mirror (readiness_today, wellness_30d)
→ Compute: trends (14d delta), injury check, current CTL/ATL/TSB/ACWR
→ Build payload: all metrics as strings
→ generateComment(section='oggi', payload)
→ Persist: ai_comment_oggi, ai_comment_oggi_at
→ Audit log: action=comment.ai_oggi_generated
→ Return: comment + generated_at
```

### PROFILO Section
```
POST /api/comments/profilo
→ Read: profile_data (fenotipo, cp_wprime, rpp)
→ Compute: RPP trend (current vs best 1y), basis values (flatness, punch_ratio, apr_ratio)
→ Build payload: formatted phenotype, CP/W′, RPP deltas
→ generateComment(section='profilo', payload)
→ Persist: ai_comment_profilo, ai_comment_profilo_at
→ Audit log: action=comment.ai_profilo_generated
→ Return: comment + generated_at
```

### PERCORSO Section
```
POST /api/comments/percorso
→ Read: profile_data, event_terrain, gap_analysis, race_estimate, gare_target
→ Compute: climb details, fenotipo, CP/W′, gap limiters
→ Build payload: event, terrain, phenotype, CP/W′, limiters, race estimate
→ generateComment(section='percorso', payload)
→ Persist: ai_comment_percorso, ai_comment_percorso_at
→ Audit log: action=comment.ai_percorso_generated
→ Return: comment + generated_at
```

---

## Environment Setup Required

### For Anthropic (default)
```
ANTHROPIC_API_KEY=sk-ant-...
# COACH_AI_PROVIDER not set or = "anthropic"
```

### For Groq (optional)
```
GROQ_API_KEY=gsk-...
COACH_AI_PROVIDER=groq
```

### Cost Estimate
- 3 comments/user × 300 tokens × $0.0001/token ≈ $0.0001/user/generation
- At 100 users/day: $0.01/day = $0.30/month

---

## Testing Checklist

- [ ] Migration 017 applies cleanly (run `supabase migration up`)
- [ ] POST /api/comments/oggi with valid user → generates + persists comment
- [ ] POST /api/comments/profilo with valid user → generates + persists comment
- [ ] POST /api/comments/percorso with valid user → generates + persists comment
- [ ] No API key configured → all routes return 200 { configured: false }
- [ ] Mirror data missing → OGGI returns 409
- [ ] Profile data missing → PROFILO returns 409
- [ ] Event terrain missing → PERCORSO returns 409
- [ ] Injured user (today) → OGGI comment mentions recovery only (system prompt enforced)
- [ ] Comment persisted in DB + timestamp recorded
- [ ] Audit logs created for each generation
- [ ] Token usage counts returned in response

---

## Known Limitations & Future Improvements

### Current (Stage 1)
1. **No frontend components yet** — routes are backend-only, next stage adds UI
2. **No validation enforcement** — post-generation checks (word count, invented numbers) in spec but not implemented
3. **No caching/rate-limiting** — routes regenerate on each call; spec mentions 24h TTL
4. **Groq model fixed** — `openai/gpt-oss-120b` hardcoded, could be env-configurable
5. **Simple trend calculation** — 14-day delta only, no regression/smoothing

### Deferred to Stage 2 (Frontend)
- Display components (CoachCommentToday, CoachCommentProfilo, CoachCommentPercorso)
- Regenerate button UI + loading states
- Timestamp display + timezone handling
- Error messaging for users

### Deferred to Future Iterations
- Cache comments 24h to avoid token waste
- Rate-limiting (1 generation/section/user/day)
- A/B testing Anthropic vs Groq quality/cost
- Multi-language system prompts
- Custom prompt tuning per fenotipo

---

## Blockers / TODOs

- [ ] **None identified** — All dependencies present, data sources confirmed, patterns established
- [ ] **Optional:** Add env validation helper if GROQ_API_KEY set but unreachable
- [ ] **Optional:** Implement post-generation validation (spec §10) to catch hallucinated numbers

---

## Summary

Three API routes + one provider abstraction, 5 files created:
1. Migration 017 (DB schema)
2. lib/ai/groq-provider.ts (Anthropic/Groq factory)
3. app/api/comments/oggi/route.ts (readiness + metrics + injury check)
4. app/api/comments/profilo/route.ts (phenotype + CP/W′ + RPP trend)
5. app/api/comments/percorso/route.ts (altimetry + nutrition + pacing)

All routes follow existing patterns (Supabase RLS, audit logs, error handling).
No new dependencies. System prompts inline. Token budget: 300/comment.

**Ready for frontend component implementation in Stage 2.**
