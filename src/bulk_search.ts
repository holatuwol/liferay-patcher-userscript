// Extract project version text directly from the select options
function getProjectVersionsFromDOM(): Record<string, string> {
  var projectVersionIdFilter = <HTMLSelectElement | null> document.getElementById('_1_WAR_osbpatcherportlet_patcherProjectVersionIdFilter');
  
  if (!projectVersionIdFilter) {
    return {};
  }

  return Array.from(projectVersionIdFilter.options)
    .filter(opt => opt.text)
    .reduce((acc, next) => {
        acc[next.text.trim()] = next.value;
        return acc;
    }, <Record<string, string>> {});
}

var patcherFixVersionsCache: Record<string, Set<string>> = {};

async function getPatcherFixVersions(token: string, tokensSet: Set<string>): Promise<{token: string, foundVersions: Set<string>}> {
  if (patcherFixVersionsCache[token]) {
    updateSpinner(1);
    return {
      token,
      foundVersions: patcherFixVersionsCache[token],
    };
  }

  var params = new URLSearchParams();
  params.append('p_p_id', portletId);
  params.append('p_p_state', 'exclusive');
  params.append(ns + 'advancedSearch', 'true');
  params.append(ns + 'andOperator', 'true');
  params.append(ns + 'patcherFixName', token);
  params.append(ns + 'statusFilter', '100');
  params.append(ns + 'delta', '200');

  var parser = new DOMParser();
  var hasMorePages = true;
  var foundVersions: string[] = [];

  for (var page = 1; hasMorePages; page++) {
    params.set(ns + 'cur', String(page));

    var response = await fetch('/group/guest/patching?' + params.toString());

    var responseDocument = parser.parseFromString(await response.text(), 'text/html');

    var newFoundVersions = Array.from(responseDocument.querySelectorAll('#' + ns + 'patcherFixsSearchContainerSearchContainer table tbody tr'))
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
    
    Array.prototype.push.apply(foundVersions, newFoundVersions);
    
    hasMorePages = !!responseDocument.querySelector('#' + ns + 'patcherFixsSearchContainerPageIteratorBottom ul.lfr-pagination-buttons li.last:not(.disabled)');
  }

  updateSpinner(1);
  
  var resultSet = new Set(foundVersions);
  patcherFixVersionsCache[token] = resultSet;

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

function getTargetVersions(selectedVersion: string, allVersions: Record<string, string>): string[] {
  if (!selectedVersion) return [];

  var match = selectedVersion.match(/^([0-9]+\.q[1-4]\.)(\d+)$/);
  if (!match) return [selectedVersion];

  var [, prefix, startNumStr] = match;
  var startNum = parseInt(startNumStr);

  return Object.keys(allVersions)
    .filter(x => x.indexOf(prefix) == 0)
    .map(v => {
      var patchVersion = parseInt(v.substring(prefix.length + 1));
      return { full: v, patch: patchVersion };
    })
    .filter(v => v.patch >= startNum)
    .sort((a, b) => a.patch - b.patch)
    .map(v => v.full);
}

function getPatcherPortalFixSearchLink(tokens: string[], version: string, projectVersions: Record<string, string>): string {
  if (!(version in projectVersions)) {
    return version;
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

  return `<a href="/group/guest/patching?${params.toString()}" target="_blank">${version}</a>`;
}

var securityFixVersions: Record<string, Record<string, Record<string, string[]>>> | null = null;

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.');
  const bParts = b.split('.');
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aStr = aParts[i] || '';
    const bStr = bParts[i] || '';
    const aNum = parseInt(aStr, 10);
    const bNum = parseInt(bStr, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      if (aStr !== bStr) {
        return aStr < bStr ? -1 : 1;
      }
    }
  }
  return 0;
}

