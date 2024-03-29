function getMissingTicketList(
  lsvTickets : any
) : Array<Array<string>> {

  var fixPack = getFixPack();

  if (!fixPack) {
    return [[],[],[],[]];
  }

  var tagName = ((fixPack.name.indexOf('portal-') == 0) || (fixPack.name.indexOf('fix-pack-base-6210') == 0)) ? fixPack.name : fixPack.tag;
  var liferayVersion = getLiferayVersion(tagName);

  var buildNumber = '';

  if (tagName.indexOf('portal-') == 0) {
    buildNumber = '6210';
  }
  else {
    buildNumber = '' + Math.floor(liferayVersion / 1000);
  }

  var buildNameNode = <HTMLElement> querySelector('patcherBuildName');
  buildNameNode.removeAttribute('style');

  var buildName = [];

  if (buildNameNode.tagName.toLowerCase() == 'select') {
    buildName = (<HTMLTextAreaElement> buildNameNode).value.split(',');
  }
  else {
    buildName = (<HTMLInputElement> buildNameNode).value.split(',');
  }

  var ticketList = new Set(buildName.map(x => x.trim()));
  var missingTicketList = <Array<Array<string>>> [[],[],[],[],[]];

  var fixPackNumber = 0;

  if (buildNumber == '6210') {
    fixPackNumber = (tagName.indexOf('portal-') == 0) ? parseInt(tagName.substring('portal-'.length)) : 0;
  }
  else {
    fixPackNumber = liferayVersion % 1000;
  }

  for (var ticketName in lsvTickets) {
    if (!ticketList.has(ticketName) && lsvTickets[ticketName][buildNumber] && lsvTickets[ticketName][buildNumber] > fixPackNumber) {
      var severity = lsvTickets[ticketName]['sev'] || 4;
      missingTicketList[severity].push(ticketName);
    }
  }

  return missingTicketList;
}

function getMissingTicketTableRow(
  lsvTickets : any,
  missingTickets : Array<string>,
  severity: number
) : string {

  if (severity == 0) {
    return '';
  }

  var lsvList = [
    '<tr><th class="nowrap">', severity == 4 ? 'other' : 'SEV-' + severity, '</th><td>'
  ];

  if ((severity != 3) && (missingTickets.length == 0)) {
    return '';
  }

  if ((severity == 1) || (severity == 2)) {
    lsvList.push('<span class="compact">');
    lsvList.push(missingTickets.map(x => getTicketLink('', x, x)).join(', '));
    lsvList.push('</span>');

    lsvList.push(
      '<div class="verbose" contenteditable onfocus="',
      'var selection = window.getSelection();',
      'var range = document.createRange();',
      'range.selectNodeContents(this);',
      'selection.removeAllRanges();',
      'selection.addRange(range);',
      '"><dl>');

    missingTickets
      .filter(function(ticketName) {
        return 'lsv' in lsvTickets[ticketName] && 'hc' in lsvTickets[ticketName]
      })
      .sort(function(ticketName1, ticketName2) {
        var ticket1 = lsvTickets[ticketName1];
        var ticket2 = lsvTickets[ticketName2];

        if (ticket1['lsv'] != ticket2['lsv']) {
          return ticket1['lsv'] - ticket2['lsv'];
        }

        return ticketName1 < ticketName2 ? -1 : 1;
      })
      .reduce(function(accumulator, ticketName, index) {
        var lsvNumber = lsvTickets[ticketName]['lsv'];
        var helpCenterNumber = lsvTickets[ticketName]['hc'];

        if ((index > 0) && (lsvNumber == accumulator[accumulator.length - 10])) {
          accumulator[accumulator.length - 8] += ', ' + ticketName;
        }
        else {
          accumulator.push(
            '<dt>', 'LSV-', lsvNumber, ' / ', ticketName, '</dt><dd>',
            '<a href="https://help.liferay.com/hc/articles/', helpCenterNumber,
            '">https://help.liferay.com/hc/articles/', helpCenterNumber, '</a>', '</dd>');
        }

        return accumulator;
      }, lsvList);

    lsvList.push('</dl></div>');
  }
  else {
    lsvList.push(
      '<span class="compact">', '' + missingTickets.length,
      missingTickets.length == 1 ? ' ticket' : ' tickets',
      '</span><span class="verbose">',
      missingTickets.length == 0 ? 'none' : missingTickets.map(x => getTicketLink('', x, x)).join(', '),
      '</span>');
  }

  lsvList.push('</td></tr>');

  return lsvList.join('');
}

