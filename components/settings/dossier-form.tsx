"use client";

import { useState } from "react";

import {
  StepAttrezzatura,
  StepChiSei,
  StepFisiologia,
  StepObiettivi,
  StepSalute,
  StepSettimana,
  type DossierUpdater,
} from "@/components/onboarding/dossier-fields";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  CICLOCOMPUTER_OPTIONS,
  FASE_OPTIONS,
  formToPatch,
  GIORNI,
  INDOOR_OUTDOOR_OPTIONS,
  LIVELLO_OPTIONS,
  PIATTAFORMA_OPTIONS,
  SESSO_OPTIONS,
  STILE_OPTIONS,
  type DossierForm,
  type InjuryPeriod,
} from "@/lib/onboarding/dossier";
import {
  User,
  Target,
  CalendarDays,
  Activity,
  Bike,
  HeartPulse,
  ChevronRight,
  ShieldAlert,
  LogOut,
} from "lucide-react";

/**
 * Form del dossier per /settings/profile (design CurveLoad). A riposo ogni gruppo
 * mostra i valori correnti in sola lettura; ✎ Modifica apre un solo gruppo
 * alla volta, riusando gli editor dell'onboarding. Salva con /api/onboarding/save;
 * Annulla ripristina l'ultimo valore salvato.
 */

type GroupKey = "chi_sei" | "obiettivi" | "settimana" | "fisiologia" | "attrezzatura" | "salute";

function optLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string
): string {
  if (value.trim() === "") return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

function text(v: string): string {
  return v.trim() === "" ? "—" : v.trim();
}

function num(v: string, unit = ""): string {
  return v.trim() === "" ? "—" : `${v.trim()}${unit}`;
}

function list(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "—";
}

function days(values: string[]): string {
  if (values.length === 0) return "—";
  return values
    .map((v) => GIORNI.find((g) => g.value === v)?.label ?? v)
    .join(", ");
}

function yesNo(v: boolean | null): string {
  if (v === null) return "—";
  return v ? "Sì" : "No";
}

function Row({ label, value }: { label: string; value: string }) {
  const empty = value === "—";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[13px] text-muted">{label}</span>
      <span className={"text-right text-sm " + (empty ? "text-faint" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

const GROUPS: { key: GroupKey | "infortuni"; label: string; icon: React.ElementType }[] = [
  { key: "chi_sei",      label: "Chi sei",               icon: User },
  { key: "obiettivi",    label: "Obiettivi",              icon: Target },
  { key: "settimana",    label: "La tua settimana",       icon: CalendarDays },
  { key: "fisiologia",   label: "Parametri fisiologici",  icon: Activity },
  { key: "attrezzatura", label: "Attrezzatura",           icon: Bike },
  { key: "salute",       label: "Salute e note",          icon: HeartPulse },
  { key: "infortuni",    label: "Periodi infortunio",     icon: ShieldAlert },
];

export function SettingsDossierForm({
  initialForm,
  initialInjuryPeriods = [],
}: {
  initialForm: DossierForm;
  initialInjuryPeriods?: InjuryPeriod[];
}) {
  const [saved, setSaved] = useState<DossierForm>(initialForm);
  const [form, setForm] = useState<DossierForm>(initialForm);
  const [injuryPeriods, setInjuryPeriods] = useState<InjuryPeriod[]>(initialInjuryPeriods);
  const [injuryStart, setInjuryStart] = useState("");
  const [injuryEnd, setInjuryEnd] = useState("");
  const [injuryNote, setInjuryNote] = useState("");
  const [injurySaving, setInjurySaving] = useState(false);
  const [injuryError, setInjuryError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GroupKey | null>(null);
  const [expanded, setExpanded] = useState<GroupKey | "infortuni" | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const update: DossierUpdater = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setJustSaved(false);
  };

  function openEdit(group: GroupKey) {
    setForm(saved);
    setEditing(group);
    setExpanded(group);
    setError(null);
    setJustSaved(false);
  }

  function cancel() {
    setForm(saved);
    setEditing(null);
    setError(null);
  }

  async function saveInjuryPeriods(updated: InjuryPeriod[]) {
    setInjurySaving(true);
    setInjuryError(null);
    const res = await fetch("/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { injury_periods: updated } }),
    }).catch(() => null);
    setInjurySaving(false);
    if (!res || !res.ok) {
      setInjuryError("Salvataggio fallito, riprova");
      return;
    }
    setInjuryPeriods(updated);
  }

  function addInjuryPeriod() {
    if (!injuryStart || !injuryEnd || injuryEnd < injuryStart) return;
    const updated = [...injuryPeriods, { start: injuryStart, end: injuryEnd, note: injuryNote || undefined }];
    setInjuryStart(""); setInjuryEnd(""); setInjuryNote("");
    void saveInjuryPeriods(updated);
  }

  function removeInjuryPeriod(i: number) {
    void saveInjuryPeriods(injuryPeriods.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: formToPatch(form) }),
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError("Salvataggio fallito, riprova");
      return;
    }
    setSaved(form);
    setEditing(null);
    setJustSaved(true);
  }

  const saveBar = editing !== null && (
    <div
      className="sticky bottom-20 flex items-center justify-end gap-3 rounded-[18px] px-4 py-3"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
      }}
    >
      {error && <span className="text-sm text-ready-skip">{error}</span>}
      <Button variant="outline" onClick={cancel} disabled={saving}>Annulla</Button>
      <Button onClick={() => void handleSave()} disabled={saving}>
        {saving ? "Salvo…" : "Salva"}
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Impostazioni</div>
          <h1 className="mt-1.5 font-serif text-[30px] font-medium leading-none text-foreground">
            Il tuo profilo
          </h1>
          <p className="mt-2 text-sm text-secondary">Aggiorna il tuo dossier in qualsiasi momento.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="hidden text-[13px] text-muted sm:inline">Tema</span>
          <ThemeToggle />
        </div>
      </div>

      <div
        className="rounded-[18px] overflow-hidden"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}
      >
        {GROUPS.map((g, i) => {
          const isExpanded = expanded === g.key;
          const isEditing  = editing === (g.key as GroupKey);
          const isInfortuni = g.key === "infortuni";
          const Icon = g.icon;
          return (
            <div key={g.key} className={i > 0 ? "border-t" : ""} style={{ borderColor: "var(--glass-border)" }}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => {
                  if (editing && editing !== g.key) return;
                  setExpanded(isExpanded ? null : g.key as GroupKey | "infortuni");
                }}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="flex-1 text-sm font-medium text-foreground">{g.label}</span>
                <ChevronRight
                  className="h-4 w-4 text-faint transition-transform duration-200"
                  style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}
                  aria-hidden
                />
              </button>

              <div className={`grid transition-all duration-200 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--glass-border)" }}>

                    {/* Contenuto per ogni gruppo non-infortuni */}
                    {!isInfortuni && !isEditing && (
                      <>
                        <div className="divide-y divide-border">
                          {g.key === "chi_sei" && (
                            <>
                              <Row label="Nome" value={text(saved.nome)} />
                              <Row label="Età" value={num(saved.eta)} />
                              <Row label="Sesso" value={optLabel(SESSO_OPTIONS, saved.sesso)} />
                              <Row label="Altezza" value={num(saved.altezza_cm, " cm")} />
                              <Row label="Peso attuale" value={num(saved.peso_dichiarato_kg, " kg")} />
                              <Row label="Peso target" value={num(saved.peso_target_kg, " kg")} />
                              <Row label="Sport principali" value={list(saved.sport_principali)} />
                              <Row label="Livello" value={optLabel(LIVELLO_OPTIONS, saved.livello_esperienza)} />
                            </>
                          )}
                          {g.key === "obiettivi" && (
                            <>
                              <Row label="Obiettivi" value={text(saved.obiettivi)} />
                              <Row label="Fase attuale" value={optLabel(FASE_OPTIONS, saved.fase_corrente)} />
                              <Row label="Stile allenamento" value={optLabel(STILE_OPTIONS, saved.stile_allenamento)} />
                              <Row label="Gara target" value={text(saved.gara.nome)} />
                              <Row label="Data gara" value={text(saved.gara.data)} />
                              <Row label="Distanza" value={num(saved.gara.distanza_km, " km")} />
                              <Row label="Dislivello" value={num(saved.gara.dislivello_m, " m")} />
                            </>
                          )}
                          {g.key === "settimana" && (
                            <>
                              <Row label="Ore a settimana" value={num(saved.disponibilita_ore_sett, " h")} />
                              <Row label="Max infrasettimanale" value={num(saved.durata_max_weekday_min, " min")} />
                              <Row label="Max weekend" value={num(saved.durata_max_weekend_min, " min")} />
                              <Row label="Giorni preferiti" value={days(saved.giorni_preferiti)} />
                              <Row label="Giorni impossibili" value={days(saved.giorni_impossibili)} />
                            </>
                          )}
                          {g.key === "fisiologia" && (
                            <>
                              <Row label="FTP outdoor" value={num(saved.ftp_outdoor_w, " W")} />
                              <Row label="FTP indoor" value={num(saved.ftp_indoor_w, " W")} />
                              <Row label="FC max" value={num(saved.max_hr, " bpm")} />
                              <Row label="FC soglia" value={num(saved.threshold_hr, " bpm")} />
                              <Row label="LT1 potenza" value={num(saved.lt1_w, " W")} />
                              <Row label="LT1 FC" value={num(saved.lt1_hr, " bpm")} />
                              <Row label="LT2 potenza" value={num(saved.lt2_w, " W")} />
                              <Row label="LT2 FC" value={num(saved.lt2_hr, " bpm")} />
                            </>
                          )}
                          {g.key === "attrezzatura" && (
                            <>
                              <Row label="Ciclocomputer" value={optLabel(CICLOCOMPUTER_OPTIONS, saved.ciclocomputer)} />
                              <Row label="Misuratore potenza" value={yesNo(saved.ha_misuratore_potenza)} />
                              <Row label="Fascia cardio" value={yesNo(saved.ha_fascia_cardio)} />
                              <Row label="Smartwatch" value={yesNo(saved.ha_smartwatch)} />
                              <Row label="Rulli indoor" value={yesNo(saved.ha_rulli)} />
                              <Row label="Bici outdoor" value={text(saved.bici_outdoor)} />
                              <Row label="Piattaforma indoor" value={optLabel(PIATTAFORMA_OPTIONS, saved.piattaforma_indoor)} />
                              <Row label="Indoor / outdoor" value={optLabel(INDOOR_OUTDOOR_OPTIONS, saved.indoor_outdoor)} />
                            </>
                          )}
                          {g.key === "salute" && (
                            <>
                              <Row label="Infortuni attuali" value={text(saved.infortuni_attuali)} />
                              <Row label="Dolori ricorrenti" value={text(saved.dolore_attuale)} />
                              <Row label="Farmaci / integratori" value={text(saved.farmaci_integratori)} />
                              <Row label="Preferenze allenamento" value={text(saved.preferenze_allenamento)} />
                              <Row label="Limiti principali" value={text(saved.limiti_principali)} />
                              <Row label="Note personali" value={text(saved.note_personali)} />
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEdit(g.key as GroupKey)}
                          disabled={editing !== null}
                          aria-label={`Modifica ${g.label}`}
                          className="mt-3 rounded-full border border-border px-3 py-1 text-[13px] text-secondary transition-all duration-150 hover:bg-brand-dim hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✎ Modifica
                        </button>
                      </>
                    )}

                    {/* Editor onboarding */}
                    {!isInfortuni && isEditing && (
                      <>
                        {g.key === "chi_sei" && <StepChiSei form={form} update={update} />}
                        {g.key === "obiettivi" && <StepObiettivi form={form} update={update} />}
                        {g.key === "settimana" && <StepSettimana form={form} update={update} />}
                        {g.key === "fisiologia" && <StepFisiologia form={form} update={update} />}
                        {g.key === "attrezzatura" && <StepAttrezzatura form={form} update={update} />}
                        {g.key === "salute" && <StepSalute form={form} update={update} />}
                      </>
                    )}

                    {/* Periodi infortunio */}
                    {isInfortuni && (
                      <>
                        <p className="mb-4 text-[13px] text-muted">
                          Durante questi periodi il planner non genera sedute. Rigenera il piano dopo aver salvato.
                        </p>
                        {injuryPeriods.length > 0 && (
                          <div className="mb-4 divide-y divide-border">
                            {injuryPeriods.map((p, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="text-sm">
                                  <span className="text-orange-400 font-medium">{p.start}</span>
                                  <span className="mx-1 text-muted">→</span>
                                  <span className="text-orange-400 font-medium">{p.end}</span>
                                  {p.note && <span className="ml-2 text-[12px] text-muted">({p.note})</span>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeInjuryPeriod(idx)}
                                  disabled={injurySaving}
                                  className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[12px] text-ready-skip transition-colors hover:bg-ready-skip/10 disabled:opacity-40"
                                >
                                  Rimuovi
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="date"
                            value={injuryStart}
                            onChange={e => setInjuryStart(e.target.value)}
                            className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                            aria-label="Inizio infortunio"
                          />
                          <input
                            type="date"
                            value={injuryEnd}
                            min={injuryStart}
                            onChange={e => setInjuryEnd(e.target.value)}
                            className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                            aria-label="Fine infortunio"
                          />
                          <input
                            type="text"
                            placeholder="Nota (opzionale)"
                            value={injuryNote}
                            onChange={e => setInjuryNote(e.target.value)}
                            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-brand"
                          />
                          <Button
                            onClick={addInjuryPeriod}
                            disabled={!injuryStart || !injuryEnd || injuryEnd < injuryStart || injurySaving}
                          >
                            {injurySaving ? "Salvo…" : "Aggiungi"}
                          </Button>
                        </div>
                        {injuryError && <p className="mt-2 text-sm text-ready-skip">{injuryError}</p>}
                      </>
                    )}

                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {saveBar}

      {justSaved && editing === null && (
        <p className="text-right text-sm text-ready-go">Salvato ✓</p>
      )}

      <div className="mt-2 border-t pt-6" style={{ borderColor: "var(--glass-border)" }}>
        {!showLogoutConfirm ? (
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-ready-skip/30 px-4 py-3 text-sm font-medium text-ready-skip transition-colors hover:bg-ready-skip/10"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Esci da CurveLoad
          </button>
        ) : (
          <div
            className="rounded-[14px] px-4 py-4 space-y-3"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}
          >
            <p className="text-sm text-foreground text-center">Vuoi davvero uscire?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>
                Annulla
              </Button>
              <form action="/api/auth/logout" method="post" className="flex-1">
                <Button type="submit" variant="destructive" className="w-full">
                  Esci
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
