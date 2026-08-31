# MN Peatland Carbon Mapping

Public-facing site presenting statewide models of peatland probability, peat depth, and carbon
stock across Minnesota, along with the underlying data and methods. Built with Astro.

## Project Structure

```text
/
├── public/              → static assets (favicon)
├── src/
│   ├── components/      → Nav, Footer, reusable UI
│   ├── layouts/         → Layout.astro (shared page shell)
│   └── pages/
│       ├── index.astro          → Home
│       ├── map/                 → Map section
│       │   ├── index.astro
│       │   ├── probability-model.astro
│       │   ├── depth-model.astro
│       │   └── carbon-stock.astro
│       ├── database/index.astro → Database / data access
│       └── resources/index.astro → Resources / methods docs
├── astro.config.mjs     → site config (GitHub Pages base path)
└── package.json
```

## Commands

All commands are run from the root of the project, from a terminal:

| Command           | Action                                       |
| :----------------- | :-------------------------------------------- |
| `npm install`       | Installs dependencies                         |
| `npm run dev`       | Starts local dev server at `localhost:4321`   |
| `npm run build`     | Build the production site to `./dist/`        |
| `npm run preview`   | Preview the build locally, before deploying   |

## Deployment

Deployed via GitHub Pages (Settings → Pages → GitHub Actions). Site URL and base path are set in
`astro.config.mjs`.
