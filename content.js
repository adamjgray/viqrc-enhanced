// VEX IQ Skills Standings Enhancer
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    storageKey: 'vex-skills-enhancer-settings',
    eventBaseUrl: 'https://www.robotevents.com/robot-competitions/vex-iq-competition/',
    apiUrl: 'https://www.robotevents.com/api/seasons/196/skills'
  };

  // State
  let settings = {
    highlightedTeams: [],
    competitionTeams: {},
    useCustomTable: true
  };

  let allData = null;      // All data from API
  let filteredData = null; // Data after applying filters

  // Build API URL (only post_season and grade_level are server-side params)
  function buildApiUrl() {
    const params = [];

    // Post season
    const postSeasonCheckbox = document.querySelector("*[name='post_season']");
    params.push(`post_season=${postSeasonCheckbox?.checked ? 1 : 0}`);

    // Grade level
    const gradeLevelSelect = document.querySelector("*[name='grade_level']");
    if (gradeLevelSelect?.value) {
      params.push(`grade_level=${encodeURIComponent(gradeLevelSelect.value)}`);
    }

    const url = `${CONFIG.apiUrl}?${params.join('&')}`;
    console.log('VEX Enhancer - API URL:', url);
    return url;
  }

  // Get current filter values from page (for client-side filtering)
  function getClientFilters() {
    // Event region - get the label text, not just the value
    const eventRegionEl = document.querySelector('input[name="event_region"]:checked');
    const eventRegionLabel = eventRegionEl?.closest('label')?.textContent?.trim() ||
                             eventRegionEl?.parentElement?.textContent?.trim() || '';
    const eventRegion = eventRegionEl?.value || '';

    // Country - get both ID and selected text
    const countryEl = document.querySelector('*[name="country"]');
    const countryId = countryEl?.value || '';
    const countryName = countryEl?.selectedOptions?.[0]?.text || '';

    // Region - get both ID and selected text
    const regionEl = document.querySelector('*[name="region"]');
    const regionId = regionEl?.value || '';
    const regionName = regionEl?.selectedOptions?.[0]?.text || '';

    const affiliations = getSelectedAffiliations();

    console.log('VEX Enhancer - Client filters:', {
      eventRegion, eventRegionLabel,
      countryId, countryName,
      regionId, regionName,
      affiliations
    });

    return { eventRegion, countryId, countryName, regionId, regionName, affiliations };
  }

  // Get current filter values from page
  function getFilters() {
    return {
      gradeLevel: document.querySelector("*[name='grade_level']")?.value || '',
      eventRegion: document.querySelector('input[name="event_region"]:checked')?.value || '',
      country: document.querySelector("*[name='country']")?.value || '',
      region: document.querySelector("*[name='region']")?.value || '',
      search: document.querySelector("*[name='search']")?.value?.toLowerCase() || '',
      affiliations: getSelectedAffiliations()
    };
  }

  // Get selected affiliations
  function getSelectedAffiliations() {
    const affiliations = [];
    document.querySelectorAll('input[name="affiliation[]"]:checked, input[name="affiliation"]:checked').forEach(el => {
      if (el.value) affiliations.push(el.value);
    });
    return affiliations;
  }

  // Apply client-side filters (event region, country, region, affiliations)
  function applyFilters(data) {
    const filters = getClientFilters();

    return data.filter(item => {
      // Event region filter (compare names)
      if (filters.eventRegion && item.eventRegion !== filters.eventRegion) {
        return false;
      }

      // Country filter (compare by name since API returns names)
      if (filters.countryName && filters.countryName !== 'All Countries') {
        if (item.country !== filters.countryName) return false;
      }

      // Region/State filter (compare by name since API returns names)
      if (filters.regionName && filters.regionName !== 'All Regions') {
        if (item.region !== filters.regionName) return false;
      }

      // Affiliations filter
      if (filters.affiliations.length > 0) {
        const hasAffiliation = filters.affiliations.some(aff =>
          item.affiliations && item.affiliations.includes(aff)
        );
        if (!hasAffiliation) return false;
      }

      return true;
    });
  }

  // Fetch all skills data from the RobotEvents API
  async function fetchAllSkillsData() {
    try {
      const url = buildApiUrl();
      console.log('VEX Enhancer - Fetching skills data from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('VEX Enhancer - Received', data.length, 'teams from API');

      // Parse and store all data
      allData = parseApiData(data);
      console.log('VEX Enhancer - Parsed', allData.length, 'teams');

      // Apply filters and build table
      refreshFilteredData();

    } catch (error) {
      console.error('VEX Enhancer - Failed to fetch API data:', error);
      document.getElementById('vex-stats-scope').textContent = '(API error)';
    }
  }

  // Parse API response data
  function parseApiData(apiData) {
    const data = [];

    apiData.forEach((item, index) => {
      const teamNum = item.team?.team?.toUpperCase() || '';
      const scores = item.scores || {};

      if (teamNum) {
        data.push({
          team: teamNum,
          score: parseFloat(scores.score || 0),
          programming: parseFloat(scores.programming || 0),
          driver: parseFloat(scores.driver || 0),
          maxProgramming: parseFloat(scores.maxProgramming || 0),
          maxDriver: parseFloat(scores.maxDriver || 0),
          apiRank: item.rank || 0,
          teamName: item.team?.teamName || '',
          organization: item.team?.organization || '',
          city: item.team?.city || '',
          region: item.team?.region || '',
          regionId: String(item.team?.regionId || ''),
          country: item.team?.country || '',
          countryId: String(item.team?.countryId || ''),
          gradeLevel: item.team?.gradeLevel || '',
          eventRegion: item.team?.eventRegion || '',
          eventRegionId: String(item.team?.eventRegionId || ''),
          affiliations: item.team?.affiliations || [],
          eligible: item.eligible || false
        });
      }
    });

    return data;
  }

  // Sort and assign ranks to filtered data
  function rankData(data) {
    data.sort((a, b) => b.score - a.score);
    data.forEach((item, idx) => {
      item.rank = idx + 1;
    });
    return data;
  }

  // Apply filters and refresh the table
  function refreshFilteredData() {
    if (!allData) return;

    filteredData = applyFilters(allData);
    rankData(filteredData);
    console.log('VEX Enhancer - Filtered to', filteredData.length, 'teams');

    buildCustomTable();
    updateStats();
  }

  // Get competition teams
  function getCompetitionTeams() {
    const teams = new Set();
    Object.values(settings.competitionTeams).forEach(comp => {
      if (comp.teams) {
        comp.teams.forEach(team => teams.add(team.toUpperCase()));
      }
    });
    return teams;
  }

  // Calculate percentile for a score
  function getPercentile(score, allScores) {
    const below = allScores.filter(s => s < score).length;
    return Math.round((below / allScores.length) * 100);
  }

  // Toggle between custom and original table views
  function toggleTableView() {
    const originalStandings = document.querySelector('#standings');
    const customContainer = document.getElementById('vex-custom-table-container');

    if (settings.useCustomTable) {
      // Show custom table, hide original
      if (originalStandings) originalStandings.style.display = 'none';
      if (customContainer) customContainer.style.display = 'block';
      refreshFilteredData();
    } else {
      // Show original table, hide custom
      if (originalStandings) originalStandings.style.display = '';
      if (customContainer) customContainer.style.display = 'none';
      enhanceOriginalTable();
    }
  }

  // Enhance the original table with highlights (when not using custom table)
  function enhanceOriginalTable() {
    const table = document.querySelector('#standings table');
    if (!table) return;

    const competitionTeams = getCompetitionTeams();
    const manualTeams = new Set(settings.highlightedTeams.map(t => t.toUpperCase()));

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      // Remove old highlights
      row.classList.remove('vex-competition-row', 'vex-highlighted-row', 'vex-both-highlight');

      // Find team number in this row
      const cells = row.querySelectorAll('td');
      let teamNum = '';
      cells.forEach(cell => {
        const text = cell.textContent?.trim() || '';
        const match = text.match(/^(\d{2,5}[A-Z])$/i);
        if (match && !teamNum) {
          teamNum = match[1].toUpperCase();
        }
      });

      if (teamNum) {
        const isCompetition = competitionTeams.has(teamNum);
        const isManual = manualTeams.has(teamNum);

        if (isCompetition && isManual) {
          row.classList.add('vex-both-highlight');
        } else if (isCompetition) {
          row.classList.add('vex-competition-row');
        } else if (isManual) {
          row.classList.add('vex-highlighted-row');
        }
      }
    });

    console.log('VEX Enhancer - Enhanced original table');
  }

  // Build our custom table
  function buildCustomTable() {
    if (!filteredData) return;

    const originalStandings = document.querySelector('#standings');

    // If not using custom table, just enhance original and return
    if (!settings.useCustomTable) {
      if (originalStandings) originalStandings.style.display = '';
      enhanceOriginalTable();
      return;
    }

    // Hide original standings
    if (originalStandings) {
      originalStandings.style.display = 'none';
    }

    // Create or get our container
    let container = document.getElementById('vex-custom-table-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vex-custom-table-container';
      originalStandings?.parentNode?.insertBefore(container, originalStandings);
    }

    const allScores = filteredData.map(d => d.score);
    const maxScore = Math.max(...allScores, 1); // Avoid division by zero
    const competitionTeams = getCompetitionTeams();
    const manualTeams = new Set(settings.highlightedTeams.map(t => t.toUpperCase()));

    // Build table HTML
    let html = `
      <div class="vex-table-controls">
        <input type="text" id="vex-table-search" placeholder="Search by team number or name..." />
        <span class="vex-table-count">${filteredData.length} teams</span>
      </div>
      <table class="vex-custom-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Team Name</th>
            <th>Organization</th>
            <th>Score</th>
            <th>Autonomous</th>
            <th>Driver</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
    `;

    filteredData.forEach(item => {
      const isCompetition = competitionTeams.has(item.team);
      const isManual = manualTeams.has(item.team);
      let rowClass = '';
      if (isCompetition && isManual) rowClass = 'vex-both-highlight';
      else if (isCompetition) rowClass = 'vex-competition-row';
      else if (isManual) rowClass = 'vex-highlighted-row';

      const percentile = getPercentile(item.score, allScores);
      const barWidth = (item.score / maxScore) * 100;

      let barClass = 'vex-bar-low';
      if (barWidth >= 90) barClass = 'vex-bar-top';
      else if (barWidth >= 70) barClass = 'vex-bar-high';
      else if (barWidth >= 50) barClass = 'vex-bar-mid';

      const searchText = `${item.team} ${item.teamName} ${item.organization}`.toLowerCase();

      html += `
        <tr class="${rowClass}" data-team="${item.team}" data-search="${searchText}">
          <td>${item.rank}</td>
          <td class="vex-team-number">${item.team}</td>
          <td>${item.teamName}</td>
          <td>${item.organization}</td>
          <td class="vex-score-cell">
            ${item.score}
            <div class="vex-score-bar ${barClass}" style="width: ${barWidth}%"></div>
          </td>
          <td>${item.programming}</td>
          <td>${item.driver}</td>
          <td class="vex-percentile-cell">${percentile}%</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Setup search
    const searchInput = document.getElementById('vex-table-search');
    searchInput?.addEventListener('input', (e) => {
      const filter = e.target.value.toLowerCase().trim();
      const rows = container.querySelectorAll('tbody tr');
      let visibleCount = 0;
      rows.forEach(row => {
        const searchText = row.dataset.search || '';
        const matches = !filter || searchText.includes(filter);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
      });
      const countSpan = container.querySelector('.vex-table-count');
      if (countSpan) {
        countSpan.textContent = filter ? `${visibleCount} of ${filteredData.length} teams` : `${filteredData.length} teams`;
      }
    });

    console.log('VEX Enhancer - Custom table built with', filteredData.length, 'rows');
  }

  // Update statistics
  function updateStats() {
    if (!filteredData || filteredData.length === 0) return;

    const scores = filteredData.map(d => d.score).filter(s => s > 0);
    const programming = filteredData.map(d => d.programming).filter(s => s > 0);
    const driver = filteredData.map(d => d.driver).filter(s => s > 0);

    const sortedScores = [...scores].sort((a, b) => a - b);

    const stats = {
      count: filteredData.length,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
      median: sortedScores[Math.floor(sortedScores.length / 2)],
      avgProgramming: programming.length > 0 ? programming.reduce((a, b) => a + b, 0) / programming.length : 0,
      avgDriver: driver.length > 0 ? driver.reduce((a, b) => a + b, 0) / driver.length : 0
    };

    const container = document.getElementById('vex-stats-container');
    const scopeElement = document.getElementById('vex-stats-scope');

    if (scopeElement) {
      scopeElement.textContent = `(all ${stats.count} teams)`;
    }

    if (container) {
      container.innerHTML = `
        <div class="vex-stat-row">
          <span class="vex-stat-label">Teams:</span>
          <span class="vex-stat-value">${stats.count}</span>
        </div>
        <div class="vex-stat-row">
          <span class="vex-stat-label">Avg Score:</span>
          <span class="vex-stat-value">${stats.avg.toFixed(1)}</span>
        </div>
        <div class="vex-stat-row">
          <span class="vex-stat-label">Max Score:</span>
          <span class="vex-stat-value">${stats.max}</span>
        </div>
        <div class="vex-stat-row">
          <span class="vex-stat-label">Median:</span>
          <span class="vex-stat-value">${stats.median}</span>
        </div>
        <div class="vex-stat-row">
          <span class="vex-stat-label">Avg Autonomous:</span>
          <span class="vex-stat-value">${stats.avgProgramming.toFixed(1)}</span>
        </div>
        <div class="vex-stat-row">
          <span class="vex-stat-label">Avg Driver:</span>
          <span class="vex-stat-value">${stats.avgDriver.toFixed(1)}</span>
        </div>
      `;
    }
  }

  // Create the control panel
  function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'vex-enhancer-panel';
    panel.innerHTML = `
      <div class="vex-enhancer-header">
        <h3>Skills Enhancer</h3>
        <button id="vex-toggle-panel" title="Toggle Panel">−</button>
      </div>
      <div class="vex-enhancer-content">
        <div class="vex-section">
          <h4>Competition Teams</h4>
          <p class="vex-help-text">Visit an event page and click "Capture Teams" to import registered teams.</p>
          <input type="text" id="vex-competition-input" placeholder="Competition ID (e.g., RE-VIQRC-25-2623)">
          <button id="vex-open-event">Open Event Page</button>
          <button id="vex-refresh-data">Refresh Data</button>
          <div id="vex-competition-status"></div>
          <div id="vex-competition-list"></div>
        </div>

        <div class="vex-section">
          <h4>Highlight Teams</h4>
          <input type="text" id="vex-team-input" placeholder="Enter team number(s), comma separated">
          <button id="vex-add-teams">Add</button>
          <div id="vex-highlighted-list"></div>
        </div>

        <div class="vex-section">
          <h4>Statistics <span id="vex-stats-scope" class="vex-stats-note">(loading...)</span></h4>
          <div id="vex-stats-container"></div>
        </div>

        <div class="vex-section">
          <h4>Options</h4>
          <label>
            <input type="checkbox" id="vex-use-custom-table" ${settings.useCustomTable ? 'checked' : ''}>
            Use enhanced table (uncheck to use original)
          </label>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
  }

  // Update competition list display
  function updateCompetitionList() {
    const list = document.getElementById('vex-competition-list');
    if (!list) return;

    const competitions = Object.entries(settings.competitionTeams);

    if (competitions.length === 0) {
      list.innerHTML = '<em>No competitions loaded</em>';
      return;
    }

    list.innerHTML = competitions.map(([id, comp]) => `
      <div class="vex-competition-item">
        <div class="vex-competition-header">
          <strong>${comp.name || id}</strong>
          <button class="vex-remove-competition" data-id="${id}" title="Remove">×</button>
        </div>
        <div class="vex-competition-info">
          <span class="vex-competition-teams-count">${comp.teams?.length || 0} teams</span>
        </div>
        <div class="vex-competition-id">${id}</div>
      </div>
    `).join('');

    list.querySelectorAll('.vex-remove-competition').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        delete settings.competitionTeams[id];
        saveSettings();
        updateCompetitionList();
        refreshFilteredData();
      });
    });
  }

  // Update highlighted teams list
  function updateHighlightedList() {
    const list = document.getElementById('vex-highlighted-list');
    if (!list) return;

    if (settings.highlightedTeams.length === 0) {
      list.innerHTML = '<em>No teams highlighted</em>';
      return;
    }

    list.innerHTML = settings.highlightedTeams.map(team =>
      `<span class="vex-team-tag">${team} <button class="vex-remove-team" data-team="${team}">×</button></span>`
    ).join('');

    list.querySelectorAll('.vex-remove-team').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const team = e.target.dataset.team;
        settings.highlightedTeams = settings.highlightedTeams.filter(t => t !== team);
        saveSettings();
        updateHighlightedList();
        refreshFilteredData();
      });
    });
  }

  // Save settings
  function saveSettings() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(settings));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  }

  // Load settings
  function loadSettings() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = { ...settings, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Toggle panel
    document.getElementById('vex-toggle-panel')?.addEventListener('click', (e) => {
      const content = document.querySelector('.vex-enhancer-content');
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      e.target.textContent = isHidden ? '−' : '+';
    });

    // Open event page
    document.getElementById('vex-open-event')?.addEventListener('click', () => {
      const input = document.getElementById('vex-competition-input');
      const status = document.getElementById('vex-competition-status');
      let competitionId = input.value.trim();

      if (!competitionId) {
        status.innerHTML = '<span class="vex-error">Please enter a competition ID</span>';
        return;
      }

      if (competitionId.includes('/')) {
        const match = competitionId.match(/(RE-[A-Z]+-\d+-\d+)/i);
        if (match) competitionId = match[1];
      }
      competitionId = competitionId.replace('.html', '');

      status.innerHTML = '<span class="vex-info">Opening event page...</span>';
      window.open(`${CONFIG.eventBaseUrl}${competitionId}.html#teams`, '_blank');
      input.value = '';
    });

    // Refresh data
    document.getElementById('vex-refresh-data')?.addEventListener('click', () => {
      loadSettings();
      updateCompetitionList();
      updateHighlightedList();
      refreshFilteredData();
      document.getElementById('vex-competition-status').innerHTML = '<span class="vex-success">Refreshed!</span>';
      setTimeout(() => {
        document.getElementById('vex-competition-status').innerHTML = '';
      }, 2000);
    });

    // Enter key on competition input
    document.getElementById('vex-competition-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('vex-open-event')?.click();
    });

    // Add teams
    document.getElementById('vex-add-teams')?.addEventListener('click', () => {
      const input = document.getElementById('vex-team-input');
      const teams = input.value.split(',').map(t => t.trim().toUpperCase()).filter(t => t);

      teams.forEach(team => {
        if (!settings.highlightedTeams.includes(team)) {
          settings.highlightedTeams.push(team);
        }
      });

      input.value = '';
      saveSettings();
      updateHighlightedList();
      refreshFilteredData();
    });

    // Enter key on team input
    document.getElementById('vex-team-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('vex-add-teams')?.click();
    });

    // Custom table toggle
    document.getElementById('vex-use-custom-table')?.addEventListener('change', (e) => {
      settings.useCustomTable = e.target.checked;
      saveSettings();
      toggleTableView();
    });
  }

  // Setup listeners for page filter changes
  function setupFilterListeners() {
    let debounceTimer;

    // Server-side filters (require API refetch)
    const onServerFilterChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('VEX Enhancer - Server filter changed, refetching');
        fetchAllSkillsData();
      }, 500);
    };

    // Client-side filters (just refilter existing data)
    const onClientFilterChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('VEX Enhancer - Client filter changed, refreshing');
        refreshFilteredData();
      }, 300);
    };

    // Server-side: post_season and grade_level
    ['*[name="post_season"]', '*[name="grade_level"]'].forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.addEventListener('change', onServerFilterChange);
      });
    });

    // Client-side: event_region, country, region, affiliations
    ['input[name="event_region"]', '*[name="country"]', '*[name="region"]',
     'input[name="affiliation[]"]', 'input[name="affiliation"]'].forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.addEventListener('change', onClientFilterChange);
      });
    });
  }

  // Observe original table for changes (pagination)
  function observeOriginalTable() {
    const table = document.querySelector('#standings table');
    if (!table) return;

    const observer = new MutationObserver(() => {
      if (!settings.useCustomTable) {
        setTimeout(() => enhanceOriginalTable(), 100);
      }
    });

    observer.observe(table, { childList: true, subtree: true });
    console.log('VEX Enhancer - Observing original table for changes');
  }

  // Initialize
  function init() {
    console.log('VEX IQ Skills Enhancer loaded');

    loadSettings();

    // Wait a bit for page to load, then create UI and fetch data
    setTimeout(() => {
      createControlPanel();
      setupEventListeners();
      updateCompetitionList();
      updateHighlightedList();

      // Fetch all data from API and build our table
      fetchAllSkillsData();

      // Listen for filter changes
      setupFilterListeners();

      // Watch original table for pagination changes
      observeOriginalTable();
    }, 1000);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
