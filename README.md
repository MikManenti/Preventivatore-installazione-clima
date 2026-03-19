# Preventivatore Installazione Climatizzatore

Software per il disegno di planimetrie e il calcolo dei costi di installazione del climatizzatore.

## 🚀 Prova subito — nessuna installazione richiesta

👉 **[Apri l'applicazione live](https://mikmanenti.github.io/Preventivatore-installazione-clima/)**

Basta aprire il link sopra nel browser: nessun download, nessun server locale necessario.

---

## Funzionalità

- **Template preconfigurati** — Monolocale, Bilocale, Trilocale, Quadrilocale
- **Disegno planimetria** — stanze (trascina), pareti libere (clic–clic), griglia con snap
- **Posizionamento unità AC** — split interno (❄) e unità esterna (🌡), spostabili con Select
- **Traccia tubazione** — clic sui punti del percorso, doppio-clic per completare
- **Calcolo automatico**:
  - Lunghezza totale in metri (con etichette per segmento)
  - Numero di pareti attraversate (geometria di intersezione segmenti)
  - Valutazione complessità: Semplice / Standard / Media / Alta
- **Scala configurabile** — default 0,5 m per cella
- **Undo** (Ctrl+Z) su tutte le operazioni

## Utilizzo rapido

1. Scegli un template (o disegna stanze/pareti manualmente)
2. Clicca **❄ Split Int.** e posiziona lo split interno
3. Clicca **🌡 U. Esterna** e posiziona l'unità esterna
4. Clicca **〰 Traccia** e disegna il percorso della tubazione
5. Leggi distanza e pareti attraversate nel pannello di destra

## Sviluppo locale

Il progetto è una web app statica senza dipendenze né fase di build.

```bash
# Qualsiasi server HTTP è sufficiente, ad esempio:
python3 -m http.server 8080
# poi apri http://localhost:8080
```

## Deployment

Ogni push su `main` pubblica automaticamente il sito su GitHub Pages tramite GitHub Actions (`.github/workflows/deploy.yml`).
