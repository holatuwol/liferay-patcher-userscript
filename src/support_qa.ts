function highlightAnalysisNeededBuilds() : void {
  var activeTab = document.querySelector('.tab.active');

  if (!activeTab) {
    return;
  }

  var tabs = <Array<HTMLAnchorElement>> Array.from(document.querySelectorAll('.tab > a'));

  for (var i = 0; i < tabs.length; i++) {
    if ('QA Builds' == (tabs[i].textContent || '').trim()) {
      tabs[i].href += '&_1_WAR_osbpatcherportlet_delta=200';
    }
  }

  if ('QA Builds' != (activeTab.textContent || '').trim()) {
    return;
  }

  var buildsTable = querySelector('patcherBuildsSearchContainer');

  if (!buildsTable) {
    return;
  }

  var headerRow = buildsTable.querySelectorAll('thead tr th');

  var statusIndex = -1;
  var versionIndex = -1;

  for (var i = 0; i < headerRow.length; i++) {
    if (headerRow[i].id.indexOf('qa-status') != -1) {
      statusIndex = i;
    }

    if (headerRow[i].id.indexOf('project-version') != -1) {
      versionIndex = i;
    }
  }

  var buildsTableBody = <HTMLTableSectionElement> buildsTable.querySelector('tbody');

  var rows = buildsTableBody.querySelectorAll('tr');
  var detachedRows = [];

  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].querySelectorAll('td');
    var status = cells[statusIndex];

    var projectVersion = (cells[versionIndex].textContent || '').trim();
    var versionNumber = projectVersion.indexOf('6.2.10') != -1 ? '6210' : projectVersion.substring(projectVersion.lastIndexOf('-') + 1);

    rows[i].classList.add('version-' + versionNumber);

    if (status.textContent && status.textContent.indexOf('QA Analysis') != -1) {
      rows[i].classList.add('qa-analysis-needed');
    }
    else {
      rows[i].classList.add('qa-analysis-unneeded');
      rows[i].remove();
      detachedRows.push(rows[i])
    }
  }

  for (var i = 0; i < detachedRows.length; i++) {
    buildsTableBody.appendChild(detachedRows[i]);
  }
}
