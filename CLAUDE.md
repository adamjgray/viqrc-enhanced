# CLAUDE.md - Development Guidelines for VIQRC Enhanced

This file provides context and guidelines for AI assistants working on this codebase.

## Project Overview

VIQRC Enhanced is a Chrome extension (Manifest V3) that enhances the RobotEvents website for VEX IQ Robotics Competition. It has two main content scripts:

1. **content.js** - Runs on the Skills Standings page (`/standings/skills`)
2. **event-page.js** - Runs on individual event pages (`/RE-VIQRC-*.html`)

## Key Technical Details

### API Endpoints

The extension uses two types of APIs:

**Public Skills API (no auth required):**
```
https://www.robotevents.com/api/seasons/{season_id}/skills?grade_level={level}
```

**RobotEvents API v2 (requires Bearer token):**
- Events: `GET /api/v2/events?sku[]={sku}`
- Event Skills: `GET /api/v2/events/{id}/skills`
- Event Awards: `GET /api/v2/events/{id}/awards`
- Team Matches: `GET /api/v2/teams/{id}/matches?season[]={season_id}`
- Team Awards: `GET /api/v2/teams/{id}/awards?season[]={season_id}&program[]={program_id}`
- Team Lookup: `GET /api/v2/teams?number[]={numbers}&program[]={program_id}&season[]={season_id}`

### Important IDs

- **Program ID 41** = VEX IQ Competition (VIQRC)
- **Season ID 196** = VEX IQ 2024-2025 season

**IMPORTANT:** When fetching team data, ALWAYS include `program[]=41` to filter to VEX IQ teams only. VRC teams can have the same team numbers, and without the program filter, incorrect teams may be returned.

### Event Finalization

Use the `awards_finalized` field from the events API to determine if an event has completed:
- **Finalized events**: Show event-specific skills scores, match data, and awards from that event
- **Non-finalized events**: Show global skills rankings, recent match history, and season-wide awards

### Rate Limiting

The RobotEvents API enforces rate limits. The extension implements:
- Exponential backoff retry (1s, 2s, 4s delays)
- Respects `Retry-After` header when present
- Batches team requests (5 at a time) with small delays between batches

## Code Patterns

### Settings Storage

Settings are stored in localStorage under key `vex-skills-enhancer-settings`:
```javascript
{
  apiToken: "bearer_token_here",
  competitionTeams: { "RE-VIQRC-25-xxxx": { teams: [...], name: "...", ... } },
  highlightedTeams: ["1234A", "5678B"],
  matchFilterType: "since_date" | "last_n_events" | "all_events",
  matchFilterDate: "2024-01-01",
  matchFilterCount: 5
}
```

Note: Award filtering is session-only (stored in `hiddenAwardNames` Set, not persisted).

### Debug Logging

Both scripts have a debug mode controlled by `CONFIG.debug`:
```javascript
const CONFIG = {
  debug: false  // Set to true for verbose logging
};
```

Use `debug()` for development logging that can be toggled off.

### Error Handling

- All API calls should be wrapped in try/catch
- Use `fetchWithRetry()` for API calls to handle rate limiting
- Gracefully degrade when API token is not configured (hide API-dependent columns)
- Never let errors break page loading - catch and continue

## Common Pitfalls

1. **Team number collisions**: VRC and VIQRC teams can have the same numbers. Always filter by program ID.

2. **Async timing**: The settings panel is created after data loading. Any UI that depends on loaded data must be populated after the panel exists (see `populateAwardFilter()`).

3. **Event detection**: Don't rely on page scraping to detect event status. Use the API's `awards_finalized` field.

4. **Award names**: Award names from the API include suffixes like "(VIQRC)" or "(Elementary)". Filter matching should be case-insensitive and use substring matching.

## File Responsibilities

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config, permissions, content script registration |
| `content.js` | Skills standings page - stats panel, team highlighting, export |
| `event-page.js` | Event pages - enhanced table, match data, awards, team capture |
| `styles.css` | Styles for skills standings page enhancements |
| `event-styles.css` | Styles for event page enhancements |

## Testing Checklist

When making changes, test on:
- [ ] Skills standings page (with/without API token)
- [ ] Upcoming event page (non-finalized)
- [ ] Completed event page (finalized, `awards_finalized: true`)
- [ ] Event with no registered teams
- [ ] Teams with no skills scores
- [ ] Teams with no match history

## Version Management

- Version is tracked in `manifest.json`
- Use semantic versioning (MAJOR.MINOR.PATCH)
- GitHub Actions builds releases on version tags (`v*`)
