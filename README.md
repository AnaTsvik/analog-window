# Analog Window

**Where and when Earth becomes Mars or the Moon.**
NASA Space Apps Challenge 2026 · Team AnaLog · Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

Analog Window searches the whole planet for places that behave like Mars or the Moon's south pole, and shows **when** in the year each place is most similar, what a mission could test there, and where the analogy breaks down.

## How it works

1. **Systematic search.** 1,287 land points on a 4° global grid, plus a 1° grid around the strongest regions, with 20-year monthly averages (2001–2020) from NASA POWER.
2. **Twin score.** Each factor (dryness, cold, thin air, UV, day–night swing, clear skies, wind, low sunlight) is scored as a percentile against all of Earth's land, in the target's direction. Mission profiles set the weights, and the sliders change them live.
3. **Analog window.** Every place gets a score for every month, which gives its best test window.
4. **Benchmarks.** Eight well-known analog sites are scored the same way to check the method.
5. **Field test plan.** One place and month for every mission phase, editable, with a printable one-page PDF brief.
6. **Surface check.** The strongest candidates were inspected in NASA Worldview satellite imagery.

## Data

- [NASA POWER](https://power.larc.nasa.gov/) Climatology API
- [NASA Worldview](https://worldview.earthdata.nasa.gov/)
- NASA GIBS map tiles
- [LRO Diviner](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm) (Moon south pole reference)

## Run locally

Open the folder in VS Code and start **Live Server** on `index.html`.

## Use of AI

Built with help from Claude (Anthropic) for brainstorming feedback, code writing and text editing. Site analysis in Worldview and all project decisions are by the team.
