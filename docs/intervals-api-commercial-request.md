# DRAFT — richiesta a David Tinker per uso commerciale dell'API (fase F0)

> Da inviare come post nella categoria **API** del forum
> (forum.intervals.icu) — è il canale che David usa per queste richieste —
> oppure via messaggio diretto sul forum. NON inviata: bozza da rivedere.
> Prima di postare: rileggere i pinned post della categoria API per eventuali
> policy commerciali già pubblicate, e adattare.

---

**Subject:** Permission request: small commercial coaching app built on the Intervals.icu API

Hi David,

first of all, thank you for Intervals.icu — it's the backbone of my own
training and of the project I'm writing about.

I'm an Italian amateur MTB racer and developer. I've built a coaching web
app for my own use ("CurveLoad") that reads an athlete's data through the
Intervals.icu API via OAuth (activities, wellness, power/pace curves) and
writes planned workouts back to the calendar. The training logic follows a
published open protocol; the app never recalculates what Intervals already
computes — it reads your numbers as the source of truth.

I'd now like to open it to other athletes as a small paid subscription
service, and I don't want to do that without your explicit OK. Concretely:

- **Scale:** starting with a closed beta of 10–20 users; realistically tens,
  not thousands, of users in the first year.
- **API usage per user:** one background sync per day plus occasional manual
  refreshes; standard OAuth per-user tokens, minimal scopes (read
  activities/wellness, write calendar events).
- **Requirement:** every user must have their own Intervals.icu account —
  the app is built ON Intervals, not around it, and I actively push users to
  your platform (it's a hard requirement in onboarding).

My questions:
1. Is commercial use of the API acceptable in this form, and under what
   conditions (attribution, rate limits, a fee, anything else)?
2. Is there anything you'd want changed in how the app presents
   Intervals.icu data?

If any of this doesn't sit right with you, I'd rather know now — happy to
adjust the model or keep it non-commercial.

Thanks for your time and for the platform,
Giuseppe Carbonari
(carbonarigiuseppe95@gmail.com — Intervals.icu athlete i****)

---

> Nota post-invio: registrare qui data, canale e risposta. Qualunque
> condizione posta da David diventa vincolo di prodotto (fase F7/F9).
