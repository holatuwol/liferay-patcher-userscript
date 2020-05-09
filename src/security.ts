function renderMissingSecurityFixes(
  buildNameNode : HTMLElement,
  lsvTickets : any
) : void {
  var fixPack = getFixPack();

  if (!fixPack) {
    return;
  }

  var projectNode = <HTMLSelectElement> querySelector('patcherProjectVersionId');
  var projectParentElement = <HTMLElement> projectNode.parentElement;
  var tagName = fixPack.tag;

  var buildNumber = '';
  var liferayVersion = getLiferayVersion(tagName);

  if (tagName.indexOf('portal-') == 0) {
    buildNumber = '6210';
  }
  else {
    buildNumber = '' + Math.floor(liferayVersion / 1000);
  }

  var buildName = [];

  if (buildNameNode.tagName.toLowerCase() == 'select') {
    buildName = (<HTMLTextAreaElement> buildNameNode).value.split(',');
  }
  else {
    buildName = (<HTMLInputElement> buildNameNode).value.split(',');
  }

  var ticketList = new Set(buildName.map(x => x.trim()));
  var missingTicketList = <Array<Array<string>>> [[],[],[],[]];

  var fixPackNumber = 0;

  if (buildNumber == '6210') {
    fixPackNumber = parseInt(tagName.substring('portal-'.length));
  }
  else {
    fixPackNumber = liferayVersion % 1000;
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

  var container = document.getElementById('missing-security-fixes');

  if (container) {
    container.remove();
  }

  container = document.createElement('div');
  container.setAttribute('id', 'missing-security-fixes');
  container.classList.add('control-group', 'input-text-wrapper');

  var label = document.createElement('label');
  label.classList.add('control-label');
  label.textContent = 'Missing Security Fixes';

  container.appendChild(label);

  var tableContainer = document.createElement('span');

  if (tableRowsHTML.length == 0) {
    tableContainer.innerHTML = 'none';
  }
  else {
    tableContainer.innerHTML = '<table class="table table-bordered table-hover"><tbody class="table-data">' + tableRowsHTML + '</tbody></table>';
  }

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

  var buildNameNode = <HTMLElement> querySelector('patcherBuildName');

  var xhr = new XMLHttpRequest();

  var lsvFixedInURL = 'https://s3-us-west-2.amazonaws.com/mdang.grow/lsv_fixedin.json';

  xhr.open('GET', lsvFixedInURL);
  xhr.onload = function() {
    var lsvTickets = JSON.parse(this.responseText);
    var renderMissingSecurityFixesListener = renderMissingSecurityFixes.bind(xhr, buildNameNode, lsvTickets);

    buildNameNode.addEventListener('blur', renderMissingSecurityFixesListener);

    var projectVersionNode = <HTMLSelectElement> querySelector('patcherProjectVersionId');
    projectVersionNode.addEventListener('change', renderMissingSecurityFixesListener);

    renderMissingSecurityFixesListener();
  }
  xhr.send(null);
}