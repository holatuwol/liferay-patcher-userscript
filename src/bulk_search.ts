// Extract project version text directly from the select options
function getProjectVersionsFromDOM(): Record<string, string> {
  var projectVersionIdFilter = <HTMLSelectElement | null> document.getElementById('_1_WAR_osbpatcherportlet_patcherProjectVersionIdFilter');
  
  if (!projectVersionIdFilter) {
    return {};
  }

  return Array.from(projectVersionIdFilter.options)
    .filter(opt => opt.text && opt.text.indexOf('.q') != -1)
    .reduce((acc, next) => {
        acc[next.text] = next.value;
        return acc;
    }, <Record<string, string>> {});
}

async function getPatcherFixVersions(token: string, tokensSet: Set<string>): Promise<{token: string, foundVersions: Set<string>}> {
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
  
  return {
    token,
    foundVersions: new Set(foundVersions),
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
    <button id="bulk-search-button" class="btn btn-primary">Submit Bulk Search</button>
    <div id="bulk-search-results" style="margin-top: 15px;">
    </div>
  `;

  var tokenListInput = <HTMLTextAreaElement> contentArea.querySelector('#bulk-tokens-input');
  var bulkSearchButton = <HTMLButtonElement> contentArea.querySelector('#bulk-search-button');
  var bulkSearchResults = <HTMLDivElement> contentArea.querySelector('#bulk-search-results');

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

    var cveRows = cveTokensList.map(cve => {
      var cveFixes = cveToLPELookup[cve] || [];
      var cveFixVersions = new Set(cveFixes.map(ticket => Array.from(availableFixVersions[ticket]) || []).reduce((acc, next) => acc.concat(next), []));

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; white-space: nowrap;">${cve}${cveFixes.length == 0 ? "" : ("<br/>(" + cveFixes.join(', ') + ")")}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${Array.from(cveFixVersions).sort((a, b) => getLiferayVersion(a) - getLiferayVersion(b)).join(', ')}</td>
        </tr>
      `;
    });

    var nonCVERows = nonCVETokensList.map(ticket => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${ticket}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${Array.from(availableFixVersions[ticket]).sort((a, b) => getLiferayVersion(a) - getLiferayVersion(b)).join(', ')}</td>
      </tr>
    `);

    bulkSearchResults.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f2f2f2; text-align: left;">
            <th style="padding: 8px; border: 1px solid #ddd;">Ticket</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Available on Baselines</th>
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