"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const LS_KEY = "curveload_tour_v2";

async function isTourCompleted(): Promise<boolean> {
  if (typeof window !== "undefined" && localStorage.getItem(LS_KEY)) return true;
  try {
    const res = await fetch("/api/settings/tour-complete");
    const json = (await res.json()) as { completed: boolean };
    if (json.completed) localStorage.setItem(LS_KEY, "1");
    return json.completed;
  } catch {
    return false;
  }
}

async function markTourCompleted() {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEY, "1");
  await fetch("/api/settings/tour-complete", { method: "POST" }).catch(() => null);
}

// Aspetta che un elemento con dato id sia nel DOM
function waitForElement(id: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById(id)) return resolve(true);
    const observer = new MutationObserver(() => {
      if (document.getElementById(id)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(false); }, timeoutMs);
  });
}

export function AppTour() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    (async () => {
      const done = await isTourCompleted();
      if (cancelled) return;

      const tourParam = searchParams.get("tour");

      // ── Sezione DASHBOARD (tour nuovo utente, nessun parametro) ──
      if (pathname === "/dashboard" && !done && !tourParam) {
        await waitForElement("tour-readiness");
        if (cancelled) return;

        const d = driver({
          animate: true,
          smoothScroll: true,
          showProgress: true,
          progressText: "{{current}} di {{total}}",
          nextBtnText: "Avanti →",
          prevBtnText: "← Indietro",
          doneBtnText: "Vai al Piano →",
          overlayOpacity: 0.75,
          stagePadding: 10,
          stageRadius: 18,
          popoverClass: "curveload-tour-popover",
          onDestroyStarted: () => {
            d.destroy();
            // Naviga alla pagina Piano continuando il tour
            router.push("/plan?tour=1");
          },
          steps: [
            {
              popover: {
                title: "Benvenuto in CurveLoad",
                description:
                  "Questa è la tua dashboard quotidiana. Ti mostra tutto quello che serve in un colpo d'occhio: come stai, cosa fare oggi e come sta andando il tuo allenamento.",
                side: "over",
                align: "center",
              },
            },
            {
              element: "#tour-refresh",
              popover: {
                title: "Sincronizza i dati",
                description:
                  "Premi qui ogni mattina per leggere i dati aggiornati da Intervals.icu: HRV, sonno, frequenza cardiaca a riposo e carico degli ultimi 7 giorni.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#tour-readiness",
              popover: {
                title: "Readiness — sei pronto?",
                description:
                  "Il punteggio da 0 a 100 combina tutti i segnali biologici e di carico. Verde = vai, giallo = riduci l'intensità, rosso = riposa.",
                side: "bottom",
                align: "center",
              },
            },
            {
              element: "#tour-session",
              popover: {
                title: "La seduta di oggi",
                description:
                  "Tipo di allenamento, durata e zona di potenza suggeriti per oggi. Viene già sincronizzata sul tuo calendario Intervals.icu.",
                side: "bottom",
                align: "center",
              },
            },
            {
              element: "#tour-metrics",
              popover: {
                title: "Le tue metriche di carico",
                description:
                  "CTL è la tua forma fisica a lungo termine. ATL è la fatica degli ultimi 7 giorni. TSB è la differenza: positivo = fresco, negativo = sotto carico. Tocca ⓘ su ognuna per la spiegazione.",
                side: "top",
                align: "center",
              },
            },
            {
              element: "#tour-trend-chart",
              popover: {
                title: "Andamento 30 giorni",
                description:
                  "Il grafico mostra come CTL, ATL e TSB si sono evoluti nell'ultimo mese. Utile per capire se stai costruendo forma o accumulando troppa fatica.",
                side: "top",
                align: "center",
              },
            },
          ],
        });

        setTimeout(() => { if (!cancelled) d.drive(); }, 700);
        return;
      }

      // ── Sezione PIANO (tour=1) ──
      if (pathname === "/plan" && tourParam === "1") {
        // Pulisce il parametro dall'URL senza aggiungere storia
        router.replace("/plan", { scroll: false });
        await waitForElement("tour-generate-btn");
        if (cancelled) return;

        const d = driver({
          animate: true,
          smoothScroll: true,
          showProgress: true,
          progressText: "{{current}} di {{total}}",
          nextBtnText: "Avanti →",
          prevBtnText: "← Indietro",
          doneBtnText: "Vai al Profilo →",
          overlayOpacity: 0.75,
          stagePadding: 10,
          stageRadius: 18,
          popoverClass: "curveload-tour-popover",
          onDestroyStarted: () => {
            d.destroy();
            router.push("/profile?tour=1");
          },
          steps: [
            {
              element: "#tour-tab-plan",
              popover: {
                title: "Piano settimanale",
                description:
                  "Ogni settimana puoi generare un piano personalizzato. CurveLoad legge il tuo dossier, la fase corrente e la readiness per distribuire i carichi in modo intelligente.",
                side: "top",
                align: "center",
              },
            },
            {
              element: "#tour-generate-btn",
              popover: {
                title: "Genera o rigenera",
                description:
                  "Un click e CurveLoad costruisce la settimana: sessioni intense, volume, recupero. Puoi rigenerare ogni volta che cambia qualcosa.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#tour-week-grid",
              popover: {
                title: "La griglia dei 7 giorni",
                description:
                  "Ogni giorno mostra tipo di sessione, durata e zona. I giorni già completati mostrano la percentuale di rispetto del piano.",
                side: "top",
                align: "center",
              },
            },
            {
              element: "#tour-push-btn",
              popover: {
                title: "Carica su Intervals.icu",
                description:
                  "Con un click il piano viene pubblicato sul tuo calendario Intervals.icu. Lo ritrovi nell'app, sul sito e sul ciclocomputer.",
                side: "top",
                align: "center",
              },
            },
          ],
        });

        setTimeout(() => { if (!cancelled) d.drive(); }, 400);
        return;
      }

      // ── Sezione PROFILO (tour=1) ──
      if (pathname === "/profile" && tourParam === "1") {
        router.replace("/profile", { scroll: false });
        await waitForElement("tour-tab-profile");
        if (cancelled) return;

        const d = driver({
          animate: true,
          smoothScroll: true,
          showProgress: true,
          progressText: "{{current}} di {{total}}",
          nextBtnText: "Avanti →",
          prevBtnText: "← Indietro",
          doneBtnText: "Inizia ad allenarti →",
          overlayOpacity: 0.75,
          stagePadding: 10,
          stageRadius: 18,
          popoverClass: "curveload-tour-popover",
          onDestroyStarted: () => {
            void markTourCompleted();
            d.destroy();
            router.push("/dashboard");
          },
          steps: [
            {
              element: "#tour-tab-profile",
              popover: {
                title: "Il tuo profilo atleta",
                description:
                  "Qui trovi la tua firma fisiologica: curva di potenza, potenza critica (CP), riserva anaerobica (W′) e il tuo fenotipo.",
                side: "top",
                align: "center",
              },
            },
            {
              element: "#tour-cp-hero",
              popover: {
                title: "Potenza critica (CP)",
                description:
                  "La potenza che puoi sostenere teoricamente per molto tempo. È il numero più importante per costruire i tuoi allenamenti a zone. Più dati storici hai su Intervals, più sarà preciso.",
                side: "bottom",
                align: "center",
              },
            },
            {
              popover: {
                title: "Tour completato",
                description:
                  "Hai visto tutto. Inizia sincronizzando i dati dalla dashboard, poi genera il primo piano settimanale. Ogni metrica ha un ⓘ con la spiegazione. Buon allenamento!",
                side: "over",
                align: "center",
              },
            },
          ],
        });

        setTimeout(() => { if (!cancelled) d.drive(); }, 400);
        return;
      }
    })();

    return () => { cancelled = true; };
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
