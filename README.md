# Analog Window

**Your next Mars or Moon mission starts on Earth.**

Analog Window is a web app that finds **where** on Earth, and **when** in the year, conditions behave most like Mars or the Moon's south pole, and shows **what no place on Earth can copy**.

🔗 **Live app:** https://anatsvik.github.io/analog-window/

Built for the **NASA Space Apps Challenge 2026**, challenge *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*, by **AnaLog**, a solo team: Anastasiya Tsvikevich.

---

## Why

Before a crew or rover goes to Mars or back to the Moon, every part of the mission is rehearsed on Earth: rovers, habitats, power systems, crews. Most teams return to the same few famous analog sites, and the time of year is rarely part of the choice. Analog Window searches the whole planet systematically, adds the best month for every place, and is clear about the limits of each analog.

## Features

- **Two targets:** Mars, and the Moon's south pole (the Artemis base region)
- **Mission profiles:** Balanced, Mobility & robotics, Construction & habitat, Resources (ice), Life detection, Human operations
- **Adjustable weights:** sliders for every factor, with live re-scoring
- **Global map:** 1,567 places coloured by twin score, with a month selector
- **Site profiles:** twin score, best window, monthly scores, factor breakdown and NASA POWER values
- **Terrain and surface check:** candidate sites inspected in NASA Worldview imagery, with *Test here* and *Not valid for* lists
- **Benchmarks:** 8 well-known analog sites scored the same way, to test the method
- **Field test plan:** one place and month for each mission phase, a route on the map and a test calendar; swap places, skip phases
- **PDF brief:** a one-page plan to download and share
- **Guided tours** for engineers, scientists and curious visitors
- **Method page** with sources, Earth's limits and known limitations
- **Light and dark themes,** works on phones

## How it works

1. **Grid.** A 4° grid over all of Earth's land (1,287 points), a finer 1° grid in the four strongest regions (Puna/Altiplano, Qaidam, Tibet/Changtang, Pamir) and 8 benchmark sites: 1,567 places in total.
2. **NASA data.** For every place, 20-year monthly averages (2001–2020) from the NASA POWER Climatology API: temperature (mean, max, min, range), precipitation, humidity, surface pressure, wind, sunlight, clear-sky sunlight, cloud cover and UV index.
3. **Factors.** Dryness, cold, extreme night cold, thin air, UV, day–night swing, clear skies, wind & dust and low sunlight.
4. **Percentile scoring.** No place on Earth reaches Mars or Moon values, so each factor measures how far a place goes *in the target's direction* compared with the rest of Earth's land (0–100%).
5. **Twin score.** A weighted average of the factors for every month. The highest month gives the best window.
6. **Field test plan.** For each mission phase, the best place and month, with unique months and places far enough apart to cover different conditions.

### Validation

- Atacama, Death Valley and the Mars Desert Research Station rank in the top ~22% of Earth's land for Mars.
- The search found the Qaidam Basin, an established Mars analog region, on its own.
- Sites known mainly for their geology (Haughton Crater, Holuhraun) score low, as expected: the score measures conditions, not landforms.

### Limitations

- Conditions are averaged over cells about 0.5–1° wide, so a single crater floor or valley can differ.
- Terrain is checked in Worldview imagery for candidate sites, not scored automatically.
- Scores are relative to Earth's land, not an absolute similarity to Mars or the Moon.
- No place on Earth reproduces low gravity, vacuum or space radiation.

## Tech stack

| Area | Tools |
|---|---|
| Front end | HTML, CSS, JavaScript (no framework) |
| Map | Leaflet 1.9, NASA GIBS Blue Marble tiles, CARTO fallback |
| Data pipeline | Python, pandas, requests, global-land-mask, Google Colab |
| Data | NASA POWER Climatology API, NASA Worldview, LRO Diviner, NASA Mars Fact Sheet |
| Hosting | GitHub Pages |
| Design | Custom CSS themes (light/dark), responsive layout, print styles for the PDF brief |

## Skills practised

- Building a data pipeline from a public NASA API (batching, retries, missing-data checks)
- Designing a transparent scoring method and validating it against known sites
- Geospatial analysis and satellite image interpretation (NASA Worldview)
- Interactive map development with Leaflet
- UX for different audiences: guided tours, plain-language explanations, a method page
- Responsive and accessible front-end design, printable reports
- Scientific honesty: stating what the data can and cannot show

## Project structure

```
notebooks/
  analog_window_data.ipynb  data pipeline (Google Colab)
index.html        app layout, welcome page, Method page
style.css         themes, layout, phone styles, print styles
app.js            scoring, map, field test plan, tours, PDF brief
data/
  app_points.json scored places with NASA POWER monthly values
  sites.json      candidate sites from the Worldview check
```

## Data pipeline

The data was prepared in Google Colab: [`notebooks/analog_window_data.ipynb`](notebooks/analog_window_data.ipynb) ([open in Colab](https://colab.research.google.com/github/AnaTsvik/analog-window/blob/main/notebooks/analog_window_data.ipynb)). It builds the land grid, fetches NASA POWER data for every point (with retries for missing points), computes the percentile scores, checks the benchmarks and exports `data/app_points.json`.

## Run locally

Clone the repository, open the folder in VS Code and start **Live Server** on `index.html` (or any static file server).

## Use of AI

This is a solo project. I chose the idea and approach, made the method and design decisions, ran and checked the data pipeline in Google Colab, analysed the candidate sites in NASA Worldview, and tested, integrated and published the app. I used Claude (Anthropic) as an AI assistant along the way: for feedback on ideas, help writing and debugging code, and editing text.

## Licence

MIT
