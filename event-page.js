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

  // --- Cache System ---
  const CACHE_KEY = 'vex-skills-enhancer-cache';
  const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

  function getCacheStore() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCacheStore(store) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch (e) {
      debug('Failed to save cache:', e);
    }
  }

  function cacheGet(key) {
    const store = getCacheStore();
    const entry = store[key];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      delete store[key];
      saveCacheStore(store);
      return null;
    }
    debug('Cache hit:', key);
    return entry.data;
  }

  function cacheSet(key, data) {
    const store = getCacheStore();
    store[key] = { data, timestamp: Date.now() };
    saveCacheStore(store);
    debug('Cache set:', key);
  }

  function cacheInvalidate(key) {
    const store = getCacheStore();
    delete store[key];
    saveCacheStore(store);
    debug('Cache invalidated:', key);
  }

  function cacheInvalidatePattern(pattern) {
    const store = getCacheStore();
    let count = 0;
    for (const key of Object.keys(store)) {
      if (key.includes(pattern)) {
        delete store[key];
        count++;
      }
    }
    saveCacheStore(store);
    debug('Cache invalidated', count, 'entries matching:', pattern);
  }

  function cacheClearAll() {
    localStorage.removeItem(CACHE_KEY);
    debug('Cache cleared');
  }

  // --- Loading Overlay ---
  function showLoadingOverlay(message = 'Loading team data...') {
    isLoading = true;
    const container = document.getElementById('vex-event-table-container');
    if (!container) return;

    // Don't duplicate
    if (container.querySelector('.vex-loading-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'vex-loading-overlay';
    overlay.innerHTML = `
      <div class="vex-loading-content">
        <div class="vex-loading-spinner"></div>
        <span class="vex-loading-message">${message}</span>
      </div>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
  }

  function updateLoadingMessage(message) {
    const el = document.querySelector('.vex-loading-message');
    if (el) el.textContent = message;
  }

  function hideLoadingOverlay() {
    isLoading = false;
    const overlay = document.querySelector('.vex-loading-overlay');
    if (overlay) overlay.remove();
  }

  // Fetch with retry and exponential backoff for rate limiting
  async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          // Rate limited - get retry delay from header or use exponential backoff
          const retryAfter = response.headers.get('Retry-After');
          let delay;
          if (retryAfter) {
            delay = parseInt(retryAfter, 10) * 1000;
          } else {
            // Exponential backoff: 1s, 2s, 4s, 8s...
            delay = Math.pow(2, attempt) * 1000;
          }

          if (attempt < maxRetries) {
            debug(`Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            debug(`Rate limited (429), max retries exceeded`);
            return response; // Return the 429 response after max retries
          }
        }

        return response;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          debug(`Fetch error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, err.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  let eventTeams = [];      // Teams registered for this event
  let skillsData = null;    // Skills data for all teams
  let matchAverages = null; // Recent match averages for teams
  let eventAwards = null;   // Awards won at this event (Map of team -> array of awards)
  let eventFinalized = false; // Whether the event has already occurred
  let sortColumn = 'score';
  let sortDirection = 'desc';
  let selectedDivision = ''; // Division filter (Worlds only)
  let isLoading = false;     // Whether data is still being fetched

  // Division assignments for events with multiple divisions
  const EVENT_DIVISIONS = {
    'RE-VIQRC-26-4028': {
      "Spirit Division": ["78X", "183A", "252W", "478A", "639A", "836B", "921A", "985D", "1065D", "1336C", "1729R", "2035A", "2281B", "2501X", "2626T", "2831D", "3078B", "3287A", "3383F", "3722H", "4028X", "4469A", "4815B", "5567A", "6174B", "6333B", "6565N", "7702A", "8269A", "8588X", "9137A", "9296A", "9826K", "10515B", "10946F", "11110A", "11686X", "13205A", "13952C", "15153X", "17035D", "17760K", "19375B", "20616B", "21549B", "22903C", "24610B", "27493X", "29081C", "31337B", "31851B", "34543G", "36409C", "39401A", "41400C", "44408E", "45318A", "46000A", "46168A", "47998A", "48251D", "50491F", "54567A", "55821C", "57069C", "58312G", "60027B", "63330Z", "65990B", "70484D", "72777A", "74778A", "76782A", "78151C", "79089E", "80100A", "81777T", "82312A", "84732C", "88299A", "91416Y", "92855J", "95014X", "99806B"],
      "Research Division": ["47S", "166V", "243C", "252A", "435B", "595Y", "836A", "846B", "969A", "1065C", "1336A", "1695S", "1948A", "2205H", "2470Z", "2625D", "2820J", "3030A", "3211H", "3383D", "3722G", "4010S", "4270A", "4815A", "5491M", "6114A", "6265A", "6512C", "7323W", "8128Z", "8588A", "8882H", "9233G", "9666F", "10452Y", "10851F", "11108B", "11686B", "12368B", "13888A", "15104C", "16885A", "17593V", "18778E", "20352C", "21549A", "22320A", "24250Y", "27112B", "28952G", "30041B", "31655A", "34107C", "36409A", "37991E", "40693P", "44100D", "44844K", "45908C", "46032D", "48212C", "50284C", "54037F", "55580B", "56721E", "58130W", "60011D", "63273A", "65165E", "70270A", "72065X", "74756C", "75640A", "77806A", "78843A", "80066B", "81192Z", "81880A", "84732B", "88180C", "91361A", "92855E", "94001B", "99396B"],
      "Design Division": ["47A", "126Z", "243E", "422A", "567A", "791A", "839D", "952S", "1065B", "1216A", "1502B", "1916A", "2205B", "2420A", "2623S", "2820D", "2999H", "3211G", "3373A", "3686D", "3722Y", "4250S", "4751G", "5280B", "6046A", "6210X", "6512B", "7222C", "8035A", "8432B", "8866X", "9209R", "9619A", "9964E", "10700Z", "11108A", "11471B", "12357X", "13863J", "14581A", "16346A", "17489A", "18677A", "20259E", "21136A", "22222B", "24250P", "26277E", "28595A", "29627Y", "31614C", "33363C", "36238A", "37837B", "39920B", "41927W", "44844E", "45544A", "46032C", "47747V", "49131F", "50491C", "52152A", "55508C", "55902B", "58130G", "58852B", "61317X", "64932A", "67294B", "72065B", "74756B", "75172X", "77773P", "78380H", "79755C", "80821C", "81777Z", "84063C", "87853A", "90418B", "92640A", "93601E", "99144A"],
      "Innovate Division": ["84B", "240A", "243J", "276C", "478C", "727H", "839A", "929V", "1024G", "1087X", "1356A", "1828A", "2048A", "2285D", "2585A", "2810S", "2831F", "3088R", "3332E", "3453D", "3722U", "4079B", "4526A", "4854B", "5679A", "6177D", "6441A", "6671K", "7991B", "8366A", "8818N", "9156A", "9408A", "9933X", "10622A", "11064A", "11263X", "12242A", "13765C", "14180A", "15153Z", "17074B", "17890E", "19601A", "20698X", "21549F", "23761B", "25425A", "27519A", "29627F", "31337W", "32092A", "34802U", "36832C", "39404B", "41400M", "44632S", "45318B", "46032A", "46587A", "48495C", "50491K", "54965M", "55821E", "57775A", "58387A", "60141A", "64330A", "66799V", "71777A", "72777B", "74801F", "77298A", "78151N", "79420X", "80505A", "81777U", "82717K", "85202M", "88700E", "91445E", "93558B", "95133F"],
      "Opportunity Division": ["36C", "92E", "243D", "349T", "499A", "770Z", "839B", "952E", "1025A", "1114A", "1418Z", "1901B", "2166B", "2367F", "2613A", "2820A", "2929A", "3182A", "3369B", "3668X", "3722X", "4224A", "4613A", "5004W", "5813H", "6177G", "6441B", "6699C", "8009A", "8395A", "8818S", "9200B", "9532B", "9937A", "10673J", "11086A", "11289B", "12248A", "13789X", "14335X", "15167B", "17467A", "18386F", "19920A", "21133A", "21555C", "24250E", "25991A", "28134G", "29627W", "31408A", "32901A", "35249A", "37311C", "39920A", "41400R", "44713A", "45318D", "46032B", "47400J", "48952F", "52111A", "55508B", "55883B", "58072C", "58387E", "60355A", "64443S", "66990Z", "71843A", "73447A", "75035M", "77612C", "78258A", "79755A", "80608A", "81777W", "83920A", "86752A", "90007A", "92633A", "93558Z", "96933A"],
    },
    'RE-VIQRC-26-4029': {
      "Arts Division": ["35D", "182A", "243A", "286A", "390G", "478T", "629Y", "821D", "937B", "1063E", "1100S", "1227D", "1512X", "1810A", "2244B", "2425R", "2668B", "2783J", "3125M", "3439C", "3708C", "4183E", "5004S", "5164A", "5571K", "5988X", "6177A", "6440C", "6593C", "6677G", "6885B", "7799B", "8299B", "8873B", "9066A", "9919A", "10404F", "10511A", "11180B", "13200A", "13722X", "16677A", "17593X", "18493B", "18823M", "20160M", "21217A", "23011A", "25705B", "26989B", "29544C", "31186C", "34107G", "34543E", "37064D", "38413A", "42968Y", "46140A", "49466A", "51451D", "52710A", "54445T", "58071A", "59365B", "60600B", "62130D", "63122A", "66775A", "68039V", "70510F", "72777F", "76896A", "80292D", "81777A", "83920T", "85287A", "88299B", "90222B", "92964B", "95133G", "96712B", "98016B", "99174A"],
      "Engineering Division": ["28T", "138Z", "220X", "279G", "331W", "478M", "618X", "812A", "861A", "1059A", "1100E", "1216D", "1431A", "1779A", "2166A", "2410M", "2633B", "2737A", "3030D", "3439B", "3668C", "3988S", "4751A", "5147B", "5559C", "5981B", "6104C", "6333H", "6593B", "6656F", "6855B", "7553N", "8282X", "8866K", "8988P", "9699P", "10142A", "10459A", "11086B", "12368C", "13650A", "16346R", "17222A", "18000B", "18823A", "20058C", "21121A", "22884A", "25425B", "26862B", "29032E", "31186A", "34035J", "34458Z", "35640C", "37991M", "42403A", "44632N", "47721K", "50316F", "52654D", "53976A", "58051A", "58923A", "60065A", "62130B", "63041A", "66767A", "67846J", "69699A", "72550A", "74866A", "80020A", "81625S", "83187G", "84401C", "88180Y", "90048D", "92633B", "95059A", "96627A", "97793A", "98999Y", "99561C"],
      "Math Division": ["97A", "199R", "243G", "290R", "428J", "478Z", "689A", "826A", "985M", "1069H", "1132C", "1243A", "1545M", "1932C", "2276A", "2547B", "2675B", "2988A", "3207F", "3439W", "3931C", "4250X", "5017C", "5164C", "5585D", "6039B", "6181A", "6576A", "6632A", "6699U", "6885X", "7919A", "8588B", "8877Y", "9177A", "9965E", "10404G", "10525D", "11860G", "13282A", "13722Z", "16688K", "17750A", "18533A", "18963A", "20253A", "21302B", "23418D", "25757B", "27093A", "29766T", "31837K", "34202D", "34802J", "37500B", "38792A", "43058E", "46384C", "49466C", "51717R", "53065E", "55164C", "58071B", "59713D", "60666A", "62536A", "63122D", "67052H", "68262A", "71030G", "73429A", "77710A", "80602B", "81777X", "83988C", "85365B", "89998Z", "90245D", "92981A", "95133X", "96793B", "98854A", "99265B"],
      "Science Division": ["15B", "126F", "220A", "243F", "252G", "295Z", "473A", "567B", "804A", "839X", "985N", "1097C", "1216B", "1295X", "1555B", "1933M", "2305D", "2613E", "2675C", "2999F", "3321A", "3668A", "3931D", "4250Y", "5017F", "5255A", "5588Z", "6039D", "6210R", "6576C", "6632D", "6780A", "7231G", "8030A", "8672B", "8882A", "9199A", "9965X", "10432G", "10692A", "12022C", "13282B", "14581M", "16781R", "17890D", "18697A", "19901A", "20259R", "22020Y", "25039A", "26041A", "27199A", "30707A", "32112A", "34362H", "34998J", "37500C", "40693R", "43277A", "46658A", "50108A", "52106B", "53919A", "55909D", "58312D", "59813B", "60742A", "62666A", "65950B", "67052N", "68888A", "71221B", "73447C", "78454W", "81020A", "81777Y", "84212E", "85968A", "90000A", "91416X", "93557G", "96000A", "96833A", "98854C", "99396D"],
      "Technology Division": ["15C", "126G", "220C", "243K", "252S", "331S", "478J", "603X", "804B", "839Y", "986A", "1100A", "1216C", "1354A", "1729V", "2033A", "2373V", "2626X", "2675F", "2999K", "3437A", "3668B", "3988D", "4440A", "5090A", "5280N", "5876A", "6039F", "6333C", "6593A", "6651C", "6808X", "7427A", "8181N", "8696A", "8882B", "9452M", "10014C", "10452D", "10692E", "12059G", "13519B", "15034C", "16894B", "18000A", "18721D", "19968A", "20267B", "22524M", "25073A", "26862A", "28595T", "30707B", "32356B", "34458D", "35640A", "37500E", "40701A", "43631M", "47721D", "50298B", "52510A", "53919B", "57290D", "58766B", "60011E", "61593S", "62762A", "66396B", "67352D", "69000E", "71711B", "74756F", "78682C", "81500A", "82823A", "84218A", "86273C", "90048C", "91429X", "93557X", "96000S", "96902C", "98854E", "99396M"],
    }
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

  // Fetch event info from API (includes ID and finalization status)
  async function fetchEventInfo(sku) {
    if (!sku) return null;

    const settings = loadSettings();
    if (!settings.apiToken) {
      debug('No API token configured, skipping event info fetch');
      return null;
    }

    const cacheKey = `event_info_${sku}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://www.robotevents.com/api/v2/events?sku[]=${encodeURIComponent(sku)}`;
      debug('Fetching event info from:', url);

      const headers = {
        'Authorization': `Bearer ${settings.apiToken}`
      };
      const response = await fetchWithRetry(url, { headers });

      if (!response.ok) {
        debug('Failed to fetch event info - status:', response.status);
        return null;
      }

      const data = await response.json();
      const events = data.data || [];

      if (events.length > 0) {
        const event = events[0];
        debug('Found event:', event.id, 'finalized:', event.awards_finalized);
        const result = {
          id: event.id,
          name: event.name,
          finalized: event.awards_finalized || false,
          start: event.start,
          end: event.end
        };
        cacheSet(cacheKey, result);
        return result;
      }

      debug('No event found for SKU:', sku);
      return null;
    } catch (err) {
      error('Failed to fetch event info:', err);
      return null;
    }
  }

  // Get default filter date (2 months ago)
  function getDefaultFilterDate() {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    return date.toISOString().split('T')[0];
  }

  // Extract teams from the page
  function extractTeams() {
    const teams = [];

    // Use the specific selector for the teams table
    const teamsTableSelectors = [
      'section > div > table',
      '#api-app table',
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

  // Fetch event-specific skills data
  async function fetchEventSkillsData(eventId) {
    if (!eventId) return false;

    const settings = loadSettings();
    if (!settings.apiToken) {
      debug('No API token configured, skipping event skills fetch');
      return false;
    }

    const cacheKey = `event_skills_${eventId}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      skillsData = new Map(Object.entries(cached));
      debug('Loaded event skills from cache for', skillsData.size, 'teams');
      return skillsData.size > 0;
    }

    try {
      skillsData = new Map();

      const url = `https://www.robotevents.com/api/v2/events/${eventId}/skills?per_page=250`;
      debug('Fetching event skills from:', url);

      const headers = {
        'Authorization': `Bearer ${settings.apiToken}`
      };
      const response = await fetchWithRetry(url, { headers });

      if (!response.ok) {
        debug('Failed to fetch event skills - status:', response.status);
        return false;
      }

      const data = await response.json();
      const skills = data.data || [];
      debug('Received', skills.length, 'skills entries from event');

      // Log first skill entry to debug format
      if (skills.length > 0) {
        debug('First skills entry:', JSON.stringify(skills[0], null, 2));
      }

      // Group by team and find best scores for each type
      const teamSkills = new Map();

      skills.forEach(item => {
        const teamNum = item.team?.name?.toUpperCase();
        if (!teamNum) return;

        if (!teamSkills.has(teamNum)) {
          teamSkills.set(teamNum, {
            teamId: item.team?.id || null,
            programming: 0,
            driver: 0,
            gradeLevel: item.team?.grade || '',
            city: item.team?.location?.city || '',
            region: item.team?.location?.region || '',
            country: item.team?.location?.country || ''
          });
        }

        const team = teamSkills.get(teamNum);
        const score = item.score || 0;

        if (item.type === 'programming' && score > team.programming) {
          team.programming = score;
        } else if (item.type === 'driver' && score > team.driver) {
          team.driver = score;
        }
      });

      // Calculate combined scores and store in skillsData
      teamSkills.forEach((team, teamNum) => {
        skillsData.set(teamNum, {
          ...team,
          score: team.programming + team.driver
        });
      });

      debug('Processed event skills for', skillsData.size, 'teams');

      // Log a few sample entries to verify data
      let count = 0;
      for (const [teamNum, data] of skillsData) {
        if (count < 3) {
          debug('Sample skills entry:', teamNum, data);
          count++;
        }
      }

      // Cache the skills data
      if (skillsData.size > 0) {
        cacheSet(cacheKey, Object.fromEntries(skillsData));
      }

      return skillsData.size > 0;
    } catch (err) {
      error('Failed to fetch event skills:', err);
      return false;
    }
  }

  // Fetch awards data for an event
  async function fetchEventAwards(eventId) {
    if (!eventId) return false;

    const settings = loadSettings();
    if (!settings.apiToken) {
      debug('No API token configured, skipping event awards fetch');
      return false;
    }

    const cacheKey = `event_awards_${eventId}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      eventAwards = new Map(Object.entries(cached));
      debug('Loaded event awards from cache for', eventAwards.size, 'teams');
      return eventAwards.size > 0;
    }

    try {
      eventAwards = new Map();

      const url = `https://www.robotevents.com/api/v2/events/${eventId}/awards?per_page=250`;
      debug('Fetching event awards from:', url);

      const headers = {
        'Authorization': `Bearer ${settings.apiToken}`
      };
      const response = await fetchWithRetry(url, { headers });

      if (!response.ok) {
        debug('Failed to fetch event awards - status:', response.status);
        return false;
      }

      const data = await response.json();
      const awards = data.data || [];
      debug('Received', awards.length, 'awards from event');

      // Group awards by team
      awards.forEach(award => {
        const teamWinners = award.teamWinners || [];
        teamWinners.forEach(winner => {
          const teamNum = winner.team?.name?.toUpperCase();
          if (teamNum) {
            if (!eventAwards.has(teamNum)) {
              eventAwards.set(teamNum, []);
            }
            eventAwards.get(teamNum).push({
              name: award.title || 'Award',
              order: award.order || 999
            });
          }
        });
      });

      debug('Processed awards for', eventAwards.size, 'teams');

      // Cache the awards data
      if (eventAwards.size > 0) {
        cacheSet(cacheKey, Object.fromEntries(eventAwards));
      }

      return eventAwards.size > 0;
    } catch (err) {
      error('Failed to fetch event awards:', err);
      return false;
    }
  }

  // Fetch season awards for a single team
  async function fetchTeamSeasonAwards(teamId) {
    if (!teamId) return [];

    const settings = loadSettings();
    if (!settings.apiToken) return [];

    const cacheKey = `team_awards_${teamId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://www.robotevents.com/api/v2/teams/${teamId}/awards?season[]=196&program[]=41&per_page=250`;
      const headers = {
        'Authorization': `Bearer ${settings.apiToken}`
      };
      const response = await fetchWithRetry(url, { headers });

      if (!response.ok) {
        debug('Failed to fetch team awards - status:', response.status);
        return [];
      }

      const data = await response.json();
      const awards = data.data || [];

      const result = awards.map(award => ({
        name: award.title || 'Award',
        event: award.event?.name || 'Unknown Event',
        eventCode: award.event?.code || '',
        order: award.order || 999
      }));

      if (result.length > 0) {
        cacheSet(cacheKey, result);
      }
      return result;
    } catch (err) {
      debug('Failed to fetch team awards:', err);
      return [];
    }
  }

  // Fetch season awards for all teams (with rate limiting)
  // progressiveCallback is called after each batch that hits the network
  async function fetchAllSeasonAwards(teams, progressiveCallback = null) {
    eventAwards = new Map();

    if (!hasApiToken()) {
      debug('No API token configured, skipping season awards fetch');
      return;
    }

    try {
      // Process in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < teams.length; i += batchSize) {
        const batch = teams.slice(i, i + batchSize);
        let batchHadFetch = false;
        const promises = batch.map(async team => {
          if (team.teamId) {
            try {
              const cacheKey = `team_awards_${team.teamId}`;
              const wasCached = !!cacheGet(cacheKey);
              const awards = await fetchTeamSeasonAwards(team.teamId);
              if (awards.length > 0) {
                eventAwards.set(team.team.toUpperCase(), awards);
              }
              if (!wasCached) batchHadFetch = true;
            } catch (err) {
              debug('Error fetching awards for team', team.team, err);
            }
          }
        });
        await Promise.all(promises);

        if (batchHadFetch && progressiveCallback) {
          progressiveCallback();
        }

        // Only delay between batches if we actually made network requests
        if (batchHadFetch && i + batchSize < teams.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      debug('Fetched season awards for', eventAwards.size, 'teams');
    } catch (err) {
      error('Error in fetchAllSeasonAwards:', err);
    }
  }

  // Fetch skills data from API for both grade levels (global standings)
  async function fetchSkillsData() {
    const cacheKey = 'global_skills_data';
    const cached = cacheGet(cacheKey);
    if (cached) {
      skillsData = new Map(Object.entries(cached));
      debug('Loaded global skills from cache:', skillsData.size, 'teams');
      return skillsData.size > 0;
    }

    skillsData = new Map();

    // Fetch both Elementary and Middle School data
    const gradeLevels = ['Elementary', 'Middle School'];

    for (const gradeLevel of gradeLevels) {
      try {
        const url = `${CONFIG.skillsApiUrl}?post_season=0&grade_level=${encodeURIComponent(gradeLevel)}`;
        debug('Fetching skills data for', gradeLevel);

        const response = await fetchWithRetry(url);
        if (!response.ok) {
          debug('Failed to fetch', gradeLevel, '- status:', response.status);
          continue;
        }

        const data = await response.json();
        debug('Received', data.length, 'teams from', gradeLevel);

        // Add to map (don't overwrite if team already exists with higher score)
        data.forEach(item => {
          const teamNum = item.team?.team?.toUpperCase();
          if (teamNum) {
            const existing = skillsData.get(teamNum);
            const newScore = parseFloat(item.scores?.score || 0);

            // Only add if team doesn't exist or new score is higher
            if (!existing || newScore > existing.score) {
              skillsData.set(teamNum, {
                teamId: item.team?.id || null,
                score: newScore,
                programming: parseFloat(item.scores?.programming || 0),
                driver: parseFloat(item.scores?.driver || 0),
                rank: item.rank || 0,
                gradeLevel: item.team?.gradeLevel || '',
                city: item.team?.city || '',
                region: item.team?.region || '',
                country: item.team?.country || ''
              });
            }
          }
        });
      } catch (err) {
        error('Failed to fetch skills data for', gradeLevel, ':', err);
        // Continue with other grade levels
      }
    }

    // Cache the results
    if (skillsData.size > 0) {
      cacheSet(cacheKey, Object.fromEntries(skillsData));
    }

    debug('Total teams in skillsData:', skillsData.size);
    return skillsData.size > 0;
  }

  // Check if API token is configured
  function hasApiToken() {
    const settings = loadSettings();
    return !!(settings.apiToken && settings.apiToken.trim());
  }

  // Fetch team IDs for all teams in one API call
  async function fetchTeamIds(teamNumbers) {
    if (!teamNumbers || teamNumbers.length === 0) return new Map();

    const settings = loadSettings();
    if (!settings.apiToken) {
      debug('No API token configured, skipping team ID fetch');
      return new Map();
    }

    // Check cache for individual team IDs, fetch only missing ones
    const teamIdMap = new Map();
    const uncachedNumbers = [];

    for (const num of teamNumbers) {
      const cached = cacheGet(`team_id_${num.toUpperCase()}`);
      if (cached) {
        teamIdMap.set(num.toUpperCase(), cached);
      } else {
        uncachedNumbers.push(num);
      }
    }

    if (uncachedNumbers.length === 0) {
      debug('All team IDs found in cache:', teamIdMap.size);
      return teamIdMap;
    }

    try {
      // Build query string with uncached team numbers only
      // program[]=41 limits to VEX IQ teams only
      const numberParams = uncachedNumbers.map(num => `number[]=${encodeURIComponent(num)}`).join('&');
      const url = `https://www.robotevents.com/api/v2/teams?${numberParams}&program[]=41&season[]=196&per_page=250`;
      debug('Fetching team IDs from:', url, `(${uncachedNumbers.length} uncached of ${teamNumbers.length})`);

      const headers = {
        'Authorization': `Bearer ${settings.apiToken}`
      };
      const response = await fetchWithRetry(url, { headers });

      if (!response.ok) {
        debug('Failed to fetch team IDs - status:', response.status);
        return teamIdMap;
      }

      const data = await response.json();
      const teams = data.data || [];
      debug('Received', teams.length, 'teams from API');

      // Add to map and cache individually
      teams.forEach(team => {
        const teamNum = team.number?.toUpperCase();
        if (teamNum && team.id) {
          teamIdMap.set(teamNum, team.id);
          cacheSet(`team_id_${teamNum}`, team.id);
        }
      });

      debug('Built teamIdMap with', teamIdMap.size, 'entries');
      return teamIdMap;
    } catch (err) {
      error('Failed to fetch team IDs:', err);
      return teamIdMap;
    }
  }

  // Fetch match data for a team and calculate match average
  // If eventCodeFilter is provided, only include matches from that event
  async function fetchMatchData(teamId, eventCodeFilter = null) {
    if (!teamId) return null;

    const settings = loadSettings();
    if (!settings.apiToken) {
      debug('No API token configured, skipping match fetch');
      return null;
    }

    const cacheKey = `team_matches_${teamId}_${eventCodeFilter || 'recent'}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://www.robotevents.com/api/v2/teams/${teamId}/matches?season%5B%5D=196&per_page=250`;
      debug('Fetching matches from:', url);
      const headers = {
        'Authorization': `Bearer ${settings.apiToken}`
      };
      const response = await fetchWithRetry(url, { headers });
      debug('Response status:', response.status);
      if (!response.ok) {
        debug('Response not ok for team', teamId, '- status:', response.status);
        return null;
      }

      const data = await response.json();
      debug('Match data for team', teamId, ':', data);
      const matches = data.data || [];
      debug('Total matches:', matches.length);

      // First, filter to only scored matches and sort by date
      let scoredMatches = matches.filter(match => {
        if (!match.updated_at) return false;
        const hasScores = match.alliances?.some(a => a.score !== undefined && a.score !== null);
        return hasScores;
      }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      // If filtering by specific event, only include matches from that event
      if (eventCodeFilter) {
        // Log first match's event code to debug format mismatch
        if (scoredMatches.length > 0) {
          debug('Event code filter:', eventCodeFilter, 'First match event code:', scoredMatches[0]?.event?.code);
        }
        scoredMatches = scoredMatches.filter(match =>
          match.event?.code?.toUpperCase() === eventCodeFilter.toUpperCase()
        );
        debug('Filtered to', scoredMatches.length, 'matches from event', eventCodeFilter);
      }

      // Group matches by event
      const eventMatches = new Map();
      scoredMatches.forEach(match => {
        const eventCode = match.event?.code || 'unknown';
        if (!eventMatches.has(eventCode)) {
          eventMatches.set(eventCode, {
            code: eventCode,
            name: match.event?.name || eventCode,
            date: match.updated_at,
            matches: []
          });
        }
        eventMatches.get(eventCode).matches.push(match);
      });

      // Sort events by date (most recent first)
      const sortedEvents = Array.from(eventMatches.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

      // Apply filter based on type (skip if filtering by specific event)
      let filteredEvents;
      if (eventCodeFilter) {
        // Already filtered above, use all remaining events
        filteredEvents = sortedEvents;
      } else {
        // Apply settings-based filter for recent matches
        const settings = loadSettings();
        const filterType = settings.matchFilterType || 'since_date';
        const filterDate = settings.matchFilterDate || getDefaultFilterDate();
        const filterCount = settings.matchFilterCount || 5;

        if (filterType === 'all_events') {
          filteredEvents = sortedEvents;
        } else if (filterType === 'last_n_events') {
          filteredEvents = sortedEvents.slice(0, filterCount);
        } else {
          // since_date (default)
          const sinceDate = new Date(filterDate);
          filteredEvents = sortedEvents.filter(event => new Date(event.date) >= sinceDate);
        }
      }

      // Flatten back to matches
      const recentMatches = filteredEvents.flatMap(event => event.matches);
      debug('Filtered to', recentMatches.length, 'matches from', filteredEvents.length, 'events');

      debug('Recent scored matches:', recentMatches.length);
      if (recentMatches.length === 0) return null;

      // Calculate average and max score for this team across recent matches
      let totalScore = 0;
      let maxScore = 0;
      let matchCount = 0;
      const matchList = [];

      recentMatches.forEach(match => {
        // Find which alliance the team was on (red or blue)
        const alliances = match.alliances || [];
        for (const alliance of alliances) {
          const teamOnAlliance = alliance.teams?.some(t => t.team?.id === teamId);
          if (teamOnAlliance && alliance.score !== undefined) {
            debug('Team', teamId, 'on', alliance.color, 'alliance, score:', alliance.score);
            totalScore += alliance.score;
            maxScore = Math.max(maxScore, alliance.score);
            matchCount++;

            // Find opposing alliance
            const opponent = alliances.find(a => a.color !== alliance.color);

            // Store match details for display
            const teamNumbers = alliance.teams?.map(t => t.team?.name || t.team?.code || '?') || [];
            const opponentNumbers = opponent?.teams?.map(t => t.team?.name || t.team?.code || '?') || [];

            matchList.push({
              name: match.name || `Match ${match.matchnum}`,
              eventName: match.event?.name || '',
              eventCode: match.event?.code || '',
              teamAlliance: {
                color: alliance.color,
                teams: teamNumbers,
                score: alliance.score
              },
              opponentAlliance: opponent ? {
                color: opponent.color,
                teams: opponentNumbers,
                score: opponent.score
              } : null,
              date: match.updated_at || match.started || match.scheduled
            });
            break;
          }
        }
      });

      // Sort matches by date descending (most recent first)
      matchList.sort((a, b) => new Date(b.date) - new Date(a.date));

      debug('Match count:', matchCount, 'Total score:', totalScore, 'Max:', maxScore, 'Avg:', matchCount > 0 ? totalScore / matchCount : 0);
      if (matchCount === 0) return null;

      const result = {
        average: Math.round(totalScore / matchCount),
        max: maxScore,
        matchCount: matchCount,
        matches: matchList
      };

      cacheSet(cacheKey, result);
      return result;
    } catch (err) {
      error('Failed to fetch match data for team', teamId, err);
      return null;
    }
  }

  // Fetch match averages for all teams (with rate limiting)
  // If eventCode is provided, only include matches from that event
  // progressiveCallback is called after each batch so the UI can update
  async function fetchAllMatchAverages(teams, eventCode = null, progressiveCallback = null) {
    const results = new Map();

    // Skip if no API token configured
    if (!hasApiToken()) {
      debug('No API token configured, skipping match data fetch');
      return results;
    }

    try {
      // Process in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < teams.length; i += batchSize) {
        const batch = teams.slice(i, i + batchSize);
        let batchHadFetch = false;
        const promises = batch.map(async team => {
          if (team.teamId) {
            try {
              const cacheKey = `team_matches_${team.teamId}_${eventCode || 'recent'}`;
              const wasCached = !!cacheGet(cacheKey);
              const result = await fetchMatchData(team.teamId, eventCode);
              if (result) {
                results.set(team.team, result);
              }
              if (!wasCached) batchHadFetch = true;
            } catch (err) {
              debug('Error fetching match data for team', team.team, err);
            }
          }
        });
        await Promise.all(promises);

        // Update UI progressively after batches that hit the network
        if (batchHadFetch && progressiveCallback) {
          progressiveCallback(results);
        }

        // Only delay between batches if we actually made network requests
        if (batchHadFetch && i + batchSize < teams.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (err) {
      error('Error in fetchAllMatchAverages:', err);
    }

    return results;
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
    const teamsSection = document.querySelector('section > div > table')?.closest('section') ||
                        document.querySelector('#api-app table')?.closest('section');
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

    // Check if this event has divisions
    const competitionId = getCompetitionId();
    const divisions = competitionId ? EVENT_DIVISIONS[competitionId] : null;
    const divisionNames = divisions ? Object.keys(divisions) : [];

    // Build a Set of team numbers for the selected division
    let divisionTeamSet = null;
    if (divisions && selectedDivision && divisions[selectedDivision]) {
      divisionTeamSet = new Set(divisions[selectedDivision].map(t => t.toUpperCase()));
    }

    // Merge event teams with skills data and match averages
    let mergedData = eventTeams.map(team => {
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
        recentMatchCount: matchAvg?.matchCount || 0,
        recentMatches: matchAvg?.matches || []
      };
    });

    // Filter by division if selected
    if (divisionTeamSet) {
      mergedData = mergedData.filter(t => divisionTeamSet.has(t.team.toUpperCase()));
    }

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

    // Check if we should show match columns (only if API token is configured)
    const showMatchColumns = hasApiToken();

    // Column labels depend on whether event is finalized
    const avgLabel = eventFinalized
      ? 'Event Avg <span class="vex-info-icon" title="Average of all matches at this event. Unlike official rankings, no low scores are dropped.">ⓘ</span>'
      : 'Match Avg';
    const maxLabel = eventFinalized ? 'Event Max' : 'Match Max';

    // Build division selector HTML (only for events with divisions)
    let divisionSelectHtml = '';
    if (divisionNames.length > 0) {
      const options = divisionNames.map(name =>
        `<option value="${name}" ${selectedDivision === name ? 'selected' : ''}>${name}</option>`
      ).join('');
      divisionSelectHtml = `
        <select id="vex-division-select" class="vex-division-select">
          <option value="">All Divisions</option>
          ${options}
        </select>
      `;
    }

    // Build table
    let html = `
      <div class="vex-event-controls">
        <input type="text" id="vex-event-search" placeholder="Search teams..." />
        ${divisionSelectHtml}
        <span class="vex-event-count">${mergedData.length} teams (${teamsWithScores} with skills scores)${eventFinalized ? ' - Event Completed' : ''}${selectedDivision ? ` - ${selectedDivision}` : ''}</span>
        <button id="vex-clear-cache-btn" class="vex-clear-cache-btn" title="Clear cached data and reload from API">&#x21bb; Refresh All</button>
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
            ${showMatchColumns ? `<th class="vex-sortable" data-sort="recentMatchAvg">${avgLabel} ${sortIndicator('recentMatchAvg')}</th>` : ''}
            ${showMatchColumns ? `<th class="vex-sortable" data-sort="recentMatchMax">${maxLabel} ${sortIndicator('recentMatchMax')}</th>` : ''}
            ${showMatchColumns ? `<th>${eventFinalized ? 'Awards' : 'Season Awards'}</th>` : ''}
          </tr>
        </thead>
        <tbody>
    `;

    // Get highlighted teams for row styling
    const competitionTeams = getCompetitionTeams();
    const highlightedTeams = getHighlightedTeams();

    mergedData.forEach((team, idx) => {
      const searchText = `${team.team} ${team.teamName} ${team.organization}`.toLowerCase();
      const matchTooltip = eventFinalized
        ? `${team.recentMatchCount} matches at this event`
        : `${team.recentMatchCount} recent matches`;
      const matchAvgDisplay = team.recentMatchAvg !== null
        ? `<span title="${matchTooltip}">${team.recentMatchAvg}</span>`
        : '-';
      const matchMaxDisplay = team.recentMatchMax !== null ? team.recentMatchMax : '-';

      // Build awards display (filtered by settings)
      let awardsDisplay = '-';
      if (showMatchColumns) {
        const teamAwards = filterAwards(eventAwards?.get(team.team.toUpperCase()) || []);
        if (teamAwards.length > 0) {
          if (eventFinalized) {
            // For finalized events, just show trophy with award name
            awardsDisplay = teamAwards.map(award =>
              `<span class="vex-award-trophy" title="${award.name}">🏆</span>`
            ).join('');
          } else {
            // For non-finalized events, show trophy with award name and event
            awardsDisplay = teamAwards.map(award =>
              `<span class="vex-award-trophy" title="${award.name} @ ${award.event}">🏆</span>`
            ).join('');
          }
        }
      }

      // Determine row highlighting
      const teamUpper = team.team.toUpperCase();
      const isCompetition = competitionTeams.has(teamUpper);
      const isHighlighted = highlightedTeams.has(teamUpper);
      let rowClass = '';
      if (isHighlighted) rowClass = 'vex-highlighted-row';
      else if (isCompetition) rowClass = 'vex-competition-row';

      html += `
        <tr class="${rowClass}" data-team="${team.team}" data-search="${searchText}" data-idx="${idx}">
          <td>${idx + 1}</td>
          <td class="vex-team-number">${team.team}</td>
          <td>${team.teamName || '-'}</td>
          <td>${team.organization || '-'}</td>
          <td class="vex-score-cell">${team.score || '-'}</td>
          <td>${team.programming || '-'}</td>
          <td>${team.driver || '-'}</td>
          ${showMatchColumns ? `<td>${matchAvgDisplay}</td>` : ''}
          ${showMatchColumns ? `<td>${matchMaxDisplay}</td>` : ''}
          ${showMatchColumns ? `<td class="vex-awards-cell">${awardsDisplay}</td>` : ''}
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

    // Re-apply loading overlay if still loading (innerHTML wipes it)
    if (isLoading) {
      container.style.position = 'relative';
      const overlay = document.createElement('div');
      overlay.className = 'vex-loading-overlay';
      overlay.innerHTML = `
        <div class="vex-loading-content">
          <div class="vex-loading-spinner"></div>
          <span class="vex-loading-message">Loading team data...</span>
        </div>
      `;
      container.appendChild(overlay);
    }

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

    // Setup division filter
    document.getElementById('vex-division-select')?.addEventListener('change', (e) => {
      selectedDivision = e.target.value;
      buildEnhancedTable();
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

    // Setup clear cache button
    document.getElementById('vex-clear-cache-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '⟳ Refreshing...';
      cacheClearAll();
      // Reload the page to re-fetch everything fresh
      window.location.reload();
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
          <div class="vex-modal-header-actions">
            <button class="vex-refresh-team-btn" title="Refresh this team's data (clears cache)">&#x21bb; Refresh</button>
            <button class="vex-modal-close">&times;</button>
          </div>
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
            <h3>${eventFinalized ? 'Event Match Performance' : 'Recent Match Performance'}</h3>
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
                <span class="vex-modal-label">${eventFinalized ? 'Matches at Event' : 'Recent Matches'}</span>
                <span class="vex-modal-value">${team.recentMatchCount}</span>
              </div>
            </div>
            ` : `<p style="color: #888;">${eventFinalized ? 'No match data from this event.' : 'No recent match data available.'}</p>`}
          </div>

          ${(() => {
            const teamAwards = filterAwards(eventAwards?.get(team.team.toUpperCase()) || []);
            if (teamAwards.length > 0) {
              const awardsTitle = eventFinalized ? 'Awards' : 'Season Awards';
              return `
          <div class="vex-modal-section">
            <h3>${awardsTitle}</h3>
            <div class="vex-modal-awards">
              ${teamAwards.map(award => {
                if (eventFinalized) {
                  return `<div class="vex-modal-award-item">🏆 ${award.name}</div>`;
                } else {
                  return `<div class="vex-modal-award-item">
                    <span>🏆 ${award.name}</span>
                    <span class="vex-award-event">${award.event}</span>
                  </div>`;
                }
              }).join('')}
            </div>
          </div>`;
            }
            return '';
          })()}

          ${team.recentMatches.length > 0 ? `
          <div class="vex-modal-section">
            <h3>Match History</h3>
            <div class="vex-match-list">
              ${team.recentMatches.map(match => `
                <div class="vex-match-item">
                  <div class="vex-match-alliances">
                    <span class="vex-alliance-pill vex-alliance-${match.teamAlliance.color}">
                      ${match.teamAlliance.teams.join(' & ')}
                      <span class="vex-alliance-score">${match.teamAlliance.score}</span>
                    </span>
                    ${match.opponentAlliance ? `
                    <span class="vex-vs">vs</span>
                    <span class="vex-alliance-pill vex-alliance-${match.opponentAlliance.color}">
                      ${match.opponentAlliance.teams.join(' & ')}
                      <span class="vex-alliance-score">${match.opponentAlliance.score}</span>
                    </span>
                    ` : ''}
                  </div>
                  <a href="https://www.robotevents.com/robot-competitions/vex-iq-competition/${match.eventCode}.html" target="_blank" class="vex-match-name">${match.name}</a>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.vex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.vex-refresh-team-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '⟳ Refreshing...';
      await refreshTeamData(team.team, team.teamId);
      modal.remove();
      buildEnhancedTable();
    });
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

  // Refresh a single team's cached data
  async function refreshTeamData(teamNumber, teamId) {
    const teamUpper = teamNumber.toUpperCase();
    debug('Refreshing data for team:', teamUpper, 'id:', teamId);

    // Invalidate all cache entries for this team
    if (teamId) {
      cacheInvalidate(`team_matches_${teamId}_recent`);
      cacheInvalidate(`team_matches_${teamId}_${getCompetitionId() || 'recent'}`);
      cacheInvalidate(`team_awards_${teamId}`);
      cacheInvalidate(`team_id_${teamUpper}`);
    }

    // Re-fetch match data
    if (teamId && hasApiToken()) {
      const eventCodeFilter = eventFinalized ? getCompetitionId() : null;
      const result = await fetchMatchData(teamId, eventCodeFilter);
      if (result) {
        if (!matchAverages) matchAverages = new Map();
        matchAverages.set(teamUpper, result);
      }

      // Re-fetch awards
      if (eventFinalized) {
        // Awards are event-level, no per-team invalidation needed for finalized
      } else {
        const awards = await fetchTeamSeasonAwards(teamId);
        if (awards.length > 0) {
          if (!eventAwards) eventAwards = new Map();
          eventAwards.set(teamUpper, awards);
        }
      }
    }

    log('Refreshed data for team', teamUpper);
  }

  // Session-only hidden awards (not persisted)
  let hiddenAwardNames = new Set();

  // Extract unique award names from eventAwards
  function getUniqueAwardNames() {
    const names = new Set();
    if (eventAwards) {
      for (const awards of eventAwards.values()) {
        for (const award of awards) {
          names.add(award.name);
        }
      }
    }
    return Array.from(names).sort();
  }

  // Filter awards based on session hidden set
  function filterAwards(awards) {
    if (!awards || awards.length === 0) {
      return awards;
    }

    if (hiddenAwardNames.size === 0) {
      return awards;
    }

    return awards.filter(award => !hiddenAwardNames.has(award.name));
  }

  // Populate the award filter checkboxes dynamically
  function populateAwardFilter() {
    const container = document.getElementById('vex-award-filter-container');
    if (!container) return;

    const awardNames = getUniqueAwardNames();

    if (awardNames.length === 0) {
      container.innerHTML = '<span style="color: #888; font-style: italic;">No awards found</span>';
      return;
    }

    container.innerHTML = awardNames.map(name => `
      <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
        <input type="checkbox" name="vex-award-filter" value="${name.replace(/"/g, '&quot;')}" checked>
        <span>${name}</span>
      </label>
    `).join('');

    // Add change listeners to immediately update the table
    container.querySelectorAll('input[name="vex-award-filter"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          hiddenAwardNames.delete(checkbox.value);
        } else {
          hiddenAwardNames.add(checkbox.value);
        }
        buildEnhancedTable();
      });
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

  // Get competition teams from all saved competitions
  function getCompetitionTeams() {
    const settings = loadSettings();
    const teams = new Set();
    Object.values(settings.competitionTeams || {}).forEach(comp => {
      if (comp.teams) {
        comp.teams.forEach(team => teams.add(team.toUpperCase()));
      }
    });
    return teams;
  }

  // Get manually highlighted teams
  function getHighlightedTeams() {
    const settings = loadSettings();
    return new Set((settings.highlightedTeams || []).map(t => t.toUpperCase()));
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

    const hasToken = !!(settings.apiToken && settings.apiToken.trim());

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
        <div style="display: flex; gap: 4px;">
          <input type="password" id="vex-api-token" placeholder="${hasToken ? '••••••••••••••••' : 'Enter API token'}" value="" style="flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
          <button id="vex-clear-token" style="padding: 6px 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; cursor: pointer; ${hasToken ? '' : 'display: none;'}">Clear</button>
        </div>
        <div id="vex-token-status" style="margin-top: 4px; font-size: 11px;">${hasToken ? '<span style="color: green;">Token saved</span>' : ''}</div>
        <p style="margin-top: 8px; font-size: 11px; color: #888;">Get your token from <a href="https://www.robotevents.com/api/v2" target="_blank" style="color: #c41230;">robotevents.com/api/v2</a></p>

        <div id="vex-match-filter-section" style="${hasToken ? '' : 'display: none;'}">
          <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">

          <label style="display: block; font-size: 12px; color: #333; margin-bottom: 8px; font-weight: 600;">Match History Filter:</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
              <input type="radio" name="vex-match-filter" value="since_date" ${(settings.matchFilterType || 'since_date') === 'since_date' ? 'checked' : ''}>
              <span>Events since</span>
              <input type="date" id="vex-filter-date" value="${settings.matchFilterDate || getDefaultFilterDate()}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
              <input type="radio" name="vex-match-filter" value="last_n_events" ${settings.matchFilterType === 'last_n_events' ? 'checked' : ''}>
              <span>Last</span>
              <input type="number" id="vex-filter-count" value="${settings.matchFilterCount || 5}" min="1" max="50" style="width: 50px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
              <span>events</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
              <input type="radio" name="vex-match-filter" value="all_events" ${settings.matchFilterType === 'all_events' ? 'checked' : ''}>
              <span>All events</span>
            </label>
          </div>

          <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">

          <label style="display: block; font-size: 12px; color: #333; margin-bottom: 8px; font-weight: 600;">Awards to Display:</label>
          <div id="vex-award-filter-container" style="display: flex; flex-direction: column; gap: 4px; font-size: 11px; max-height: 150px; overflow-y: auto;">
            <span style="color: #888; font-style: italic;">Loading awards...</span>
          </div>
        </div>

        <button id="vex-save-settings" style="margin-top: 12px; padding: 6px 12px; background: #c41230; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; width: 100%;">Save Settings</button>
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

    // Save all settings
    document.getElementById('vex-save-settings').addEventListener('click', () => {
      const settings = loadSettings();

      // API Token - only update if a new value was entered
      const tokenInput = document.getElementById('vex-api-token');
      const newToken = tokenInput.value.trim();
      if (newToken) {
        settings.apiToken = newToken;
      }

      // Match filter settings
      const filterType = document.querySelector('input[name="vex-match-filter"]:checked')?.value || 'since_date';
      settings.matchFilterType = filterType;
      settings.matchFilterDate = document.getElementById('vex-filter-date').value;
      settings.matchFilterCount = parseInt(document.getElementById('vex-filter-count').value) || 5;

      saveSettings(settings);

      // Update UI to reflect saved state
      const hasToken = !!(settings.apiToken && settings.apiToken.trim());
      const tokenStatus = document.getElementById('vex-token-status');
      const matchFilterSection = document.getElementById('vex-match-filter-section');

      tokenStatus.innerHTML = '<span style="color: green;">✓ Settings saved! Reload page to apply changes.</span>';
      tokenInput.value = '';
      tokenInput.placeholder = hasToken ? '••••••••••••••••' : 'Enter API token';

      if (matchFilterSection) {
        matchFilterSection.style.display = hasToken ? '' : 'none';
      }

      // Update clear button visibility
      const clearButton = document.getElementById('vex-clear-token');
      if (clearButton) {
        clearButton.style.display = hasToken ? '' : 'none';
      }
    });

    // Clear token button
    document.getElementById('vex-clear-token')?.addEventListener('click', () => {
      const settings = loadSettings();
      settings.apiToken = '';
      saveSettings(settings);

      // Update UI
      const tokenInput = document.getElementById('vex-api-token');
      const tokenStatus = document.getElementById('vex-token-status');
      const matchFilterSection = document.getElementById('vex-match-filter-section');
      const clearButton = document.getElementById('vex-clear-token');

      tokenInput.value = '';
      tokenInput.placeholder = 'Enter API token';
      tokenStatus.innerHTML = '<span style="color: #888;">Token cleared. Reload page to apply changes.</span>';

      if (matchFilterSection) {
        matchFilterSection.style.display = 'none';
      }
      if (clearButton) {
        clearButton.style.display = 'none';
      }
    });

    // Populate award filter with any awards already loaded
    populateAwardFilter();
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

    // Log current settings on init
    const initSettings = loadSettings();
    debug('Initial settings - hiddenAwards:', initSettings.hiddenAwards);

    try {
      // Wait for the page to fully load (including dynamic content)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract teams from the page
      eventTeams = extractTeams();
      debug('Found', eventTeams.length, 'teams on page');

      if (eventTeams.length > 0) {
        const competitionId = getCompetitionId();
        let eventId = null;

        // Fetch event info from API to get ID and finalization status
        if (hasApiToken()) {
          try {
            const eventInfo = await fetchEventInfo(competitionId);
            if (eventInfo) {
              eventId = eventInfo.id;
              eventFinalized = eventInfo.finalized;
              debug('Event finalized:', eventFinalized, 'Event ID:', eventId);
            }
          } catch (err) {
            error('Failed to fetch event info:', err);
          }
        }

        // For finalized events, fetch event-specific data
        // Otherwise, fetch global skills data
        if (eventFinalized && eventId) {
          try {
            debug('Fetching event-specific skills for event ID:', eventId);
            await fetchEventSkillsData(eventId);
          } catch (err) {
            error('Failed to fetch event-specific skills:', err);
            await fetchSkillsData(); // Fallback to global
          }

          // Also fetch awards for finalized events
          try {
            debug('Fetching event awards for event ID:', eventId);
            await fetchEventAwards(eventId);
          } catch (err) {
            error('Failed to fetch event awards:', err);
          }
        } else {
          // Fetch global skills data for upcoming events or when no token
          try {
            await fetchSkillsData();
          } catch (err) {
            error('Failed to fetch skills data:', err);
          }
        }

        // Build table immediately with whatever data we have (skills + cached awards)
        // Show overlay if we still need to fetch per-team data
        if (hasApiToken()) {
          showLoadingOverlay('Loading team data...');
        }
        buildEnhancedTable();

        // Now progressively fetch per-team data (matches, awards)
        // Cached results return instantly; only network fetches cause delays
        if (hasApiToken()) {
          try {
            // Fetch team IDs (mostly cached after first visit)
            const teamNumbers = eventTeams.map(t => t.team);
            updateLoadingMessage(`Resolving ${teamNumbers.length} teams...`);
            debug('Fetching team IDs for', teamNumbers.length, 'teams');
            const teamIdMap = await fetchTeamIds(teamNumbers);

            const teamsWithIds = eventTeams.map(team => ({
              team: team.team,
              teamId: teamIdMap.get(team.team) || null
            })).filter(t => t.teamId);

            debug('Teams with IDs:', teamsWithIds.length, 'of', eventTeams.length);

            const eventCodeFilter = eventFinalized ? competitionId : null;

            // Progressive callback rebuilds the table as data arrives
            let matchesLoaded = 0;
            const onProgress = (results) => {
              if (results) {
                matchAverages = results;
                matchesLoaded = results.size;
              }
              updateLoadingMessage(`Loading matches... ${matchesLoaded} / ${teamsWithIds.length} teams`);
              buildEnhancedTable();
            };

            updateLoadingMessage(`Loading matches... 0 / ${teamsWithIds.length} teams`);
            debug('Fetching match data for', teamsWithIds.length, 'teams...', eventCodeFilter ? `(event: ${eventCodeFilter})` : '(recent)');
            matchAverages = await fetchAllMatchAverages(teamsWithIds, eventCodeFilter, onProgress);
            debug('Got match averages for', matchAverages.size, 'teams');

            // For non-finalized events, fetch season awards for all teams
            if (!eventFinalized) {
              updateLoadingMessage('Loading season awards...');
              debug('Fetching season awards for', teamsWithIds.length, 'teams...');
              await fetchAllSeasonAwards(teamsWithIds, () => buildEnhancedTable());
            }

            // All done — remove overlay and do final rebuild
            hideLoadingOverlay();
            buildEnhancedTable();
            populateAwardFilter();
          } catch (err) {
            error('Failed to fetch match averages:', err);
            hideLoadingOverlay();
          }
        }
      }
    } catch (err) {
      error('Error during initialization:', err);
    }

    // Create capture button (always, even if there are errors)
    try {
      createCaptureButton();
      checkExistingCapture();
    } catch (err) {
      error('Failed to create capture button:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
