function isCMSVersion(version: string): boolean {
  return version.toLowerCase().indexOf('-cms') != -1;
}

// Extract project version text directly from the select options
function getProjectVersionsFromDOM(doc: Document): Record<string, string> {
  var projectVersionIdFilter = <HTMLSelectElement | null> doc.getElementById('_1_WAR_osbpatcherportlet_patcherProjectVersionIdFilter');
  
  if (!projectVersionIdFilter) {
    return {};
  }

  return Array.from(projectVersionIdFilter.options)
    .filter(opt => opt.text && !isCMSVersion(opt.text))
    .reduce((acc, next) => {
        acc[next.text.trim()] = next.value;
        return acc;
    }, <Record<string, string>> {});
}

var projectVersionsPromise: Promise<Record<string, string>> | null = null;

function getFixesTabURL(): string {
  var tabLinks = <HTMLAnchorElement[]> Array.from(document.querySelectorAll('ul.nav.nav-tabs li.tab a'));

  for (var i = 0; i < tabLinks.length; i++) {
    if ((tabLinks[i].textContent || '').trim() == 'Fixes' && tabLinks[i].href) {
      return tabLinks[i].href;
    }
  }

  return '/group/guest/patching/-/osb_patcher';
}

// The project version select only exists on the fixes page, so if we
// are on some other page, fetch the fixes page and read it from there.
function getProjectVersions(): Promise<Record<string, string>> {
  if (projectVersionsPromise) {
    return projectVersionsPromise;
  }

  var activeTab = document.querySelector('.tab.active');
  var activeTabName = activeTab ? (activeTab.textContent || '').trim() : '';

  if (activeTabName == 'Fixes') {
    var projectVersions = getProjectVersionsFromDOM(document);

    if (Object.keys(projectVersions).length > 0) {
      projectVersionsPromise = Promise.resolve(projectVersions);
      return projectVersionsPromise;
    }
  }

  projectVersionsPromise = fetch(getFixesTabURL())
    .then(response => response.text())
    .then(html => getProjectVersionsFromDOM(new DOMParser().parseFromString(html, 'text/html')))
    .catch(err => {
      console.error('Unable to load project versions from the fixes page', err);
      projectVersionsPromise = null;
      return <Record<string, string>> {};
    });

  return projectVersionsPromise;
}

var patcherFixVersionsCache: Record<string, Set<string>> = {};

async function getPatcherFixVersionsPage(token: string, page: number): Promise<Response> {
  var params = new URLSearchParams();
  params.append('p_p_id', portletId);
  params.append('p_p_state', 'exclusive');
  params.append(ns + 'advancedSearch', 'true');
  params.append(ns + 'andOperator', 'true');
  params.append(ns + 'patcherFixName', token);
  params.append(ns + 'statusFilter', '100');
  params.append(ns + 'delta', '200');
  params.set(ns + 'cur', String(page));

  return fetch('/group/guest/patching?' + params.toString());
}

async function getPatcherFixVersions(token: string, tokensSet: Set<string>): Promise<{token: string, foundVersions: Set<string>}> {
  if (patcherFixVersionsCache[token]) {
    updateSpinner(1);
    return {
      token,
      foundVersions: patcherFixVersionsCache[token],
    };
  }

  var parser = new DOMParser();

  var response = await getPatcherFixVersionsPage(token, 1);

  var initialResponseDocument = parser.parseFromString(await response.text(), 'text/html');

  var lastButton = initialResponseDocument.querySelector('#' + ns + 'patcherFixsSearchContainerPageIteratorBottom ul.lfr-pagination-buttons li.last');

  var responseDocuments = [initialResponseDocument];

  if (lastButton && !lastButton.classList.contains('disabled')) {
    var lastLink = <HTMLAnchorElement> lastButton.querySelector('a');
    var lastURLParams = new URL(lastLink.href).searchParams;
    var pageCount = parseInt(lastURLParams.get(ns + 'cur') || '1');

    var responseTexts = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) => getPatcherFixVersionsPage(token, index + 2).then(it => it.text()))
    );

    responseDocuments = responseDocuments.concat(responseTexts.map(it => parser.parseFromString(it, 'text/html')));
  }

  var foundVersions = responseDocuments.reduce((acc, next) => {
    var newFoundVersions = <string[]> Array.from(next.querySelectorAll('#' + ns + 'patcherFixsSearchContainerSearchContainer table tbody tr'))
        // .filter(row => {
        //     var contentCell = row.querySelector('td:nth-child(3)');
        //     if (!contentCell || !contentCell.textContent) {
        //         return false;
        //     }
        //     var tokenList = contentCell.textContent.split(',').filter(it => it).map(it => it.trim());
        //     return tokenList.length > 0 && tokenList.every(it => tokensSet.has(it));
        // })
        .map(row => {
            var versionCell = row.querySelector('td:nth-child(6)');
            if (!versionCell || !versionCell.textContent) {
                return null;
            }
            return versionCell.textContent.trim();
        })
        .filter(it => it);

    return acc.concat(newFoundVersions);
  }, <string[]> []);

  var resultSet = new Set(foundVersions.filter(it => !isCMSVersion(it)));
  patcherFixVersionsCache[token] = resultSet;

  updateSpinner(1);

  return {
    token,
    foundVersions: resultSet,
  };
}

// Helper: Modular fetch API call with URL-encoded body
async function getAllPatcherFixVersions(tokensList: string[], tokensSet: Set<string>): Promise<Record<string, Set<string>>> {
  var fixVersionsList = await Promise.all(tokensList.map(token => getPatcherFixVersions(token, tokensSet)));

  return fixVersionsList.reduce((acc, next) => {
    acc[next.token] = next.foundVersions;
    return acc;
  }, <Record<string, Set<string>>> {});
}

