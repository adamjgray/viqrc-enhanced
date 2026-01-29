# VIQRC Enhanced

A Chrome extension that enhances the [RobotEvents](https://www.robotevents.com) experience for VEX IQ Robotics Competition (VIQRC) with statistics, team tracking, and match data.

## Features

- **Competition Team Import**: Load teams registered for a specific event by competition ID - highlights them in green
- **Team Highlighting**: Highlight specific teams manually to track them (highlighted in yellow)
- **Statistics Panel**: View average scores, max scores, and medians at a glance
- **Percentile Column**: See how each team's score ranks as a percentile
- **Score Visualization**: Visual score bars showing relative performance
- **Quick Filter**: Instantly filter the table by team number
- **Data Export**: Export standings to CSV or JSON format
- **Persistent Settings**: Your highlighted teams and loaded competitions are saved between sessions

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

### 3. Use the Extension

1. Navigate to https://www.robotevents.com/robot-competitions/vex-iq-competition/standings/skills
2. A control panel will appear on the right side of the page
3. Use the panel to highlight teams, view stats, and export data

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
├── manifest.json      # Extension configuration
├── content.js         # Main enhancement script
├── styles.css         # Styling for the panel and table additions
├── generate-icons.html # Tool to generate extension icons
├── icons/
│   ├── icon16.png     # Small icon (toolbar)
│   ├── icon48.png     # Medium icon
│   └── icon128.png    # Large icon (store/management)
└── README.md          # This file
```

## Troubleshooting

**Extension doesn't appear on the page:**
- Make sure you're on the correct URL: `robotevents.com/robot-competitions/vex-iq-competition/standings/skills`
- Try refreshing the page
- Check that the extension is enabled in `chrome://extensions/`

**Icons are missing:**
- Open `generate-icons.html` and save the generated icons to the `icons/` folder
- Reload the extension in `chrome://extensions/`

**Settings not saving:**
- The extension uses localStorage; ensure it's not blocked
- Check browser console for errors

## Development

To modify the extension:

1. Edit the source files (`content.js`, `styles.css`)
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the standings page to see changes

## License

MIT License - Feel free to modify and distribute.
