# VIQRC Enhanced

A Chrome extension that enhances the [RobotEvents](https://www.robotevents.com) experience for VEX IQ Robotics Competition (VIQRC) with statistics, team tracking, match data, and awards.

## Features

### Skills Standings Page
- **Competition Team Import**: Load teams registered for a specific event by competition ID - highlights them in green
- **Team Highlighting**: Highlight specific teams manually to track them (highlighted in yellow)
- **Statistics Panel**: View average scores, max scores, and medians at a glance
- **Percentile Column**: See how each team's score ranks as a percentile
- **Score Visualization**: Visual score bars showing relative performance
- **Quick Filter**: Instantly filter the table by team number
- **Data Export**: Export standings to CSV or JSON format
- **Persistent Settings**: Your highlighted teams and loaded competitions are saved between sessions

### Event Pages
- **Enhanced Team Table**: Replaces the default team list with a sortable, searchable table
- **Skills Scores**: Shows each team's combined, autonomous, and driver skills scores
- **Match Averages**: Displays recent match performance (average and max scores)
- **Awards Display**: Shows awards earned (event-specific for completed events, season awards for upcoming events)
- **Award Filtering**: Dynamically filter which award types to display
- **Team Details Modal**: Click any team row to see detailed information including match history
- **Team Capture**: Capture registered teams to highlight them on the Skills Standings page

## Installation

### 1. Generate Icons

1. Open `generate-icons.html` in your browser
2. Right-click each icon and save to the `icons/` folder as:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `SkillsPlugin` folder
5. The extension is now installed!

### 3. Configure API Token (Optional but Recommended)

To enable match data and awards features:

1. Go to [robotevents.com/api/v2](https://www.robotevents.com/api/v2) and create an API token
2. On any event page, click the Settings gear icon
3. Enter your API token and click Save
4. Reload the page to see match averages and awards

### 4. Use the Extension

**Skills Standings Page:**
1. Navigate to https://www.robotevents.com/robot-competitions/vex-iq-competition/standings/skills
2. A control panel will appear on the right side of the page
3. Use the panel to highlight teams, view stats, and export data

**Event Pages:**
1. Navigate to any VEX IQ event page (e.g., `robotevents.com/.../RE-VIQRC-25-xxxx.html`)
2. The team table will be enhanced automatically with skills and match data
3. Click the Settings gear to configure match history filters and award display

## Usage Guide

### Load Competition Teams

This feature allows you to import all teams registered for a specific event and highlight them on the skills standings page.

**Method 1: From the Skills Page**
1. Enter a competition ID (e.g., `RE-VIQRC-25-2623`) in the "Competition Teams" input
2. Click "Open Event Page" - this opens the event in a new tab
3. On the event page, click the red **"Capture Teams for Skills Page"** button
4. Return to the Skills Standings page and click **"Refresh Data"**
5. Teams from that event will now be highlighted in **green**

**Method 2: Direct from Event Page**
1. Navigate directly to any event page (e.g., `robotevents.com/.../RE-VIQRC-25-2623.html`)
2. Click the **"Capture Teams for Skills Page"** button in the bottom-right corner
3. Go to the Skills Standings page - teams will be highlighted automatically

**Why this workflow?**
The event pages load team data dynamically via JavaScript, so we need to capture the teams from the actual rendered page rather than fetching the raw HTML.

You can load multiple competitions - all their teams will be highlighted simultaneously.

### Highlight Teams (Manual)

1. Enter one or more team numbers in the input field (comma-separated for multiple)
2. Click "Add" or press Enter
3. Highlighted teams will have a **yellow** background in the table
4. Click the × on a team tag to remove the highlight

**Note:** Teams that are both manually highlighted AND in a loaded competition will show a split yellow/green background.

### Event Page Features

**Match History Filter:**
- Filter by events since a specific date
- Filter by last N events
- Show all events

**Award Filtering:**
- Checkboxes for each award type found in the data
- Changes apply immediately (no page reload needed)
- Filter resets on page refresh

**For Completed Events:**
- Shows skills scores and match data from that specific event
- Displays awards earned at that event

**For Upcoming Events:**
- Shows global skills rankings
- Displays recent match averages based on filter settings
- Shows season awards earned at other events

### View Statistics

The Statistics section shows:
- Total number of teams displayed
- Average, maximum, and median scores
- Average autonomous and driver skills scores

### Toggle Features

- **Show percentiles in table**: Adds a column showing each team's percentile rank
- **Show score bars**: Adds visual bars under scores showing relative performance

### Export Data

- **Export to CSV**: Downloads all visible data as a spreadsheet-compatible file
- **Export to JSON**: Downloads data in JSON format for programmatic use

### Quick Filter

Type in the filter box to instantly show only teams matching your search.

## File Structure

```
SkillsPlugin/
├── manifest.json       # Extension configuration
├── content.js          # Skills standings page enhancements
├── event-page.js       # Event page enhancements
├── styles.css          # Styles for skills standings page
├── event-styles.css    # Styles for event pages
├── generate-icons.html # Tool to generate extension icons
├── icons/
│   ├── icon16.png      # Small icon (toolbar)
│   ├── icon48.png      # Medium icon
│   └── icon128.png     # Large icon (store/management)
├── CLAUDE.md           # Development guidelines for AI assistants
└── README.md           # This file
```

## Troubleshooting

**Extension doesn't appear on the page:**
- Make sure you're on the correct URL pattern
- Try refreshing the page
- Check that the extension is enabled in `chrome://extensions/`

**Icons are missing:**
- Open `generate-icons.html` and save the generated icons to the `icons/` folder
- Reload the extension in `chrome://extensions/`

**Settings not saving:**
- The extension uses localStorage; ensure it's not blocked
- Check browser console for errors

**Match data not loading:**
- Ensure you have configured an API token in Settings
- Check that the token is valid at robotevents.com/api/v2
- API rate limits may cause temporary failures (the extension retries automatically)

**Awards not showing:**
- Awards require an API token
- For upcoming events, awards show season-wide achievements
- For completed events, awards show event-specific achievements

## Development

To modify the extension:

1. Edit the source files (`content.js`, `event-page.js`, `styles.css`, `event-styles.css`)
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the page to see changes

See `CLAUDE.md` for development guidelines and technical details.

## License

MIT License - Feel free to modify and distribute.
