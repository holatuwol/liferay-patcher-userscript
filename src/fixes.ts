/**
 * Replaces the list of fixes with a list of JIRA links.
 */

function replaceFixes() : void {
  var oldNode = <HTMLInputElement | null> querySelector('patcherFixName');

  if (!oldNode || !oldNode.readOnly) {
    return;
  }

  replaceNode(oldNode, oldNode.innerHTML.split(',').map(getTicketLink.bind(null, '')).join(', '));
}

function rearrangeColumns() : void {
  if (document.location.pathname.indexOf('/-/osb_patcher/builds/') == -1) {
    return;
  }

  document.querySelectorAll

  var accountElement = querySelector('patcherBuildAccountEntryCode');
  if (!accountElement) {
    var labelElement = <HTMLLabelElement> document.querySelector('label[for="' + ns + 'account-code"]');
    accountElement = <HTMLElement | null> labelElement.nextSibling;
  }

  if (!accountElement) {
    return;
  }

  var accountParentElement = <HTMLElement> accountElement.parentElement;
  var accountGrandParentElement = <HTMLElement> accountParentElement.parentElement;

  var columns = document.querySelectorAll('.column');

  var controlGroups = columns[1].querySelectorAll('.control-group');

  for (var j = 0; j < controlGroups.length; j++) {
    accountGrandParentElement.insertBefore(controlGroups[j], accountParentElement);
  }

  var tableContainer = document.createElement('span');
  tableContainer.setAttribute('id', 'ticket-suggestions');
  tableContainer.classList.add('compact');

  var compactContainer = document.createElement('table');
  compactContainer.classList.add('compact', 'table', 'table-bordered', 'table-hover');

  tableContainer.appendChild(compactContainer);

  for (var i = 2; i < columns.length; i++) {
    controlGroups = columns[i].querySelectorAll('.control-group');

    for (var j = 0; j < controlGroups.length; j++) {
      var controlGroup = controlGroups[j];

      controlGroup.classList.add('verbose');
      tableContainer.appendChild(controlGroup);

      var labelElement = <HTMLLabelElement> controlGroup.querySelector('label');
      var label = (labelElement.textContent || '').trim();

      var textarea = <HTMLTextAreaElement> controlGroup.querySelector('textarea');
      var ticketCount = 0;

      if (textarea.value) {
        ticketCount = textarea.value.split(',').length;
      }

      var tableRow = document.createElement('tr');
      compactContainer.appendChild(tableRow);

      var tableHeader = document.createElement('th');
      tableHeader.textContent = label.substring(0, label.indexOf(' Ticket Suggestions'));
      tableRow.appendChild(tableHeader);

      var tableCell = document.createElement('td');
      tableCell.textContent = ticketCount + ((ticketCount == 1) ? ' ticket' : ' tickets');
      tableRow.appendChild(tableCell);
    }
  }

  for (var i = 2; i < columns.length; i++) {
    columns[i].remove();
  }

  var container = <HTMLElement> document.createElement('div');
  container.classList.add('control-group', 'input-text-wrapper');

  var labelElement = document.createElement('label');
  labelElement.classList.add('control-label');
  labelElement.textContent = 'Ticket Suggestions';

  container.appendChild(labelElement);
  container.appendChild(tableContainer);

  var showDetails = document.createElement('div');
  showDetails.classList.add('show-details');

  tableContainer.appendChild(showDetails);

  var showLink = document.createElement('a');
  showLink.textContent = '(show details)';
  showLink.classList.add('compact');

  showLink.onclick = function() {
    var cl = tableContainer.classList;
    cl.remove('compact');
    cl.add('verbose');
    return false;
  }

  showDetails.appendChild(showLink);

  var hideLink = document.createElement('a');
  hideLink.textContent = '(hide details)';
  hideLink.classList.add('verbose');

  hideLink.onclick = function() {
    var cl = tableContainer.classList;
    cl.add('compact');
    cl.remove('verbose');
    return false;
  }

  showDetails.appendChild(hideLink);

  accountGrandParentElement.insertBefore(container, accountParentElement);
}