function getPatcherPortalFixSearchURL(tokens: string[], version: string, projectVersions: Record<string, string>): string | null {
  if (!(version in projectVersions)) {
    return null;
  }

  var params = new URLSearchParams();
  params.append('p_p_id', portletId);
  params.append('p_p_state', 'maximized');
  params.append(ns + 'advancedSearch', 'true');
  params.append(ns + 'andOperator', 'true');
  params.append(ns + 'patcherFixName', tokens.join(','));
  params.append(ns + 'statusFilter', '100');
  params.append(ns + 'delta', '200');
  params.append(ns + 'patcherProjectVersionIdFilter', projectVersions[version]);

  return `/group/guest/patching?${params.toString()}`;
}

interface VersionLevel {
  line: string;
  level: number;
}

// The fix pack (or update, for 7.3) that each 7.0, 7.1, 7.2 and 7.3 service
// pack is equivalent to, indexed by service pack number (7.2 SP3 is 7.2 FP8,
// and 7.0 SP9 is 7.0 DE60), matching liferay-faster-deploy/jira/releases.py.
var servicePackFixPacks: Record<string, number[]> = {
  '7.0': [0, 7, 12, 14, 22, 30, 32, 40, 50, 60, 70, 80, 87, 90, 93, 96, 99, 102],
  '7.1': [0, 5, 10, 15, 17, 20, 23, 26, 28],
  '7.2': [0, 2, 5, 8, 11, 14, 17, 19, 20],
  '7.3': [0, 1, 2, 3],
};

// Returns the release line and patch level of a Patcher project version (such
// as 2025.q1.5, 7.4.13-u92 or fix-pack-dxp-8-7210) or a Jira fix version (such
// as 2025.Q1.5, 7.4.13 DXP U92, 7.2.10 DXP FP8 or 7.2.10.3 DXP SP3), or null if
// it isn't part of a release line with numbered patch levels. The release
// lines are quarterly releases (such as 2025.q1), 7.4, 7.3, 7.2, 7.1 and 7.0.
function parseVersionLevel(version: string | null): VersionLevel | null {
  if (!version) {
    return null;
  }

  var v = version.trim();
  var m: RegExpMatchArray | null;

  if (m = v.match(/^(\d{4})\.q([1-4])\.(\d+)/i)) {
    return { line: m[1] + '.q' + m[2], level: parseInt(m[3]) };
  }

  // Patcher project versions

  if (m = v.match(/^7\.4\.13-u(\d+)/)) {
    return { line: '7.4', level: parseInt(m[1]) };
  }

  if (/^7\.4\.13-ga1/.test(v)) {
    return { line: '7.4', level: 0 };
  }

  if (m = v.match(/^fix-pack-base-7([0-4])(?:10|13)(?:-private)?$/)) {
    return { line: '7.' + m[1], level: 0 };
  }

  if (m = v.match(/^fix-pack-(?:de|dxp)-(\d+)-7([0-3])10(?:-private)?$/)) {
    return { line: '7.' + m[2], level: parseInt(m[1]) };
  }

  // Jira fix versions

  if (m = v.match(/^7\.4\.13 DXP U(\d+)/i)) {
    return { line: '7.4', level: parseInt(m[1]) };
  }

  if (m = v.match(/^7\.4\.(?:3|13)\.(\d+)\s+(?:CE\s+)?GA/i)) {
    var ga = parseInt(m[1]);
    return (ga >= 15) ? { line: '7.4', level: ga } : (ga > 4) ? { line: '7.4', level: ga - 4 } : null;
  }

  if (m = v.match(/^7\.([0-4])\.\d+ DXP GA1/i)) {
    return { line: '7.' + m[1], level: 0 };
  }

  if (m = v.match(/^7\.3\.10(?:\.\d+)? DXP (?:U|FP)\s*(\d+)/i)) {
    return { line: '7.3', level: parseInt(m[1]) };
  }

  if (m = v.match(/^7\.([0-2])\.\d+ DXP FP\s*(\d+)/i)) {
    return { line: '7.' + m[1], level: parseInt(m[2]) };
  }

  if (m = v.match(/^7\.([0-3])\.\d+(?:\.\d+)?[\s.-]*(?:DXP\s*)?SP\s*(\d+)/i)) {
    var fixPack = servicePackFixPacks['7.' + m[1]][parseInt(m[2])];
    return (fixPack === undefined) ? null : { line: '7.' + m[1], level: fixPack };
  }

  return null;
}

function getVersionLine(version: string): string | null {
  var parsed = parseVersionLevel(version);
  return parsed ? parsed.line : null;
}

// Orders release lines from oldest to newest: 7.0 to 7.4, then the quarterly
// releases.
function getLineOrder(line: string): number {
  var m = line.match(/^(\d{4})\.q([1-4])$/);

  if (m) {
    return parseInt(m[1]) * 10 + parseInt(m[2]);
  }

  m = line.match(/^7\.(\d)$/);

  return m ? 70 + parseInt(m[1]) : 0;
}

function isLTSLine(line: string): boolean {
  return /\.q1$/.test(line);
}

function compareVersionLevels(a: VersionLevel, b: VersionLevel): number {
  if (a.line != b.line) {
    return getLineOrder(a.line) - getLineOrder(b.line);
  }

  return a.level - b.level;
}

// Compares two version names (Patcher or Jira) by release line and patch
// level, putting names that aren't part of a release line first.
function compareFixVersionNames(a: string, b: string): number {
  var aLevel = parseVersionLevel(a);
  var bLevel = parseVersionLevel(b);

  if (!aLevel || !bLevel) {
    return (aLevel ? 1 : 0) - (bLevel ? 1 : 0);
  }

  return compareVersionLevels(aLevel, bLevel);
}

// Returns the short name of a patch level, matching the names used by the LSV
// checker (such as 2025.q1.5, 7.4.13-u92, 7.3.10-u3, 7.2.10-fp8 or 7.0.10-de60).
function getReleaseName(level: VersionLevel): string {
  if (/\.q[1-4]$/.test(level.line)) {
    return level.line + '.' + level.level;
  }

  var base = (level.line == '7.4') ? '7.4.13' : level.line + '.10';

  if (level.level == 0) {
    return base + '-ga1';
  }

  var type = ((level.line == '7.4') || (level.line == '7.3')) ? 'u' : (level.line == '7.0') ? 'de' : 'fp';

  return base + '-' + type + level.level;
}

