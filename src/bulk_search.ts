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

  var resultSet = new Set(foundVersions);
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

function compareQuarterlyVersions(a: string | null, b: string | null): number {
  if (!a) return -1;
  const aMatch = a.toLowerCase().match(/(\d{4})\.q([1-4])\.(\d+)/);
  if (!aMatch) return -1;
  const [, aYearStr, aQuarterStr, aPatchStr] = aMatch;

  if (!b) return 1;
  const bMatch = b.toLowerCase().match(/(\d{4})\.q([1-4])\.(\d+)/);
  if (!bMatch) return 1;
  const [, bYearStr, bQuarterStr, bPatchStr] = bMatch;

  if (aYearStr !== bYearStr) {
    return parseInt(aYearStr) - parseInt(bYearStr);
  }

  if (aQuarterStr != bQuarterStr) {
    return parseInt(aQuarterStr) - parseInt(bQuarterStr);
  }

  return parseInt(aPatchStr) - parseInt(bPatchStr);
}

function isFixInPrefix(fixVer: string, prefix: string): boolean {
  const cleanFix = fixVer.toLowerCase().replace(/\s+/g, '');
  const cleanPrefix = prefix.toLowerCase().replace(/\s+/g, '');
  return cleanFix.indexOf(cleanPrefix) !== -1;
}

function getCleanVersionFromFix(fixVer: string | null): string | null {
  if (!fixVer) {
    return null;
  }
  const match = fixVer.toLowerCase().match(/(\d{4})\.q([1-4])\.(\d+)/);
  if (match) {
    return `${match[1]}.q${match[2]}.${match[3]}`;
  }
  return null;
}

