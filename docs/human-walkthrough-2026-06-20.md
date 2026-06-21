# Global Monitor Human Walkthrough

Date: 2026-06-20  
Surface: https://globalmonitor.pages.dev/  
Task: Dieter Rams-style usability and design audit, then execution.

## Walkthrough Method

I tested the deployed Cloudflare Pages URL, not localhost. The flow under test was: app loads -> first meaningful dashboard renders -> primary visible controls respond without runtime errors.

Controls exercised:

- Region tabs: Middle East, Southeast Asia, Thailand.
- Source Health modal.
- Settings modal.
- Basemap selector.
- Flights and ships layer toggles.
- About modal.
- Live traffic and layer state visibility.

Observed first-load metrics:

- 67 buttons in the initial DOM.
- 25 primary panel/card surfaces.
- 22 layer-card controls.
- Region switching worked and swapped the visible geography and regional news context.
- Flights were visible with live ADS-B count. Ships showed an awaiting AIS/fallback state.

## What Works

The application now loads on the deployed URL and does not show the prior blank page. The first viewport communicates that this is a live geopolitical monitor: traffic, clocks, region tabs, map, status panels, and sponsor logos are present.

The theater switcher is conceptually strong. Moving among Middle East, Southeast Asia, and Thailand changes the dashboard subtitle, regional selector, visible geography, and news context. This is the right organizing idea.

The map layer intent is good. Basemaps, operational events, mobility, environment, and satellite data are all present. Flights and ships are treated as real map layers, which is the right mental model.

The source-health and settings surfaces exist. That matters for trust. Users can verify provenance and control intelligence feeds instead of receiving an opaque feed.

## What Fails Humans

The first screen presents too many equal-weight choices. A user sees dozens of buttons, panels, tabs, tickers, clocks, and cards before they understand the primary job: choose a theater, read the map, turn layers on or off, inspect evidence. This creates command-surface fatigue.

Icon-only header controls hide essential abilities. Source health, session log, print, about, refresh, and settings were technically present, but they depended on title/tooltip discovery. On a dense dashboard, hidden labels are expensive, but putting every utility action in the top bar is also noisy.

Layer controls had weak hierarchy. Basic basemap selection, operational overlays, mobility overlays, environmental overlays, and specialist satellite catalogs were visually close enough to feel like one large button pile. This made satellite layers especially confusing to click.

Modal close controls were inconsistent. The Source Health close button had visible text but no specific accessible name. The Settings modal used "Close settings" while the test path expected a stronger modal-specific name. This is a small code issue with a large usability signal: close affordances must be boring and obvious.

The right sidebar is over-prioritized. It stacks many cards of similar visual weight, so the user cannot quickly know which panel is mission-critical versus supporting context.

The bottom bar is dense but not edited. It contains valuable data, but the rhythm reads as "everything at once." The visual system should make the map and layer state primary, then let secondary analytics support the reading.

The live site still exposes backend staleness. The frontend can be current while some API surfaces show offline, awaiting AIS feed, or fallback status. That must be explicit instead of visually feeling like the UI is broken.

## Design Direction

Dieter Rams for this dashboard means:

- Less but better: fewer visible first-order controls, with specialist controls behind deliberate disclosure.
- Good design is understandable: labels on utility controls, clear active states, consistent modal names.
- Good design is unobtrusive: flat panels, hairline borders, no glossy blur, no ambient gradients.
- Good design is honest: stale/offline backend states remain visible, but they should read as status, not failure.
- Good design makes the product useful: map, theater, layers, and evidence should dominate the first viewport.

## Executed Changes

- Header utility controls now live behind a labeled Tools menu: Data health, Session log, News sources, Print briefing, About, and Refresh data.
- The core map layer system has a visible active-layer count and quick actions for Core Ops, Flights, and Ships.
- Basemaps now read as a separate radiogroup with stronger selected-state treatment.
- Satellite layers are moved behind an explicit "Satellite Layers" disclosure control, grouped by Sentinel/ESA, NASA/GIBS, and International sources.
- Source Agencies are moved behind an explicit disclosure control.
- Operational layers now have clearer active states, including a left rule and stronger contrast.
- The cursor coordinate readout was removed from the default map view to reduce motion/clutter while reading the operating picture.
- The floating focus-area selector now has an explicit "Focus area" label and accessible target names.
- Source Health and Settings close buttons now have modal-specific accessible labels.
- Remaining blur/filter treatments were stripped from the About and Source Health modals.
- About-modal sponsor and partner logos now render in natural color on white pills instead of CSS brightness/invert filters.
- The grid was tightened: disciplined clock/header rows, flatter panel surfaces, and a reduced bottom analytics footprint.

## Remaining Recommendations

The next pass should reduce the right sidebar by adding a priority model: "Critical", "Context", and "Archive" or a compact disclosure pattern. This would preserve density without making every panel compete.

The backend deployment should be brought to parity with the frontend. The UI now communicates status more honestly; production API runs on Cloudflare Pages Functions at the same origin.

The activity log and settings modal should eventually move away from large inline styles into shared modal primitives. The immediate accessibility bug is fixed, but a shared primitive would prevent future drift.

The mobile layout should receive a separate pass after the desktop operational screen stabilizes. The current goal is the 72-inch / command-center experience first.