function compareProjectVersionNames(a: string, b: string): number {
  var result = compareFixVersionNames(a, b);

  if (result != 0) {
    return result;
  }

  return a > b ? 1 : a < b ? -1 : 0;
}

interface BulkSearchFixStatus {
  prefix: string;
  selectedVersion: string;
  jiraStatus: JiraSecurityStatus | null;
  unknownReason: string | null;
}

type ParsedFixVersion = { original: string, clean: string, line: string, level: number };

function getParsedFixVersions(jiraStatus: JiraSecurityStatus | null): ParsedFixVersion[] {
  if (!jiraStatus) {
    return [];
  }

  var targets: ParsedFixVersion[] = [];

  for (var original of jiraStatus.fixVersions) {
    var parsed = parseVersionLevel(original);

    if (parsed) {
      targets.push({ original: original, clean: getReleaseName(parsed), line: parsed.line, level: parsed.level });
    }
  }

  targets.sort(compareVersionLevels);

  return targets;
}

// Combines the statuses of every LPE ticket for a CVE: a release line has the
// fix only once every one of them is fixed in it, so it is fixed in the latest
// of their fix versions in that release line.
function combineSecurityStatuses(statuses: (JiraSecurityStatus | null)[]): JiraSecurityStatus | null {
  if ((statuses.length == 0) || statuses.some(status => !status)) {
    return null;
  }

  var lineFixes = statuses.map(status => {
    var fixes: Record<string, ParsedFixVersion> = {};

    for (var target of getParsedFixVersions(status)) {
      fixes[target.line] = target;
    }

    return fixes;
  });

  var fixVersions = Object.keys(lineFixes[0])
    .filter(line => lineFixes.every(fixes => line in fixes))
    .map(line => lineFixes.map(fixes => fixes[line]).sort(compareVersionLevels).pop())
    .map(target => (<ParsedFixVersion> target).original);

  return { fixVersions: fixVersions };
}

// Returns HTML showing which baselines have the fix: one line per release line
// that has a hotfix for it, with a small square for each patch level in that
// release line, followed by whether that release line has the fix. When a
// release line is selected, only that release line is shown.
//
// - blue: a hotfix is available (and links to it)
// - green: the release itself includes the fix
// - red: affected with no hotfix (only known when checking the fix status)
// - grey: no hotfix
//
// The release line being checked is highlighted and followed by its status,
// and the patch level being checked is outlined.
function getAvailableBaselinesHTML(
  tokens: string[],
  fixVersions: Set<string>,
  projectVersions: Record<string, string>,
  fixStatus: BulkSearchFixStatus | null
): string {
  var lineFixes: Record<string, ParsedFixVersion> = {};

  if (fixStatus) {
    for (var target of getParsedFixVersions(fixStatus.jiraStatus)) {
      lineFixes[target.line] = target;
    }
  }

  // Versions that aren't part of a release line (such as marketplace apps)
  // are left out.

  var lineVersions: Record<string, Set<string>> = {};

  fixVersions.forEach(version => {
    var line = getVersionLine(version);

    if (line) {
      lineVersions[line] = lineVersions[line] || new Set();
      lineVersions[line].add(version);
    }
  });

  // When checking one release line, only show that release line. Otherwise,
  // also show the release lines that have the fix in a release.

  if (fixStatus && fixStatus.prefix) {
    lineVersions = {
      [fixStatus.prefix]: lineVersions[fixStatus.prefix] || new Set(),
    };
  }
  else {
    Object.keys(lineFixes).forEach(fixLine => {
      lineVersions[fixLine] = lineVersions[fixLine] || new Set();
    });
  }

  for (var version of Object.keys(projectVersions)) {
    var line = getVersionLine(version);

    if (line && lineVersions[line]) {
      lineVersions[line].add(version);
    }
  }

  var lines = Object.keys(lineVersions)
    .filter(line => lineVersions[line].size > 0)
    .map(line => ({
      line: line,
      versions: Array.from(lineVersions[line]).sort(compareProjectVersionNames),
    }));

  lines.sort((a, b) => compareProjectVersionNames(a.versions[0], b.versions[0]));

  var linesHTML = lines.map(item => {
    var lineFix = lineFixes[item.line] || null;
    var isSelectedLine = !!fixStatus && (item.line == fixStatus.prefix);
    var isAffectedKnown = !!fixStatus && !!fixStatus.jiraStatus && (!!lineFix || isSelectedLine);
    var hotfixCount = item.versions.filter(version => fixVersions.has(version)).length;

    var selectedLevel = (fixStatus && isSelectedLine) ? parseVersionLevel(fixStatus.selectedVersion) : null;

    var squaresHTML = item.versions.map(version => {
      var classNames = ['bulk-search-square'];
      var title = version;
      var versionLevel = <VersionLevel> parseVersionLevel(version);

      if (lineFix && (versionLevel.level >= lineFix.level)) {
        classNames.push('bulk-search-square-released');
        title += ': fixed in ' + lineFix.clean;
      }
      else if (fixVersions.has(version)) {
        classNames.push('bulk-search-square-hotfix');
        title += ': hotfix available';
      }
      else if (isAffectedKnown) {
        classNames.push('bulk-search-square-affected');
        title += ': affected, no hotfix';
      }
      else {
        title += ': no hotfix';
      }

      if (selectedLevel && (versionLevel.level == selectedLevel.level)) {
        classNames.push('bulk-search-square-selected');
      }

      var url = fixVersions.has(version) ? getPatcherPortalFixSearchURL(tokens, version, projectVersions) : null;

      if (url) {
        return `<a class="${classNames.join(' ')}" href="${url}" target="_blank" title="${title}"></a>`;
      }

      return `<span class="${classNames.join(' ')}" title="${title}"></span>`;
    }).join('');

    var summary: string[] = [];

    if (fixStatus && isSelectedLine) {
      if (!fixStatus.jiraStatus && fixStatus.unknownReason) {
        summary.push(`<span class="label label-default">Unknown</span> <span class="bulk-search-status-text">${fixStatus.unknownReason}</span>`);
      }
      else {
        summary.push(getTicketSecurityStatus(fixStatus.prefix, fixStatus.selectedVersion, fixStatus.jiraStatus));
      }
    }
    else if (fixStatus && fixStatus.jiraStatus) {
      if (lineFix) {
        summary.push(getStatusBadgeHTML('label-success', 'Fixed', 'fixed in ' + getFixVersionHTML(lineFix)));
      }
      else {
        summary.push(getStatusBadgeHTML('label-default', 'No fix',
          `not fixed in <span class="bulk-search-ticket-name">${item.line}</span>; ${getOtherFixHTML(getParsedFixVersions(fixStatus.jiraStatus), item.line)}`));
      }
    }

    if (hotfixCount > 0) {
      summary.push(`<span class="bulk-search-line-count">${hotfixCount} of ${item.versions.length} with hotfixes</span>`);
    }

    return `
      <div class="bulk-search-line">
        <span class="bulk-search-line-name">${item.line}</span>
        <span class="bulk-search-squares">${squaresHTML}</span>
        <span class="bulk-search-line-summary">${summary.join(' ')}</span>
      </div>
    `;
  }).join('');

  return linesHTML;
}