async function getJiraFieldsGraph(tokens: string[]): Promise<Record<string, JiraFields>> {
  const fields: Record<string, JiraFields> = {};

  const prefixes = ['LPE', 'LPD', 'LPS', 'LPSA', 'COMMERCE', 'LSV'];
  tokens = tokens.filter(token => prefixes.some(prefix => token.startsWith(prefix)));

  while (tokens.length > 0) {
    const issues = await getJiraIssuesByKey(tokens, ['key', 'issuelinks', 'versions', 'fixVersions', 'customfield_10886', 'customfield_10786', 'priority', 'labels'], [], false);
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

function getProductLine(ver: string): string | null {
  const m = ver.toLowerCase().match(/(\d{4}\.q[1-4])/);
  return m ? m[1] : null;
}

function isApplicableFixVersion(fvName: string, targetVersion: string): boolean {
  const fvLine = getProductLine(fvName);
  const targetLine = getProductLine(targetVersion);
  if (!fvLine || !targetLine) {
    return false;
  }
  return fvLine === targetLine;
}

function hasLabel(issue: JiraFields, labelName: string): boolean {
  if (!issue.labels) {
    return false;
  }
  for (const label of issue.labels) {
    if (typeof label === 'string') {
      if (label === labelName) {
        return true;
      }
    } else if (typeof label === 'object' && label !== null) {
      const name = label.name || label.value;
      if (name === labelName) {
        return true;
      }
    }
  }
  return false;
}

function getLsvSeverityGroup(lsvKeys: Set<string>, jiraFieldsGraph: Record<string, JiraFields>): string | null {
  const sortedKeys = Array.from(lsvKeys).sort();

  // 1. Check customfield_10786 (Severity) first across all linked LSVs
  for (const lk of sortedKeys) {
    const lsvIssue = jiraFieldsGraph[lk];
    if (lsvIssue) {
      const cfSev = lsvIssue.customfield_10786;
      if (cfSev) {
        let val: string | undefined;
        if (Array.isArray(cfSev)) {
          if (cfSev.length > 0) {
            val = cfSev[0].value;
          }
        } else if (cfSev && typeof cfSev === 'object') {
          val = cfSev.value;
        }
        if (val) {
          if (val === 'Critical') {
            return 'sev-1';
          } else if (val === 'High') {
            return 'sev-2';
          } else {
            return 'sev-3'; // Medium, Low, etc.
          }
        }
      }
    }
  }

  // 2. Fall back to priority if severity is null/empty on all linked LSVs
  for (const lk of sortedKeys) {
    const lsvIssue = jiraFieldsGraph[lk];
    if (lsvIssue) {
      const prio = lsvIssue.priority;
      if (prio) {
        let val: string | undefined;
        if (Array.isArray(prio)) {
          if (prio.length > 0) {
            val = prio[0].name;
          }
        } else if (prio && typeof prio === 'object') {
          val = prio.name;
        }
        if (val) {
          if (val === 'Critical') {
            return 'sev-1';
          } else if (val === 'High') {
            return 'sev-2';
          } else {
            return 'sev-3'; // all others = sev-3
          }
        }
      }
    }
  }

  return null;
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
      // Use compareQuarterlyVersions to resolve each affected version from lsvAffectsMap 
      // to the closest fix version chronologically after it from stdFixVersionsMap,
      // restricted to the correct product/quarterly line via isApplicableFixVersion.
      for (const [ver, source] of lsvAffectsMap.entries()) {
        const candidates = Array.from(stdFixVersionsMap.keys())
          .filter(candidate => isApplicableFixVersion(candidate, ver) && compareQuarterlyVersions(candidate, ver) > 0);

        if (candidates.length > 0) {
          candidates.sort(compareQuarterlyVersions);
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
      fixVersions.push(`${ver} (${source})`);
    }

    // Determine the severity group
    let group: string | null = null;
    if (hasLabel(issue, 'sev-1')) {
      group = 'sev-1';
    } else if (hasLabel(issue, 'sev-2')) {
      group = 'sev-2';
    } else if (hasLabel(issue, 'sev-3')) {
      group = 'sev-3';
    }

    if (!group) {
      if (lsvKeys.size > 0) {
        group = getLsvSeverityGroup(lsvKeys, jiraFieldsGraph);
      }
      if (!group) {
        group = 'unknown';
      }
    }

    record[key] = {
      severity: group,
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

function isFixed(targetVersion: string | null, prefix: string, selectedVersion: string): boolean {
  if (!targetVersion) {
    return false;
  }
  if (selectedVersion === 'All') {
    return targetVersion.startsWith(prefix);
  }
  return compareQuarterlyVersions(selectedVersion, targetVersion) >= 0;
}

function getTicketSecurityStatus(
  ticket: string,
  prefix: string,
  selectedVersion: string,
  jiraStatus: JiraSecurityStatus | null
): string {
  if (!jiraStatus) {
    return `<span class="bulk-search-status-na">N/A</span>`;
  }

  const severity = jiraStatus.severity;
  const allTargets = jiraStatus.fixVersions;

  if (allTargets.length === 0) {
    return `<span class="bulk-search-status-not-fixed">Not Fixed</span>, Severity: ${severity}, Target: TBD`;
  }

  // Filter targets belonging to our baseline prefix
  const prefixTargets = allTargets.filter(t => isFixInPrefix(t, prefix));

  if (prefixTargets.length > 0) {
    // Check the latest target within the same baseline
    const parsedPrefixTargets = prefixTargets
      .map(t => ({ original: t, clean: getCleanVersionFromFix(t) }))
      .filter(item => item.clean !== null) as { original: string; clean: string }[];

    if (parsedPrefixTargets.length > 0) {
      parsedPrefixTargets.sort((a, b) => compareQuarterlyVersions(a.clean, b.clean));
      const latestPrefixTarget = parsedPrefixTargets[parsedPrefixTargets.length - 1];
      const canonicalBranchFix = latestPrefixTarget.clean;

      if (isFixed(canonicalBranchFix, prefix, selectedVersion)) {
        if (selectedVersion === 'All') {
          return `<span class="bulk-search-status-fixed">Fixed</span> in ${latestPrefixTarget.original}`;
        } else {
          return `<span class="bulk-search-status-fixed">Fixed</span> since ${latestPrefixTarget.original}`;
        }
      } else {
        return `<span class="bulk-search-status-not-fixed">Not Fixed</span>, Severity: ${severity}, Target: ${latestPrefixTarget.original}`;
      }
    }
  }

  // If none exist on prefix (or could not parse), point to the latest future baseline
  const parsedFutureTargets = allTargets
    .map(t => ({ original: t, clean: getCleanVersionFromFix(t) }))
    .filter(item => item.clean !== null) as { original: string; clean: string }[];

  if (parsedFutureTargets.length > 0) {
    parsedFutureTargets.sort((a, b) => compareQuarterlyVersions(a.clean, b.clean));
    const latestFutureTarget = parsedFutureTargets[parsedFutureTargets.length - 1];
    return `<span class="bulk-search-status-not-fixed">Not Fixed</span>, Severity: ${severity}, Target: ${latestFutureTarget.original}`;
  }

  return `<span class="bulk-search-status-not-fixed">Not Fixed</span>, Severity: ${severity}, Target: ${allTargets.join(', ')}`;
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
          Check Fix Status (Optional):
        </label>
        <select id="bulk-baseline-prefix" style="padding: 4px; border: 1px solid #ccc; border-radius: 4px; min-width: 150px;">
          <option value="">None</option>
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

  const quarterlyVersions = Object.keys(projectVersions)
    .map(v => v.trim())
    .filter(v => getCleanVersionFromFix(v) !== null)
    .sort(compareQuarterlyVersions);

  const prefixes = Array.from(new Set(quarterlyVersions.map(v => {
    const match = v.toLowerCase().match(/(\d{4})\.q([1-4])/);
    return match ? `${match[1]}.q${match[2]}` : '';
  }).filter(Boolean)))
    .sort((a, b) => compareQuarterlyVersions(b + '.0', a + '.0'));

  for (const prefix of prefixes) {
    const opt = document.createElement('option');
    opt.value = prefix;
    opt.textContent = prefix;
    prefixSelect.appendChild(opt);
  }

  prefixSelect.addEventListener('change', () => {
    const prefix = prefixSelect.value;
    if (!prefix) {
      versionContainer.style.display = 'none';
      if (tokenListInput.value.trim()) {
        bulkSearchButton.click();
      }
      return;
    }

    const versions = quarterlyVersions
      .filter(v => v.toLowerCase().startsWith(prefix.toLowerCase() + '.'))
      .sort(compareQuarterlyVersions);

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
    var synonymLookup = await fetchSecurityIssueSynonyms();

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
    var showSecurity = !!selectedPrefix;

    addSpinner(tokensList.length + (showSecurity ? 2 : 0));

    var availableFixVersions = await getAllPatcherFixVersions(tokensList, tokensSet);

    var jiraSecurityStatusRecord: Record<string, JiraSecurityStatus> = {};

    if (showSecurity) {
      updateSpinner(1);
      jiraSecurityStatusRecord = await getJiraSecurityStatusRecord(tokensList);
      updateSpinner(1);
    }

    var cveRows = cveTokensList.map(cve => {
      var cveFixes = cveToLPELookup[cve] || [];
      var cveFixVersions = new Set(cveFixes.map(ticket => Array.from(availableFixVersions[ticket]) || []).reduce((acc, next) => acc.concat(next), []));

      var securityCell = '';
      if (showSecurity) {
        var securityStatus = '';
        if (cveFixes.length === 0) {
          securityStatus = `<span style="color: #777;">No associated LPEs found</span>`;
        } else {
          securityStatus = cveFixes.map(ticket => {
            var status = getTicketSecurityStatus(ticket, selectedPrefix, selectedVersion, jiraSecurityStatusRecord[ticket] || null);
            return `<div><strong>${ticket}:</strong> ${status}</div>`;
          }).join('');
        }
        securityCell = `<td class="bulk-search-fix-status">${securityStatus}</td>`;
      }

      return `
        <tr>
          <td class="bulk-search-ticket"><span class="bulk-search-ticket-name">${cve}</span>${cveFixes.length == 0 ? "" : ("<br/>(" + cveFixes.map(fix => `<span class="bulk-search-ticket-name">${fix}</span>`).join(', ') + ")")}</td>
          <td class="bulk-search-baselines">${Array.from(cveFixVersions).sort((a, b) => getLiferayVersion(a) - getLiferayVersion(b)).map(version => getPatcherPortalFixSearchLink(cveFixes, version, projectVersions)).join(', ')}</td>
          ${securityCell}
        </tr>
      `;
    });

    var nonCVERows = nonCVETokensList.map(ticket => {
      var securityCell = '';
      if (showSecurity) {
        var status = getTicketSecurityStatus(ticket, selectedPrefix, selectedVersion, jiraSecurityStatusRecord[ticket] || null);
        securityCell = `<td class="bulk-search-fix-status">${status}</td>`;
      }

      var cves = lpeToCVELookup[ticket] || [];
      var cveSuffix = cves.length === 0 ? "" : `<br/><span style="font-weight: normal; font-size: 0.9em; color: #555;">(${cves.map(cve => `<span class="bulk-search-ticket-name">${cve}</span>`).join(', ')})</span>`;

      return `
      <tr>
        <td class="bulk-search-ticket"><span class="bulk-search-ticket-name">${ticket}</span>${cveSuffix}</td>
        <td class="bulk-search-baselines">${Array.from(availableFixVersions[ticket]).sort((a, b) => getLiferayVersion(a) - getLiferayVersion(b)).map(version => getPatcherPortalFixSearchLink([ticket], version, projectVersions)).join(', ')}</td>
        ${securityCell}
      </tr>
    `});

    var fixStatusHeader = selectedVersion === 'All' ? `Fix Status (${selectedPrefix})` : `Fix Status (${selectedVersion})`;

    bulkSearchResults.innerHTML = `
      <table class="bulk-search-table">
        <thead>
          <tr>
            <th class="bulk-search-ticket">Ticket</th>
            <th class="bulk-search-baselines">Available on Baselines</th>
            ${showSecurity ? `<th class="bulk-search-fix-status">${fixStatusHeader}</th>` : ''}
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