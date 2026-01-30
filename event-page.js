// VIQRC Enhanced - Event Page Script
// This script runs on competition event pages to capture registered teams and show skills data
(function() {
  'use strict';

  const CONFIG = {
    name: 'VIQRC Enhanced',
    storageKey: 'vex-skills-enhancer-settings',
    skillsApiUrl: 'https://www.robotevents.com/api/seasons/196/skills',
    debug: false  // Set to true for verbose logging
  };

  // Logging utilities
  const log = (...args) => console.log(`${CONFIG.name} -`, ...args);
  const debug = (...args) => CONFIG.debug && console.log(`${CONFIG.name} [DEBUG] -`, ...args);
  const error = (...args) => console.error(`${CONFIG.name} -`, ...args);

  let eventTeams = [];      // Teams registered for this event
  let skillsData = null;    // Skills data for all teams
  let matchAverages = null; // Recent match averages for teams
  let sortColumn = 'score';
  let sortDirection = 'desc';

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
        let teamNum = '';
        let teamName = '';
        let organization = '';
        let location = '';

        cells.forEach((cell, idx) => {
          // Check for team links first
          const teamLink = cell.querySelector('a[href*="/teams/"]');
          if (teamLink) {
            const text = teamLink.textContent.trim();
            const teamMatch = text.match(/(\d{1,5}[A-Z]?)/i);
            if (teamMatch) {
              teamNum = teamMatch[1].toUpperCase();
            }
          }
          // Try to get team name and org from other cells
          const text = cell.textContent.trim();
          if (idx === 1 && !teamLink) teamName = text;
          if (idx === 2) organization = text;
          if (idx === 3) location = text;
        });

        if (teamNum) {
          teams.push({
            team: teamNum,
            teamName: teamName,
            organization: organization,
            location: location
          });
        }
      });
    }

    // Also search all team links on the page as backup
    if (teams.length === 0) {
      const teamLinks = document.querySelectorAll('a[href*="/teams/"]');
      teamLinks.forEach(link => {
        const text = link.textContent.trim();
        const teamMatch = text.match(/^(\d{1,5}[A-Z]?)$/i);
        if (teamMatch) {
          const teamNum = teamMatch[1].toUpperCase();
          if (!teams.find(t => t.team === teamNum)) {
            teams.push({ team: teamNum, teamName: '', organization: '', location: '' });
          }
        }
      });
    }

    return teams;
  }

  // Fetch skills data from API
  async function fetchSkillsData() {
    try {
      // Get grade level from page if possible
      const gradeLevel = document.body.textContent.includes('Middle School') ? 'Middle School' :
                        document.body.textContent.includes('Elementary') ? 'Elementary' : '';

      let url = `${CONFIG.skillsApiUrl}?post_season=0`;
      if (gradeLevel) {
        url += `&grade_level=${encodeURIComponent(gradeLevel)}`;
      }

      debug('Fetching skills data');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      debug('Received', data.length, 'teams from skills API');

      // Create a map for quick lookup
      skillsData = new Map();
      data.forEach(item => {
        const teamNum = item.team?.team?.toUpperCase();
        if (teamNum) {
          skillsData.set(teamNum, {
            teamId: item.team?.id || null,
            score: parseFloat(item.scores?.score || 0),
            programming: parseFloat(item.scores?.programming || 0),
            driver: parseFloat(item.scores?.driver || 0),
            rank: item.rank || 0,
            gradeLevel: item.team?.gradeLevel || '',
            city: item.team?.city || '',
            region: item.team?.region || '',
            country: item.team?.country || ''
          });
        }
      });

      return true;
    } catch (err) {
      error('Failed to fetch skills data:', err);
      return false;
    }
  }

  // Fetch match data for a team and calculate recent match average
  async function fetchRecentMatchAverage(teamId) {
    if (!teamId) return null;

    try {
      const url = `https://www.robotevents.com/api/v2/teams/${teamId}/matches?season%5B%5D=196&per_page=250`;
      debug('Fetching matches from:', url);
      const settings = loadSettings();
      const headers = {};
      if (settings.apiToken) {
        headers['Authorization'] = `Bearer ${settings.apiToken}`;
      }
      const response = await fetch(url, { headers });
      debug('Response status:', response.status);
      if (!response.ok) {
        debug('Response not ok, body:', await response.text().catch(() => 'N/A'));
        return null;
      }

      const data = await response.json();
      debug('Match data for team', teamId, ':', data);
      const matches = data.data || [];
      debug('Total matches:', matches.length);

      // Filter to matches from the last 2 months
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      debug('Filtering matches since:', twoMonthsAgo.toISOString());

      const recentMatches = matches.filter(match => {
        if (!match.updated_at) {
          return false;
        }
        const matchDate = new Date(match.updated_at);
        const isRecent = matchDate >= twoMonthsAgo;
        // Check if any alliance has a score (more reliable than scored boolean)
        const hasScores = match.alliances?.some(a => a.score !== undefined && a.score !== null);
        return isRecent && hasScores;
      });

      debug('Recent scored matches:', recentMatches.length);
      if (recentMatches.length === 0) return null;

      // Calculate average and max score for this team across recent matches
      let totalScore = 0;
      let maxScore = 0;
      let matchCount = 0;

      recentMatches.forEach(match => {
        // Find which alliance the team was on (red or blue)
        for (const alliance of match.alliances || []) {
          const teamOnAlliance = alliance.teams?.some(t => t.team?.id === teamId);
          if (teamOnAlliance && alliance.score !== undefined) {
            debug('Team', teamId, 'on', alliance.color, 'alliance, score:', alliance.score);
            totalScore += alliance.score;
            maxScore = Math.max(maxScore, alliance.score);
            matchCount++;
            break;
          }
        }
      });

      debug('Match count:', matchCount, 'Total score:', totalScore, 'Max:', maxScore, 'Avg:', matchCount > 0 ? totalScore / matchCount : 0);
      if (matchCount === 0) return null;

      return {
        average: Math.round(totalScore / matchCount),
        max: maxScore,
        matchCount: matchCount
      };
    } catch (err) {
      error('Failed to fetch match data for team', teamId, err);
      return null;
    }
  }

  // Fetch match averages for all teams (with rate limiting)
  async function fetchAllMatchAverages(teams) {
    const matchAverages = new Map();

    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < teams.length; i += batchSize) {
      const batch = teams.slice(i, i + batchSize);
      const promises = batch.map(async team => {
        if (team.teamId) {
          const result = await fetchRecentMatchAverage(team.teamId);
          if (result) {
            matchAverages.set(team.team, result);
          }
        }
      });
      await Promise.all(promises);

      // Small delay between batches
      if (i + batchSize < teams.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return matchAverages;
  }

  // Calculate percentile
  function getPercentile(score, allScores) {
    if (allScores.length === 0) return 0;
    const below = allScores.filter(s => s < score).length;
    return Math.round((below / allScores.length) * 100);
  }

  // Build enhanced teams table
  function buildEnhancedTable() {
    if (eventTeams.length === 0) return;

    // Find the teams section
    const teamsSection = document.querySelector('#api-app table')?.closest('section') ||
                        document.querySelector('#api-app table')?.closest('div');
    if (!teamsSection) return;

    // Hide original table
    const originalTable = teamsSection.querySelector('table');
    if (originalTable) originalTable.style.display = 'none';

    // Create or get our container
    let container = document.getElementById('vex-event-table-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vex-event-table-container';
      if (originalTable) {
        originalTable.parentNode.insertBefore(container, originalTable);
      } else {
        teamsSection.appendChild(container);
      }
    }

    // Merge event teams with skills data and match averages
    const mergedData = eventTeams.map(team => {
      const skills = skillsData?.get(team.team) || {};
      const matchAvg = matchAverages?.get(team.team) || null;
      return {
        ...team,
        teamId: skills.teamId || null,
        score: skills.score || 0,
        programming: skills.programming || 0,
        driver: skills.driver || 0,
        gradeLevel: skills.gradeLevel || '',
        city: skills.city || team.location?.split(',')[0]?.trim() || '',
        region: skills.region || '',
        country: skills.country || '',
        recentMatchAvg: matchAvg?.average || null,
        recentMatchMax: matchAvg?.max || null,
        recentMatchCount: matchAvg?.matchCount || 0
      };
    });

    // Sort data
    mergedData.sort((a, b) => {
      const aVal = a[sortColumn] || 0;
      const bVal = b[sortColumn] || 0;
      if (typeof aVal === 'string') {
        return sortDirection === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Assign local ranks
    mergedData.forEach((item, idx) => item.rank = idx + 1);

    // Calculate stats
    const scores = mergedData.map(t => t.score).filter(s => s > 0);
    const allScores = skillsData ? Array.from(skillsData.values()).map(s => s.score) : scores;
    const teamsWithScores = mergedData.filter(t => t.score > 0).length;

    // Sort indicator helper
    const sortIndicator = (col) => {
      if (sortColumn !== col) return '<span class="vex-sort-icon">⇅</span>';
      return sortDirection === 'desc' ? '<span class="vex-sort-icon active">↓</span>' : '<span class="vex-sort-icon active">↑</span>';
    };

    // Build table
    let html = `
      <div class="vex-event-controls">
        <input type="text" id="vex-event-search" placeholder="Search teams..." />
        <span class="vex-event-count">${mergedData.length} teams (${teamsWithScores} with skills scores)</span>
      </div>
      <table class="vex-event-table">
        <thead>
          <tr>
            <th>#</th>
            <th class="vex-sortable" data-sort="team">Team ${sortIndicator('team')}</th>
            <th>Team Name</th>
            <th>Organization</th>
            <th class="vex-sortable" data-sort="score">Score ${sortIndicator('score')}</th>
            <th class="vex-sortable" data-sort="programming">Auto ${sortIndicator('programming')}</th>
            <th class="vex-sortable" data-sort="driver">Driver ${sortIndicator('driver')}</th>
            <th class="vex-sortable" data-sort="recentMatchAvg">Match Avg ${sortIndicator('recentMatchAvg')}</th>
            <th class="vex-sortable" data-sort="recentMatchMax">Match Max ${sortIndicator('recentMatchMax')}</th>
          </tr>
        </thead>
        <tbody>
    `;

    mergedData.forEach((team, idx) => {
      const searchText = `${team.team} ${team.teamName} ${team.organization}`.toLowerCase();
      const matchAvgDisplay = team.recentMatchAvg !== null
        ? `<span title="${team.recentMatchCount} matches in last 2 months">${team.recentMatchAvg}</span>`
        : '-';
      const matchMaxDisplay = team.recentMatchMax !== null ? team.recentMatchMax : '-';

      html += `
        <tr data-team="${team.team}" data-search="${searchText}" data-idx="${idx}">
          <td>${idx + 1}</td>
          <td class="vex-team-number">${team.team}</td>
          <td>${team.teamName || '-'}</td>
          <td>${team.organization || '-'}</td>
          <td class="vex-score-cell">${team.score || '-'}</td>
          <td>${team.programming || '-'}</td>
          <td>${team.driver || '-'}</td>
          <td>${matchAvgDisplay}</td>
          <td>${matchMaxDisplay}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';

    // Stats summary
    if (teamsWithScores > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const maxScore = Math.max(...scores);
      const sortedScores = [...scores].sort((a, b) => a - b);
      const median = sortedScores[Math.floor(sortedScores.length / 2)];

      html += `
        <div class="vex-event-stats">
          <span><strong>Event Stats:</strong></span>
          <span>Avg: ${avgScore.toFixed(1)}</span>
          <span>Max: ${maxScore}</span>
          <span>Median: ${median}</span>
        </div>
      `;
    }

    container.innerHTML = html;

    // Store merged data for modal
    container._mergedData = mergedData;
    container._allScores = allScores;

    // Setup search
    document.getElementById('vex-event-search')?.addEventListener('input', (e) => {
      const filter = e.target.value.toLowerCase().trim();
      const rows = container.querySelectorAll('tbody tr');
      let visibleCount = 0;
      rows.forEach(row => {
        const searchText = row.dataset.search || '';
        const matches = !filter || searchText.includes(filter);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
      });
      container.querySelector('.vex-event-count').textContent =
        filter ? `${visibleCount} of ${mergedData.length} teams` : `${mergedData.length} teams (${teamsWithScores} with skills scores)`;
    });

    // Setup sorting
    container.querySelectorAll('.vex-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
          sortColumn = col;
          sortDirection = col === 'team' ? 'asc' : 'desc';
        }
        buildEnhancedTable();
      });
    });

    // Setup row click for modal
    container.querySelectorAll('tbody tr').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.idx);
        const team = container._mergedData[idx];
        if (team) showTeamModal(team, container._allScores);
      });
    });

    debug('Table built with', mergedData.length, 'teams');
  }

  // Show team modal
  function showTeamModal(team, allScores) {
    const existingModal = document.getElementById('vex-team-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'vex-team-modal';
    modal.className = 'vex-modal-overlay';
    modal.innerHTML = `
      <div class="vex-modal">
        <div class="vex-modal-header">
          <h2><a href="https://www.robotevents.com/teams/VIQRC/${team.team}" target="_blank">${team.team} - ${team.teamName || 'Unknown'}</a></h2>
          <button class="vex-modal-close">&times;</button>
        </div>
        <div class="vex-modal-body">
          <div class="vex-modal-section">
            <h3>Team Information</h3>
            <div class="vex-modal-grid">
              <div class="vex-modal-item">
                <span class="vex-modal-label">Team Number</span>
                <span class="vex-modal-value">${team.team}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Team Name</span>
                <span class="vex-modal-value">${team.teamName || 'N/A'}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Organization</span>
                <span class="vex-modal-value">${team.organization || 'N/A'}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Location</span>
                <span class="vex-modal-value">${[team.city, team.region, team.country].filter(Boolean).join(', ') || team.location || 'N/A'}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Grade Level</span>
                <span class="vex-modal-value">${team.gradeLevel || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div class="vex-modal-section">
            <h3>Skills Scores</h3>
            ${team.score > 0 ? `
            <div class="vex-modal-grid">
              <div class="vex-modal-item">
                <span class="vex-modal-label">Combined Score</span>
                <span class="vex-modal-value vex-modal-score">${team.score}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Autonomous</span>
                <span class="vex-modal-value">${team.programming}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Driver</span>
                <span class="vex-modal-value">${team.driver}</span>
              </div>
            </div>
            ` : '<p style="color: #888;">No skills scores recorded yet.</p>'}
          </div>

          <div class="vex-modal-section">
            <h3>Recent Match Performance</h3>
            ${team.recentMatchAvg !== null ? `
            <div class="vex-modal-grid">
              <div class="vex-modal-item">
                <span class="vex-modal-label">Average Score</span>
                <span class="vex-modal-value vex-modal-score">${team.recentMatchAvg}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Max Score</span>
                <span class="vex-modal-value vex-modal-score">${team.recentMatchMax}</span>
              </div>
              <div class="vex-modal-item">
                <span class="vex-modal-label">Matches (Last 2 Months)</span>
                <span class="vex-modal-value">${team.recentMatchCount}</span>
              </div>
            </div>
            ` : '<p style="color: #888;">No recent match data available.</p>'}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.vex-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });
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

  // Create the capture button and settings panel
  function createCaptureButton() {
    const competitionId = getCompetitionId();
    if (!competitionId) return;

    const settings = loadSettings();

    const button = document.createElement('div');
    button.id = 'vex-capture-button';
    button.innerHTML = `
      <button id="vex-capture-teams">
        <span class="vex-capture-icon">📋</span>
        <span class="vex-capture-text">Capture Teams for Skills Page</span>
      </button>
      <div id="vex-capture-status"></div>
      <div id="vex-settings-toggle" style="margin-top: 8px; font-size: 12px; color: #666; cursor: pointer;">⚙️ Settings</div>
      <div id="vex-settings-panel" style="display: none; margin-top: 8px; padding: 12px; background: white; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <label style="display: block; font-size: 12px; color: #333; margin-bottom: 4px;">RobotEvents API Token:</label>
        <input type="password" id="vex-api-token" placeholder="Enter API token" value="${settings.apiToken || ''}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
        <button id="vex-save-token" style="margin-top: 8px; padding: 6px 12px; background: #c41230; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Save Token</button>
        <div id="vex-token-status" style="margin-top: 4px; font-size: 11px;"></div>
        <p style="margin-top: 8px; font-size: 11px; color: #888;">Get your token from <a href="https://www.robotevents.com/api/v2" target="_blank" style="color: #c41230;">robotevents.com/api/v2</a></p>
      </div>
    `;

    document.body.appendChild(button);

    document.getElementById('vex-capture-teams').addEventListener('click', () => {
      captureTeams();
    });

    // Settings toggle
    document.getElementById('vex-settings-toggle').addEventListener('click', () => {
      const panel = document.getElementById('vex-settings-panel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // Save token
    document.getElementById('vex-save-token').addEventListener('click', () => {
      const token = document.getElementById('vex-api-token').value.trim();
      const settings = loadSettings();
      settings.apiToken = token;
      saveSettings(settings);
      document.getElementById('vex-token-status').innerHTML = '<span style="color: green;">✓ Token saved! Reload page to fetch match data.</span>';
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

    const teams = eventTeams.map(t => t.team);
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
  async function init() {
    log('loaded');

    // Wait for the page to fully load (including dynamic content)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract teams from the page
    eventTeams = extractTeams();
    debug('Found', eventTeams.length, 'teams on page');

    if (eventTeams.length > 0) {
      // Fetch skills data
      await fetchSkillsData();

      // Build initial table (without match averages)
      buildEnhancedTable();

      // Fetch match averages in the background and rebuild table when done
      if (skillsData) {
        const teamsWithIds = eventTeams.map(team => ({
          team: team.team,
          teamId: skillsData.get(team.team)?.teamId || null
        })).filter(t => t.teamId);

        debug('Teams with IDs:', teamsWithIds);
        debug('Fetching match data for', teamsWithIds.length, 'teams...');
        matchAverages = await fetchAllMatchAverages(teamsWithIds);
        debug('Got match averages for', matchAverages.size, 'teams');

        // Rebuild table with match averages
        buildEnhancedTable();
      }
    }

    // Create capture button
    createCaptureButton();
    checkExistingCapture();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
