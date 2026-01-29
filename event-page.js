// VEX IQ Skills Enhancer - Event Page Script
// This script runs on competition event pages to capture registered teams
(function() {
  'use strict';

  const CONFIG = {
    storageKey: 'vex-skills-enhancer-settings'
  };

  // Extract competition ID from URL
  function getCompetitionId() {
    const match = window.location.pathname.match(/(RE-[A-Z]+-\d+-\d+)/i);
    return match ? match[1] : null;
  }

  // Extract event name from page
  function getEventName() {
    return document.querySelector('h1')?.textContent?.trim() ||
           document.querySelector('.event-name')?.textContent?.trim() ||
           getCompetitionId() ||
           'Unknown Event';
  }

  // Extract capacity from page
  function getCapacity() {
    const text = document.body.textContent;
    const match = text.match(/Capacity:\s*(\d+)/i);
    return match ? match[1] : '';
  }

  // Extract teams from the page
  function extractTeams() {
    const teams = [];

    // Use the specific selector for the teams table
    const teamsTableSelectors = [
      '#api-app > div:nth-child(4) > div > div > div.col-md-10 > div > div > div > section:nth-child(10) > div > table',
      '#api-app table',
      'section:has(h4:contains("Teams")) table',
      'table'
    ];

    let teamsTable = null;
    for (const selector of teamsTableSelectors) {
      try {
        teamsTable = document.querySelector(selector);
        if (teamsTable) break;
      } catch (e) {
        // Some selectors may not be valid, continue trying
      }
    }

    if (teamsTable) {
      const rows = teamsTable.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
          // Check for team links first
          const teamLink = cell.querySelector('a[href*="/teams/"]');
          if (teamLink) {
            const text = teamLink.textContent.trim();
            const teamMatch = text.match(/(\d{1,5}[A-Z]?)/i);
            if (teamMatch) {
              teams.push(teamMatch[1].toUpperCase());
            }
          }
        });
      });
    }

    // Also search all team links on the page as backup
    if (teams.length === 0) {
      const teamLinks = document.querySelectorAll('a[href*="/teams/"]');
      teamLinks.forEach(link => {
        const text = link.textContent.trim();
        const teamMatch = text.match(/^(\d{1,5}[A-Z]?)$/i);
        if (teamMatch && !teams.includes(teamMatch[1].toUpperCase())) {
          teams.push(teamMatch[1].toUpperCase());
        }
      });
    }

    return [...new Set(teams)]; // Remove duplicates
  }

  // Load existing settings
  function loadSettings() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKey);
      return saved ? JSON.parse(saved) : { competitionTeams: {} };
    } catch (e) {
      return { competitionTeams: {} };
    }
  }

  // Save settings
  function saveSettings(settings) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(settings));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  }

  // Create the capture button
  function createCaptureButton() {
    const competitionId = getCompetitionId();
    if (!competitionId) return;

    const button = document.createElement('div');
    button.id = 'vex-capture-button';
    button.innerHTML = `
      <button id="vex-capture-teams">
        <span class="vex-capture-icon">📋</span>
        <span class="vex-capture-text">Capture Teams for Skills Page</span>
      </button>
      <div id="vex-capture-status"></div>
    `;

    document.body.appendChild(button);

    document.getElementById('vex-capture-teams').addEventListener('click', () => {
      captureTeams();
    });
  }

  // Capture teams and save to storage
  function captureTeams() {
    const competitionId = getCompetitionId();
    const status = document.getElementById('vex-capture-status');

    if (!competitionId) {
      status.innerHTML = '<span class="vex-error">Could not determine competition ID</span>';
      return;
    }

    const teams = extractTeams();
    const eventName = getEventName();
    const capacity = getCapacity();

    if (teams.length === 0) {
      status.innerHTML = '<span class="vex-warning">No teams found on this page. Make sure the teams table is visible.</span>';
      return;
    }

    // Save to storage
    const settings = loadSettings();
    settings.competitionTeams = settings.competitionTeams || {};
    settings.competitionTeams[competitionId] = {
      teams: teams,
      name: eventName,
      capacity: capacity,
      fetchedAt: new Date().toISOString()
    };

    saveSettings(settings);

    status.innerHTML = `
      <span class="vex-success">
        ✓ Captured ${teams.length} teams from "${eventName}"!<br>
        <small>Go to the <a href="https://www.robotevents.com/robot-competitions/vex-iq-competition/standings/skills" target="_blank">Skills Standings page</a> to see them highlighted.</small>
      </span>
    `;

    // Update button text
    document.querySelector('.vex-capture-text').textContent = `Update Teams (${teams.length} captured)`;
  }

  // Check if teams are already captured for this event
  function checkExistingCapture() {
    const competitionId = getCompetitionId();
    if (!competitionId) return;

    const settings = loadSettings();
    const existing = settings.competitionTeams?.[competitionId];

    if (existing && existing.teams?.length > 0) {
      const status = document.getElementById('vex-capture-status');
      const captureText = document.querySelector('.vex-capture-text');

      if (status) {
        status.innerHTML = `<span class="vex-info">Previously captured ${existing.teams.length} teams</span>`;
      }
      if (captureText) {
        captureText.textContent = `Update Teams (${existing.teams.length} captured)`;
      }
    }
  }

  // Initialize
  function init() {
    // Wait for the page to fully load (including dynamic content)
    setTimeout(() => {
      createCaptureButton();
      checkExistingCapture();
    }, 1500); // Give time for dynamic content to load
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