function isFixInPrefix(fixVer: string, prefix: string): boolean {
  const cleanFix = fixVer.toLowerCase().replace(/\s+/g, '');
  const cleanPrefix = prefix.toLowerCase().replace(/\s+/g, '');
  return cleanFix.indexOf(cleanPrefix) !== -1;
}

async function getSecurityFixVersions(): Promise<Record<string, Record<string, Record<string, string[]>>>> {
  if (securityFixVersions) {
    return securityFixVersions;
  }
  var response = await fetch('https://s3-us-west-2.amazonaws.com/mdang.grow/security_issue_fix_versions.json');
  securityFixVersions = await response.json();
  return securityFixVersions!;
}

function getCleanVersionFromFix(fixVer: string): string | null {
  const match = fixVer.toLowerCase().match(/(\d{4})\.q([1-4])\.(\d+)/);
  if (match) {
    return `${match[1]}.q${match[2]}.${match[3]}`;
  }
  return null;
}

function getTicketSecurityStatus(
  ticket: string,
  prefix: string,
  selectedVersion: string,
  data: Record<string, Record<string, Record<string, string[]>>>
): string {
  const prefixVersions = Object.keys(data)
    .filter(v => v.indexOf(prefix + '.') === 0)
    .sort(compareVersions);

  if (prefixVersions.length === 0) {
    return `<span style="color: #777;">N/A (No data for baseline prefix)</span>`;
  }

  // 1. Gather all targets and severity for this ticket across this prefix
  const allTargets: string[] = [];
  let severity = 'unknown';

  for (const v of prefixVersions) {
    const versionObj = data[v];
    for (const cat of ['sev-1', 'sev-2', 'sev-3', 'unknown']) {
      if (versionObj[cat] && versionObj[cat][ticket]) {
        severity = cat;
        const fixes = versionObj[cat][ticket] || [];
        for (const f of fixes) {
          if (allTargets.indexOf(f) === -1) {
            allTargets.push(f);
          }
        }
        break;
      }
    }
  }

  if (allTargets.length === 0) {
    return `<span style="color: #777;">N/A (Not security-relevant or not listed)</span>`;
  }

  // Filter targets belonging to our baseline prefix
  const prefixTargets = allTargets.filter(t => isFixInPrefix(t, prefix));

  if (prefixTargets.length > 0) {
    // Check the latest target within the same baseline
    const parsedPrefixTargets = prefixTargets
      .map(t => ({ original: t, clean: getCleanVersionFromFix(t) }))
      .filter(item => item.clean !== null) as { original: string; clean: string }[];

    if (parsedPrefixTargets.length > 0) {
      parsedPrefixTargets.sort((a, b) => compareVersions(a.clean, b.clean));
      const latestPrefixTarget = parsedPrefixTargets[parsedPrefixTargets.length - 1];
      const canonicalBranchFix = latestPrefixTarget.clean;
      const originalTargetName = latestPrefixTarget.original;

      if (selectedVersion === 'All') {
        return `<span style="color: #0056b3; font-weight: bold;">Fixed</span> (in ${originalTargetName})`;
      } else {
        if (compareVersions(selectedVersion, canonicalBranchFix) < 0) {
          return `<span style="color: #d35400; font-weight: bold;">Not Fixed</span> (Severity: ${severity}, Target: ${originalTargetName})`;
        } else {
          return `<span style="color: #0056b3; font-weight: bold;">Fixed</span> (since ${originalTargetName})`;
        }
      }
    }
  }

  // If none exist on prefix (or could not parse), point to the latest future baseline
  const parsedFutureTargets = allTargets
    .map(t => ({ original: t, clean: getCleanVersionFromFix(t) }))
    .filter(item => item.clean !== null) as { original: string; clean: string }[];

  if (parsedFutureTargets.length > 0) {
    parsedFutureTargets.sort((a, b) => compareVersions(a.clean, b.clean));
    const latestFutureTarget = parsedFutureTargets[parsedFutureTargets.length - 1];
    return `<span style="color: #d35400; font-weight: bold;">Not Fixed</span> (Severity: ${severity}, Target: ${latestFutureTarget.original})`;
  }

  return `<span style="color: #d35400; font-weight: bold;">Not Fixed</span> (Severity: ${severity}, Target: ${allTargets.join(', ')})`;
}