function getBulkSearchLegendHTML(): string {
  var items = [
    ['bulk-search-square-released', 'fixed in the release'],
    ['bulk-search-square-hotfix', 'affected, hotfix available'],
    ['bulk-search-square-affected', 'affected, no hotfix'],
    ['', 'no hotfix (fix status unknown)'],
    ['bulk-search-square-selected', 'checked patch level'],
  ];

  return '<div class="bulk-search-legend">' + items.map(item =>
    `<span><span class="bulk-search-square ${item[0]}"></span> ${item[1]}</span>`
  ).join('') + '</div>';
}

async function getJiraFieldsGraph(tokens: string[]): Promise<Record<string, JiraFields>> {
  const fields: Record<string, JiraFields> = {};

  const prefixes = ['LPE', 'LPD', 'LPS', 'LPSA', 'COMMERCE', 'LSV'];
  tokens = tokens.filter(token => prefixes.some(prefix => token.startsWith(prefix)));

  while (tokens.length > 0) {
    const issues = await getJiraIssuesByKey(tokens, ['key', 'issuelinks', 'versions', 'fixVersions', 'customfield_10886'], [], false);
    tokens = [];

    for (const issue of issues) {
      if (!issue.fields) {
        continue;
      }

      const key = issue.key;
      fields[key] = issue.fields;

      if (!issue.fields.issuelinks) {
        continue;
      }

      for (const link of issue.fields.issuelinks) {
        const linkedIssue = link.outwardIssue || link.inwardIssue;

        if (!linkedIssue) {
          continue;
        }

        const linkedIssueKey = linkedIssue.key;

        if (linkedIssueKey in fields || !prefixes.some(prefix => linkedIssueKey.startsWith(prefix))) {
          continue;
        }

        if (key.startsWith('LPE-')) {
          if (!linkedIssueKey.startsWith('LPE-')) {
            tokens.push(linkedIssueKey);
          }
        }
        else if (!key.startsWith('LSV-')) {
          if (linkedIssueKey.startsWith('LPE-') || linkedIssueKey.startsWith('LSV-')) {
            tokens.push(linkedIssueKey);
          }
        }
      }
    }
  }

  return fields;
}

function isApplicableFixVersion(fvName: string, targetVersion: string): boolean {
  const fvLine = getVersionLine(fvName);
  return !!fvLine && (fvLine === getVersionLine(targetVersion));
}

