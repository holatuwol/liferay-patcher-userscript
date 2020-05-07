function renderMissingSecurityFixes() : void {
  var lsvTickets = JSON.parse(this.responseText);

  var projectNode = <HTMLSelectElement> querySelector('patcherProjectVersionId');
  var projectParentElement = <HTMLElement> projectNode.parentElement;
  var tagName = getFixPack().tag;

  var buildNumber = tagName.indexOf('portal-') == 0 ? '6210' : tagName.substring(tagName.lastIndexOf('-') + 1);

  var buildNameNode = <HTMLInputElement> querySelector('patcherBuildName');

  var buildName = buildNameNode.value.split(',');
  var ticketList = new Set(buildName.map(x => x.trim()));
  var missingTicketList = <Array<Array<string>>> [[],[],[],[]];

  var fixPackNumber = 0;

  if (buildNumber == '6210') {
    fixPackNumber = parseInt(tagName.substring('portal-'.length));
  }
  else {
    fixPackNumber = parseInt(tagName.substring(tagName.indexOf('-', 'fix-pack-'.length) + 1, tagName.lastIndexOf('-')));
  }

  for (var ticketName in lsvTickets) {
    if (!ticketList.has(ticketName) && lsvTickets[ticketName][buildNumber] && lsvTickets[ticketName][buildNumber] > fixPackNumber) {
      var lsvNumber = lsvTickets[ticketName]['lsv'];
      var severity = lsvTickets[ticketName]['sev'] || 3;

      var ticketLink = getTicketLink('', ticketName, lsvNumber ? 'LSV-' + lsvNumber : ticketName);
      missingTicketList[severity].push(ticketLink);
    }
  }

  var tableRows = missingTicketList.map((x, i) => (x.length == 0) ? '' : '<tr><th class="nowrap">SEV-' + i + '</th><td>' + x.join(', ') + '</td></tr>');
  var tableRowsHTML = tableRows.join('');

  if (tableRowsHTML.length == 0) {
    return;
  }

  var container = document.createElement('div');
  container.classList.add('control-group', 'input-text-wrapper');

  var label = document.createElement('label');
  label.classList.add('control-label');
  label.textContent = 'Missing Security Fixes';

  container.appendChild(label);

  var tableContainer = document.createElement('span');
  tableContainer.innerHTML = '<table class="table table-bordered table-hover"><tbody class="table-data">' + tableRowsHTML + '</tbody></table>';

  container.appendChild(tableContainer);

  var accountElement = <HTMLElement> querySelector('patcherBuildAccountEntryCode');
  var accountParentElement = <HTMLElement> accountElement.parentElement;
  var accountGrandParentElement = <HTMLElement> accountParentElement.parentElement;
  accountGrandParentElement.insertBefore(container, accountParentElement);
}

function showMissingSecurityFixes() {
  if (document.location.pathname.indexOf('/-/osb_patcher/builds/') == -1) {
    return;
  }

  if (document.location.pathname.indexOf('/-/osb_patcher/builds/create') != -1) {
    return;
  }

  var xhr = new XMLHttpRequest();

  var lsvFixedInURL = 'https://s3-us-west-2.amazonaws.com/mdang.grow/lsv_fixedin.json';

  xhr.open('GET', lsvFixedInURL);
  xhr.onload = renderMissingSecurityFixes.bind(xhr);

  xhr.send(null);
}