function generateBulkSearchContentArea(): HTMLDivElement {
  var projectVersions = getProjectVersionsFromDOM();

  var contentArea = document.createElement('div');
  contentArea.id = 'bulk-search-content';
  contentArea.style.display = 'none';
  contentArea.style.padding = '20px';
  contentArea.style.border = '1px solid #ddd';
  contentArea.style.borderRadius = '4px';
  contentArea.style.marginTop = '15px';

  contentArea.innerHTML = `
    <h3>Bulk Search</h3>
    <p>This feature was added to make it easier to see if fixes exist on patcher for various tickets (LPD, LPE, CVEs), and which baselines they exist for. However, it's naive; the fix might have been added with other tokens and so even though the fix <em>exists</em>, it might require additional tokens for the build to go through, or you might fight with patcher's greedy merge algorithm all along the way.</p>
    <div style="margin-bottom: 15px;">
      <label for="bulk-tokens-input" style="font-weight: bold; display: block; margin-bottom: 5px;">
        Tickets (comma or newline separated):
      </label>
      <textarea id="bulk-tokens-input" rows="8" style="width: 100%; max-width: 600px; font-family: monospace;" placeholder="List any Jira tickets or any CVEs (experimental) you wish to check"></textarea>
    </div>
    <div style="margin-bottom: 15px; display: flex; gap: 15px; align-items: flex-end;">
      <div>
        <label for="bulk-baseline-prefix" style="font-weight: bold; display: block; margin-bottom: 5px;">
          Security Baseline (Optional):
        </label>
        <select id="bulk-baseline-prefix" style="padding: 4px; border: 1px solid #ccc; border-radius: 4px; min-width: 150px;">
          <option value="">None</option>
        </select>
      </div>
      <div id="bulk-baseline-version-container" style="display: none;">
        <label for="bulk-baseline-version" style="font-weight: bold; display: block; margin-bottom: 5px;">
          Baseline Version:
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

  getSecurityFixVersions().then(data => {
    const prefixes = Array.from(new Set(Object.keys(data).map(k => k.split('.').slice(0, 2).join('.'))))
      .sort((a, b) => compareVersions(b, a));

    for (const prefix of prefixes) {
      const opt = document.createElement('option');
      opt.value = prefix;
      opt.textContent = prefix;
      prefixSelect.appendChild(opt);
    }
  }).catch(err => {
    console.error('Failed to load security fix versions', err);
  });

  prefixSelect.addEventListener('change', async () => {
    const prefix = prefixSelect.value;
    if (!prefix) {
      versionContainer.style.display = 'none';
      if (tokenListInput.value.trim()) {
        bulkSearchButton.click();
      }
      return;
    }

    const data = await getSecurityFixVersions();
    const versions = Object.keys(data)
      .filter(v => v.indexOf(prefix + '.') === 0)
      .sort(compareVersions);

    versionSelect.innerHTML = '<option value="All">All</option>';

    for (const v of versions) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      versionSelect.appendChild(opt);
    }

    versionContainer.style.display = 'block';

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
    var rawText = tokenListInput.value;

    var tokensSet = new Set(rawText.split(/[\n,]+/).map(t => t.trim()).filter(Boolean));

    var tokensList = Array.from(tokensSet);

    var cveTokensList = tokensList.filter(it => it.indexOf('CVE-') == 0 || it.indexOf('PRISMA-') == 0);

    var cveFixTokensSet: Set<string> = new Set();
    var cveToLPELookup: Record<string, string[]> = {};

    var nonCVETokensList = tokensList.filter(it => it.indexOf('CVE-') == -1 && it.indexOf('PRISMA-') == -1);

    if (cveTokensList.length > 0) {
        var cveResponse = await fetch('https://s3-us-west-2.amazonaws.com/mdang.grow/security_issue_cve_lpe.json');

        cveToLPELookup = await cveResponse.json();

        cveFixTokensSet = new Set(cveTokensList.map(it => cveToLPELookup[it]).reduce((acc, next) => acc.concat(next), []));

        tokensSet = new Set([...nonCVETokensList, ...cveFixTokensSet]);

        tokensList = Array.from(tokensSet);
    }

    addSpinner(tokensList.length);

    var availableFixVersions = await getAllPatcherFixVersions(tokensList, tokensSet);

    var selectedPrefix = prefixSelect.value;
    var selectedVersion = versionSelect.value;
    var showSecurity = !!selectedPrefix;

    var securityData: Record<string, Record<string, Record<string, string[]>>> | null = null;
    if (showSecurity) {
      securityData = await getSecurityFixVersions();
    }

    var cveRows = cveTokensList.map(cve => {
      var cveFixes = cveToLPELookup[cve] || [];
      var cveFixVersions = new Set(cveFixes.map(ticket => Array.from(availableFixVersions[ticket]) || []).reduce((acc, next) => acc.concat(next), []));

      var securityCell = '';
      if (showSecurity && securityData) {
        var securityStatus = '';
        if (cveFixes.length === 0) {
          securityStatus = `<span style="color: #777;">No associated LPEs found</span>`;
        } else {
          securityStatus = cveFixes.map(ticket => {
            var status = getTicketSecurityStatus(ticket, selectedPrefix, selectedVersion, securityData!);
            return `<div><strong>${ticket}:</strong> ${status}</div>`;
          }).join('');
        }
        securityCell = `<td style="padding: 8px; border: 1px solid #ddd;">${securityStatus}</td>`;
      }

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; white-space: nowrap;">${cve}${cveFixes.length == 0 ? "" : ("<br/>(" + cveFixes.join(', ') + ")")}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${Array.from(cveFixVersions).sort((a, b) => getLiferayVersion(a) - getLiferayVersion(b)).map(version => getPatcherPortalFixSearchLink(cveFixes, version, projectVersions)).join(', ')}</td>
          ${securityCell}
        </tr>
      `;
    });

    var nonCVERows = nonCVETokensList.map(ticket => {
      var securityCell = '';
      if (showSecurity && securityData) {
        var status = getTicketSecurityStatus(ticket, selectedPrefix, selectedVersion, securityData!);
        securityCell = `<td style="padding: 8px; border: 1px solid #ddd;">${status}</td>`;
      }

      return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${ticket}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${Array.from(availableFixVersions[ticket]).sort((a, b) => getLiferayVersion(a) - getLiferayVersion(b)).map(version => getPatcherPortalFixSearchLink([ticket], version, projectVersions)).join(', ')}</td>
        ${securityCell}
      </tr>
    `});

    var securityHeader = selectedVersion === 'All' ? `Security Status (${selectedPrefix})` : `Security Status (${selectedVersion})`;

    bulkSearchResults.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f2f2f2; text-align: left;">
            <th style="padding: 8px; border: 1px solid #ddd;">Ticket</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Available on Baselines</th>
            ${showSecurity ? `<th style="padding: 8px; border: 1px solid #ddd;">${securityHeader}</th>` : ''}
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

  bulkTab.addEventListener('click', (e) => {
    e.preventDefault();

    var contentArea = generateBulkSearchContentArea();

    Array.from(navTabs.children).forEach(li => li.classList.remove('active'));
    bulkTab.classList.add('active');

    Array.from(navTabsParent.children).forEach(child => {
      if (child !== navTabs) {
        navTabsParent.removeChild(child);
      }
    });

    navTabsParent.appendChild(contentArea); 
  });
}