async function getJiraSecurityStatusRecord(
  tokens: string[]
): Promise<Record<string, JiraSecurityStatus>> {
  if (tokens.length === 0) {
    return {};
  }

  try {
    await getJiraAPIResponse('/rest/api/3/myself');
  }
  catch (e) {
    return {};
  }

  const jiraFieldsGraph = await getJiraFieldsGraph(tokens);
  updateSpinner(1);

  const record: Record<string, JiraSecurityStatus> = {};

  for (const key of Object.keys(jiraFieldsGraph)) {
    const issue = jiraFieldsGraph[key];
    if (!issue) {
      continue;
    }

    // Determine lsvKeys
    const lsvKeys = new Set<string>();
    if (key.startsWith('LSV-')) {
      lsvKeys.add(key);
    } else {
      if (issue.issuelinks) {
        for (const link of issue.issuelinks) {
          const linkedIssue = link.outwardIssue || link.inwardIssue;
          if (linkedIssue) {
            const lk = linkedIssue.key;
            if (lk.startsWith('LSV-') && lk in jiraFieldsGraph) {
              lsvKeys.add(lk);
            } else if ((lk.startsWith('LPS-') || lk.startsWith('LPD-')) && lk in jiraFieldsGraph) {
              const parentIssue = jiraFieldsGraph[lk];
              if (parentIssue && parentIssue.issuelinks) {
                for (const plink of parentIssue.issuelinks) {
                  const plinkedIssue = plink.outwardIssue || plink.inwardIssue;
                  if (plinkedIssue) {
                    const plk = plinkedIssue.key;
                    if (plk.startsWith('LSV-') && plk in jiraFieldsGraph) {
                      lsvKeys.add(plk);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Pool this issue and its directly linked parent/related issues (for fallback)
    const pooledIssues = [issue];
    if (issue.issuelinks) {
      for (const link of issue.issuelinks) {
        const linkedIssue = link.outwardIssue || link.inwardIssue;
        if (linkedIssue && linkedIssue.key in jiraFieldsGraph) {
          pooledIssues.push(jiraFieldsGraph[linkedIssue.key]);
        }
      }
    }

    // Step 1: Collect affects versions from linked LSV tickets
    const lsvAffectsMap = new Map<string, string>();
    for (const lk of lsvKeys) {
      const lsvIssue = jiraFieldsGraph[lk];
      if (lsvIssue && lsvIssue.versions) {
        for (const ver of lsvIssue.versions) {
          if (ver && ver.name) {
            lsvAffectsMap.set(ver.name, `${lk} via versions`);
          }
        }
      }
    }

    // Step 2: Extract pooled fix_versions (including customfield_10886)
    const stdFixVersionsMap = new Map<string, string>();
    for (const issueNode of pooledIssues) {
      const tKey = Object.keys(jiraFieldsGraph).find(k => jiraFieldsGraph[k] === issueNode) || key;
      if (issueNode.fixVersions) {
        for (const fv of issueNode.fixVersions) {
          if (fv && fv.name) {
            // Prefer the ticket itself, do not overwrite if already set by a prior issue (like the ticket itself)
            if (!stdFixVersionsMap.has(fv.name)) {
              stdFixVersionsMap.set(fv.name, `${tKey} via fixVersions`);
            }
          }
        }
      }
      const cfVal = issueNode.customfield_10886;
      if (cfVal) {
        if (Array.isArray(cfVal)) {
          for (const fv of cfVal) {
            if (fv && fv.name) {
              if (!stdFixVersionsMap.has(fv.name)) {
                stdFixVersionsMap.set(fv.name, `${tKey} via customfield_10886`);
              }
            }
          }
        } else if (typeof cfVal === 'object') {
          const name = cfVal.name;
          if (name) {
            if (!stdFixVersionsMap.has(name)) {
              stdFixVersionsMap.set(name, `${tKey} via customfield_10886`);
            }
          }
        }
      }
    }

    const finalFixVersionsMap = new Map<string, string>();
    if (lsvAffectsMap.size > 0) {
      // Use compareFixVersionNames to resolve each affected version from lsvAffectsMap 
      // to the closest fix version chronologically after it from stdFixVersionsMap,
      // restricted to the correct release line via isApplicableFixVersion.
      for (const [ver, source] of lsvAffectsMap.entries()) {
        const candidates = Array.from(stdFixVersionsMap.keys())
          .filter(candidate => !isCMSVersion(candidate) && isApplicableFixVersion(candidate, ver) && compareFixVersionNames(candidate, ver) > 0);

        if (candidates.length > 0) {
          candidates.sort(compareFixVersionNames);
          const closestFix = candidates[0];
          const closestSource = stdFixVersionsMap.get(closestFix);
          finalFixVersionsMap.set(closestFix, `${closestSource}`);
        }
      }

      // Also combine with customfield_10886 precise fix versions from pooled issues
      for (const issueNode of pooledIssues) {
        const tKey = Object.keys(jiraFieldsGraph).find(k => jiraFieldsGraph[k] === issueNode) || key;
        const cfVal = issueNode.customfield_10886;
        if (cfVal) {
          if (Array.isArray(cfVal)) {
            for (const fv of cfVal) {
              if (fv && fv.name) {
                // Prefer the ticket itself or previously resolved closestFix, do not overwrite
                if (!finalFixVersionsMap.has(fv.name)) {
                  finalFixVersionsMap.set(fv.name, `${tKey} via customfield_10886`);
                }
              }
            }
          } else if (typeof cfVal === 'object') {
            const name = cfVal.name;
            if (name) {
              if (!finalFixVersionsMap.has(name)) {
                finalFixVersionsMap.set(name, `${tKey} via customfield_10886`);
              }
            }
          }
        }
      }
    } else {
      for (const [ver, source] of stdFixVersionsMap.entries()) {
        finalFixVersionsMap.set(ver, source);
      }
    }

    const fixVersions: string[] = [];
    for (const [ver, source] of finalFixVersionsMap.entries()) {
      if (isCMSVersion(ver)) {
        continue;
      }
      fixVersions.push(`${ver} (${source})`);
    }

    record[key] = {
      fixVersions: fixVersions
    };
  }

  return record;
}

async function getJiraAPIResponse(path: string): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    GM.xmlHttpRequest({
      method: 'GET',
      url: 'https://liferay.atlassian.net' + path,
      responseType: 'json',
      onload: function(r: XMLHttpRequest) {
        if (r.status == 200) {
          resolve(r);
        }
        else if (r.status == 429) {
          var retryAfter = (parseInt(r.getResponseHeader('Retry-After') || '0') + 1) * 1000;
          setTimeout(getJiraAPIResponse.bind(null, path), retryAfter);
        }
        else {
          reject(new Error("Empty response"));
        }
      },
      onerror: reject,
      ontimeout: reject,
    });
  });
}

async function getJiraIssuesByKey(tokens: string[], fields: string[], expand: string[], render: boolean): Promise<JiraIssue[]> {
  var issues: JiraIssue[] = [];

  const chunkSize = 100;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const jql = `key in (${chunk.join(',')})`;

    issues = issues.concat(await getJiraIssues(jql, fields, expand, render));
  }

  return issues;
}

async function getJiraIssues(jql: string, fields: string[], expand: string[], render: boolean): Promise<JiraIssue[]> {
  if (render) {
    expand = expand.concat(['renderedFields'])
  }

  const params = new URLSearchParams();
  params.append('jql', jql);
  params.append('maxResults', '100');

  if (fields.length > 0) {
    params.append('fields', fields.join(','));
  }
  else {
    params.append('fields', '*all');
  }

  if (expand.length > 0) {
    params.append('expand', expand.join(','));
  }

  const searchURL = '/rest/api/3/search/jql';

  var issues: JiraIssue[] = [];

  try {
    var r: JiraSearchRequest = await getJiraAPIResponse(`${searchURL}?${params.toString()}`);
    var response = r.response;

    issues = issues.concat(response.issues);

    while (!response.isLast && response.nextPageToken) {
      params.set('nextPageToken', response.nextPageToken);

      r = await getJiraAPIResponse(`${searchURL}?${params.toString()}`);
      response = r.response;

      issues = issues.concat(response.issues);
    }
  }
  catch (e) {
    console.error(e);
    return issues;
  }

  return issues;
}

// Badges and wording match the "Liferay Security Vulnerabilities By Release"
// tool (liferay-faster-deploy/packageinfo/lsv_checker.html) for continuity.

function getStatusBadgeHTML(labelClass: string, text: string, reason: string): string {
  return `<span class="label ${labelClass}">${text}</span> <span class="bulk-search-status-text">${reason}</span>`;
}

function getFixVersionHTML(target: ParsedFixVersion): string {
  var source = target.original.match(/\((.*)\)\s*$/);
  var title = source ? ` title="${source[1]}"` : '';
  return `<span class="bulk-search-ticket-name"${title}>${target.clean}</span>`;
}

// Returns the fix outside the selected release line: the earliest fix in the
// next LTS (.q1) release line after it, or else in the next release line after
// it, or else the first fix at all.
function getOtherFixHTML(targets: ParsedFixVersion[], prefix: string): string {
  if (targets.length == 0) {
    return 'fix version undocumented';
  }

  var laterTargets = targets.filter(t => getLineOrder(t.line) > getLineOrder(prefix));
  var ltsTargets = laterTargets.filter(t => isLTSLine(t.line));

  if (ltsTargets.length > 0) {
    return 'LTS fix in ' + getFixVersionHTML(ltsTargets[0]);
  }

  if (laterTargets.length > 0) {
    return 'fixed in ' + getFixVersionHTML(laterTargets[0]);
  }

  return 'first fixed in ' + getFixVersionHTML(targets[0]);
}

function getTicketSecurityStatus(
  prefix: string,
  selectedVersion: string,
  jiraStatus: JiraSecurityStatus | null
): string {
  if (!jiraStatus) {
    return `<span class="label label-default">Unknown</span> <span class="bulk-search-status-text">unable to load from Jira</span>`;
  }

  const targets = getParsedFixVersions(jiraStatus);

  const prefixTargets = targets.filter(t => t.line == prefix);

  // No release in this release line has the fix yet

  if (prefixTargets.length == 0) {
    return getStatusBadgeHTML('label-danger', 'Affected',
      `not fixed in <span class="bulk-search-ticket-name">${prefix}</span>; ${getOtherFixHTML(targets, prefix)}`);
  }

  const lineFix = prefixTargets[prefixTargets.length - 1];
  const fixedInHTML = 'fixed in ' + getFixVersionHTML(lineFix);

  if (selectedVersion === 'All') {
    return getStatusBadgeHTML('label-success', 'Fixed', fixedInHTML);
  }

  const selectedLevel = parseVersionLevel(selectedVersion);

  if (selectedLevel && (selectedLevel.level >= lineFix.level)) {
    return getStatusBadgeHTML('label-success', 'Not affected', fixedInHTML);
  }

  return getStatusBadgeHTML('label-danger', 'Affected', fixedInHTML);
}

var securityIssueSynonymsPromise: Promise<Record<string, string[]>> | null = null;

// Fetches the security issue synonyms once per page load, since changing the
// bulk search options re-runs the search.
function getSecurityIssueSynonyms(): Promise<Record<string, string[]>> {
  if (!securityIssueSynonymsPromise) {
    securityIssueSynonymsPromise = fetchSecurityIssueSynonyms().catch(err => {
      securityIssueSynonymsPromise = null;
      throw err;
    });
  }

  return securityIssueSynonymsPromise;
}

var jiraSecurityStatusCache: Record<string, Record<string, JiraSecurityStatus>> = {};

function getJiraSecurityStatusCacheKey(tokens: string[]): string {
  return tokens.slice().sort().join(',');
}

async function getCachedJiraSecurityStatusRecord(tokens: string[]): Promise<Record<string, JiraSecurityStatus>> {
  var key = getJiraSecurityStatusCacheKey(tokens);

  if (key in jiraSecurityStatusCache) {
    return jiraSecurityStatusCache[key];
  }

  var record = await getJiraSecurityStatusRecord(tokens);

  // An empty record usually means we couldn't reach Jira (such as not being
  // logged in), so try again next time instead of remembering it.

  if (Object.keys(record).length > 0) {
    jiraSecurityStatusCache[key] = record;
  }

  return record;
}

async function fetchSecurityIssueSynonyms(): Promise<Record<string, string[]>> {
  const url = 'https://s3-us-west-2.amazonaws.com/mdang.grow/security_issue_synonyms.ndjson';
  var res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  if (!res.body) throw new Error(`Missing response body for ${url}`);

  const reader = res.body.getReader();

  if (!reader) {
    return {};
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const dataList = [];
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        dataList.push(JSON.parse(trimmed));
      }
    }
  }
  
  const finalTrimmed = buffer.trim();
  if (finalTrimmed) {
    dataList.push(JSON.parse(finalTrimmed));
  }

  return dataList.reduce((acc, next) => {
    acc[next['key']] = next['value'];
    return acc;
  }, {});
}

interface BulkSearchRequest {
  tokens: string[];
  version: string | null;
}

function getBulkSearchURL(tokens: string[], version: string | null): string {
  var params = new URLSearchParams();
  params.set('tokens', tokens.join(','));

  if (version && parseVersionLevel(version)) {
    params.set('version', version.trim());
  }

  return getFixesTabURL().replace(/#.*$/, '') + '#bulk-search?' + params.toString();
}

function getBulkSearchRequestFromHash(): BulkSearchRequest | null {
  var hash = document.location.hash;

  if (hash.indexOf('#bulk-search?') != 0) {
    return null;
  }

  var params = new URLSearchParams(hash.substring('#bulk-search?'.length));
  var tokens = (params.get('tokens') || '').split(',').map(x => x.trim()).filter(Boolean);

  if (tokens.length == 0) {
    return null;
  }

  return {
    tokens: tokens,
    version: params.get('version'),
  };
}

function generateBulkSearchContentArea(request: BulkSearchRequest | null): HTMLDivElement {
  var projectVersions: Record<string, string> = {};
  var lineVersions: Record<string, string[]> = {};

  var contentArea = document.createElement('div');
  contentArea.id = 'bulk-search-content';
  contentArea.style.display = 'none';
  contentArea.style.padding = '20px';
  contentArea.style.border = '1px solid #ddd';
  contentArea.style.borderRadius = '4px';
  contentArea.style.marginTop = '15px';

  contentArea.innerHTML = `
    <h3>Bulk Search</h3>
    <p>This feature was added to make it easier to see if fixes exist on patcher for various tickets (LPD, LPE, CVE), and which baselines they exist for. However, it's naive; the fix might have been added with other tokens and so even though the fix <em>exists</em>, it might require additional tokens for the build to go through, or you might fight with patcher's greedy merge algorithm all along the way.</p>
    <div style="margin-bottom: 15px;">
      <label for="bulk-tokens-input" style="font-weight: bold; display: block; margin-bottom: 5px;">
        Tickets (comma or newline separated):
      </label>
      <textarea id="bulk-tokens-input" rows="8" style="width: 100%; max-width: 600px; font-family: monospace;" placeholder="List any Jira tickets or any CVEs (experimental) you wish to check"></textarea>
    </div>
    <div style="margin-bottom: 15px; display: flex; gap: 15px; align-items: flex-end;">
      <div>
        <label for="bulk-baseline-prefix" style="font-weight: bold; display: block; margin-bottom: 5px;">
          Check Fix Status:
        </label>
        <select id="bulk-baseline-prefix" style="padding: 4px; border: 1px solid #ccc; border-radius: 4px; min-width: 150px;">
          <option value="">Loading...</option>
        </select>
      </div>
      <div id="bulk-baseline-version-container" style="display: none;">
        <label for="bulk-baseline-version" style="font-weight: bold; display: block; margin-bottom: 5px;">
          Fixed Version:
        </label>
        <select id="bulk-baseline-version" style="padding: 4px; border: 1px solid #ccc; border-radius: 4px; min-width: 150px;">
          <option value="All">All</option>
        </select>
      </div>
    </div>
    <button id="bulk-search-button" class="btn btn-primary">Submit Bulk Search</button>
    <div id="bulk-search-results" style="margin-top: 15px;">
    </div>
  `;

  var tokenListInput = <HTMLTextAreaElement> contentArea.querySelector('#bulk-tokens-input');
  var prefixSelect = <HTMLSelectElement> contentArea.querySelector('#bulk-baseline-prefix');
  const versionContainer = <HTMLDivElement> contentArea.querySelector('#bulk-baseline-version-container');
  const versionSelect = <HTMLSelectElement> contentArea.querySelector('#bulk-baseline-version');
  var bulkSearchButton = <HTMLButtonElement> contentArea.querySelector('#bulk-search-button');
  var bulkSearchResults = <HTMLDivElement> contentArea.querySelector('#bulk-search-results');

  prefixSelect.disabled = true;

  var projectVersionsReady = getProjectVersions().then(loadedProjectVersions => {
    projectVersions = loadedProjectVersions;

    // Group the project versions by release line, leaving out the private
    // branches since they're at the same patch level as the public ones.

    lineVersions = {};

    for (var version of Object.keys(projectVersions)) {
      var line = getVersionLine(version);

      if (line && (version.indexOf('-private') == -1)) {
        lineVersions[line] = lineVersions[line] || [];
        lineVersions[line].push(version.trim());
      }
    }

    const prefixes = Object.keys(lineVersions).sort((a, b) => getLineOrder(b) - getLineOrder(a));

    prefixSelect.innerHTML = '<option value="">All</option>';

    for (const prefix of prefixes) {
      const opt = document.createElement('option');
      opt.value = prefix;
      opt.textContent = prefix;
      prefixSelect.appendChild(opt);
    }

    prefixSelect.disabled = false;

    if (request) {
      tokenListInput.value = request.tokens.join('\n');

      var requestLevel = parseVersionLevel(request.version);

      if (requestLevel && (prefixes.indexOf(requestLevel.line) != -1)) {
        prefixSelect.value = requestLevel.line;
        populateVersionSelect(requestLevel.line);

        var versionOption = lineVersions[requestLevel.line].filter(v => (<VersionLevel> parseVersionLevel(v)).level == (<VersionLevel> requestLevel).level)[0];

        if (versionOption) {
          versionSelect.value = versionOption;
        }
      }

      bulkSearchButton.click();
    }
  });

  function populateVersionSelect(prefix: string) {
    const versions = (lineVersions[prefix] || []).slice().sort(compareProjectVersionNames);

    versionSelect.innerHTML = '<option value="All">All</option>';

    for (const v of versions) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      versionSelect.appendChild(opt);
    }

    versionContainer.style.display = 'block';
  }

  prefixSelect.addEventListener('change', () => {
    const prefix = prefixSelect.value;

    if (prefix) {
      populateVersionSelect(prefix);
    }
    else {
      versionContainer.style.display = 'none';
    }

    if (tokenListInput.value.trim()) {
      bulkSearchButton.click();
    }
  });

  versionSelect.addEventListener('change', () => {
    if (tokenListInput.value.trim()) {
      bulkSearchButton.click();
    }
  });

  bulkSearchButton.addEventListener('click', async (e) => {
    await projectVersionsReady;

    var rawText = tokenListInput.value;

    var tokensSet = new Set(rawText.split(/[\n,]+/).map(t => t.trim()).filter(Boolean));

    var tokensList = Array.from(tokensSet);

    var cveTokensList = tokensList.filter(it => it.indexOf('CVE-') == 0 || it.indexOf('PRISMA-') == 0);

    var cveFixTokensSet: Set<string> = new Set();
    var synonymLookup = await getSecurityIssueSynonyms();

    var isCVE = (it: string) => it.indexOf('CVE-') == 0 || it.indexOf('PRISMA-') == 0;
    var isLPE = (it: string) => it.indexOf('LPE-') == 0;

    var cveToLPELookup = Object.keys(synonymLookup).filter(isCVE).reduce((acc, next) => {
      acc[next] = synonymLookup[next].filter(isLPE);
      return acc;
    }, {} as Record<string, string[]>);

    var lpeToCVELookup = Object.keys(synonymLookup).filter(isLPE).reduce((acc, next) => {
      acc[next] = synonymLookup[next].filter(isCVE);
      return acc;
    }, {} as Record<string, string[]>)

    var nonCVETokensList = tokensList.filter(it => it.indexOf('CVE-') == -1 && it.indexOf('PRISMA-') == -1);

    if (cveTokensList.length > 0) {
        cveFixTokensSet = new Set(cveTokensList.map(it => cveToLPELookup[it] || []).reduce((acc, next) => acc.concat(next), []));

        tokensSet = new Set([...nonCVETokensList, ...cveFixTokensSet]);

        tokensList = Array.from(tokensSet);
    }

    var selectedPrefix = prefixSelect.value;
    var selectedVersion = versionSelect.value;

    // Changing the options re-runs the search, but everything we already
    // fetched is cached, so only show the spinner if we fetch something new.

    var needsJira = !(getJiraSecurityStatusCacheKey(tokensList) in jiraSecurityStatusCache);
    var uncachedCount = tokensList.filter(token => !patcherFixVersionsCache[token]).length + (needsJira ? 2 : 0);

    if (uncachedCount > 0) {
      addSpinner(tokensList.length + (needsJira ? 2 : 0));
    }

    var availableFixVersions = await getAllPatcherFixVersions(tokensList, tokensSet);

    var jiraSecurityStatusRecord: Record<string, JiraSecurityStatus> = {};

    if (needsJira) {
      updateSpinner(1);
    }

    jiraSecurityStatusRecord = await getCachedJiraSecurityStatusRecord(tokensList);

    if (needsJira) {
      updateSpinner(1);
    }

    var getFixStatus = function(jiraStatus: JiraSecurityStatus | null, unknownReason: string | null): BulkSearchFixStatus {
      return {
        prefix: selectedPrefix,
        selectedVersion: selectedPrefix ? selectedVersion : 'All',
        jiraStatus: jiraStatus,
        unknownReason: unknownReason,
      };
    };

    var cveRows = cveTokensList.map(cve => {
      var cveFixes = cveToLPELookup[cve] || [];
      var cveFixVersions = new Set(cveFixes.map(ticket => Array.from(availableFixVersions[ticket]) || []).reduce((acc, next) => acc.concat(next), []));

      var fixStatus = getFixStatus(
        combineSecurityStatuses(cveFixes.map(ticket => jiraSecurityStatusRecord[ticket] || null)),
        cveFixes.length == 0 ? 'no associated LPE tickets found' : null);

      return `
        <tr>
          <td class="bulk-search-ticket"><span class="bulk-search-ticket-name">${cve}</span>${cveFixes.length == 0 ? "" : ("<br/>(" + cveFixes.map(fix => `<span class="bulk-search-ticket-name">${fix}</span>`).join(', ') + ")")}</td>
          <td class="bulk-search-baselines">${getAvailableBaselinesHTML(cveFixes, cveFixVersions, projectVersions, fixStatus)}</td>
        </tr>
      `;
    });

    var nonCVERows = nonCVETokensList.map(ticket => {
      var fixStatus = getFixStatus(jiraSecurityStatusRecord[ticket] || null, null);

      var cves = lpeToCVELookup[ticket] || [];
      var cveSuffix = cves.length === 0 ? "" : `<br/><span style="font-weight: normal; font-size: 0.9em; color: #555;">(${cves.map(cve => `<span class="bulk-search-ticket-name">${cve}</span>`).join(', ')})</span>`;

      return `
      <tr>
        <td class="bulk-search-ticket"><span class="bulk-search-ticket-name">${ticket}</span>${cveSuffix}</td>
        <td class="bulk-search-baselines">${getAvailableBaselinesHTML([ticket], availableFixVersions[ticket], projectVersions, fixStatus)}</td>
      </tr>
    `});

    var baselinesHeader = 'Available on Baselines';

    if (selectedPrefix) {
      baselinesHeader += selectedVersion === 'All' ? ` (checking ${selectedPrefix})` : ` (checking ${selectedVersion})`;
    }

    bulkSearchResults.innerHTML = `
      ${getBulkSearchLegendHTML()}
      <table class="bulk-search-table">
        <thead>
          <tr>
            <th class="bulk-search-ticket">Ticket</th>
            <th class="bulk-search-baselines">${baselinesHeader}</th>
          </tr>
        </thead>
        <tbody>
          ${cveRows.concat(nonCVERows).join('')}
        </tbody>
      </table>
    `;

    removeSpinner();
  });

  contentArea.style.display = 'block';

  return contentArea;
}

function addBulkSearchTab() {
  var navTabs = <HTMLUListElement> document.querySelector('ul.nav.nav-tabs');

  if (!navTabs.parentElement) {
    return;
  }

  var navTabsParent = navTabs.parentElement;

  var bulkTab = document.createElement('li');
  bulkTab.id = 'bulk-search-tab';
  bulkTab.innerHTML = `<a href="#bulk-search">Bulk Search</a>`;
  navTabs.appendChild(bulkTab);

  var activateBulkSearchTab = function(request: BulkSearchRequest | null) {
    var contentArea = generateBulkSearchContentArea(request);

    Array.from(navTabs.children).forEach(li => li.classList.remove('active'));
    bulkTab.classList.add('active');

    Array.from(navTabsParent.children).forEach(child => {
      if (child !== navTabs) {
        navTabsParent.removeChild(child);
      }
    });

    navTabsParent.appendChild(contentArea);
  };

  bulkTab.addEventListener('click', (e) => {
    e.preventDefault();
    activateBulkSearchTab(null);
  });

  var request = getBulkSearchRequestFromHash();

  if (request) {
    activateBulkSearchTab(request);
  }
}