function updateMissingTicketTable(
  lsvTickets : any
) : void {

  var tableContainer = <HTMLElement> document.getElementById('security-fixes');

  var missingTicketList = getMissingTicketList(lsvTickets);

  var tableRows = missingTicketList.map(getMissingTicketTableRow.bind(null, lsvTickets));
  var tableRowsHTML = tableRows.join('');

  tableContainer.innerHTML = [
    '<table class="table table-bordered table-hover">',
    '<tbody class="table-data">', tableRowsHTML, '</tbody>',
    '<tfoot><tr><td class="show-details" colspan=2>',
    '<a class="compact" href="#" onclick="var cl=this.closest(\'#security-fixes\').classList;',
    'cl.remove(\'compact\');cl.add(\'verbose\');return false;">(show details)</a>',
    '<a class="verbose" href="#" onclick="var cl=this.closest(\'#security-fixes\').classList;',
    'cl.add(\'compact\');cl.remove(\'verbose\');return false;">(hide details)</a>',
    '</td></tr></tfoot></table>'
  ].join('');
}

function renderSecurityFixesSection() : void {
  var buildNameNode = <HTMLElement> querySelector('patcherBuildName');

  var xhr = new XMLHttpRequest();

  var lsvFixedInURL = 'https://s3-us-west-2.amazonaws.com/mdang.grow/lsv_fixedin.json';

  xhr.open('GET', lsvFixedInURL);

  xhr.onload = function() {
    var lsvTickets = JSON.parse(this.responseText);
    var updateMissingTicketTableListener = updateMissingTicketTable.bind(null, lsvTickets);

    buildNameNode.addEventListener('blur', updateMissingTicketTableListener);

    var projectVersionNode = <HTMLSelectElement> querySelector('patcherProjectVersionId');
    projectVersionNode.addEventListener('change', updateMissingTicketTableListener);

    updateMissingTicketTableListener();
  }

  xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, max-age=0');
  xhr.setRequestHeader('Pragma', 'no-cache');

  xhr.send(null);
}

function addSecurityFixesSection() : void {
  if (document.location.pathname.indexOf('/-/osb_patcher/builds/') == -1) {
    return;
  }

  var accountElement = querySelector('patcherBuildAccountEntryCode');
  if (!accountElement) {
    var labelElement = <HTMLLabelElement> document.querySelector('label[for="' + ns + 'account-code"]');
    accountElement = <HTMLElement | null> labelElement.nextSibling;
  }

  if (!accountElement) {
    return;
  }

  var container = <HTMLElement> document.createElement('div');
  container.classList.add('control-group', 'input-text-wrapper');

  var labelElement = document.createElement('label');
  labelElement.classList.add('control-label');
  labelElement.textContent = 'Missing Security Fixes';

  container.appendChild(labelElement);

  var tableContainer = document.createElement('span');
  tableContainer.setAttribute('id', 'security-fixes');
  tableContainer.classList.add('compact');

  container.appendChild(tableContainer);

  var accountParentElement = <HTMLElement> accountElement.parentElement;
  var accountGrandParentElement = <HTMLElement> accountParentElement.parentElement;
  accountGrandParentElement.insertBefore(container, accountParentElement);

  renderSecurityFixesSection();
}