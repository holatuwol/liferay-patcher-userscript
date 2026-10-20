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

function updateCompactContainer(
  compactContainer: HTMLTableElement,
  controlGroup: Element
) : void {

  var labelElement = <HTMLLabelElement> controlGroup.querySelector('label');
  var label = (labelElement.textContent || '').trim();

  var textarea = controlGroup.querySelector('textarea');
  var ticketCount = 0;

  if (textarea && textarea.value) {
    ticketCount = textarea.value.split(',').length;
  }

  var text = label.substring(0, label.indexOf(' Ticket Suggestions'));

  var tableRow = document.createElement('tr');
  tableRow.setAttribute('data-suggestion-type', text);
  compactContainer.appendChild(tableRow);

  var tableHeader = document.createElement('th');
  tableHeader.textContent = text;
  tableRow.appendChild(tableHeader);

  var tableCell = document.createElement('td');
  tableCell.textContent = ticketCount + ((ticketCount == 1) ? ' ticket' : ' tickets');
  tableRow.appendChild(tableCell);
}

/**
 * Puts the label of each flex form row in a column of its own, and each
 * field of the row on a line of its own. Without this, the selects and
 * the inputs that this script adds next to a field make the row too wide.
 */

function layoutFormRows(): void {
  var rows = document.querySelectorAll('#p_p_id' + ns + ' .control-group');

  for (var i = 0; i < rows.length; i++) {
    var row = <HTMLElement> rows[i];

    if (row.classList.contains('patcher-form-row') || (getComputedStyle(row).display != 'flex')) {
      continue;
    }

    var label = Array.from(row.children).find(function (child) {
      return (child.tagName.toLowerCase() == 'label') || child.classList.contains('control-label');
    });

    if (!label) {
      continue;
    }

    label.classList.add('patcher-form-label');
    row.classList.add('patcher-form-row');
  }
}

function rearrangeColumns() : void {
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

  var accountParentElement = <HTMLElement> accountElement.parentElement;
  var accountGrandParentElement = <HTMLElement> accountParentElement.parentElement;

  var columns = document.querySelectorAll('.column');

  if (columns.length < 2) {
    return;
  }

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

  var controlGroup = getFixesFromPreviousBuilds();

  tableContainer.appendChild(controlGroup);
  updateCompactContainer(compactContainer, controlGroup);

  for (var i = 2; i < columns.length; i++) {
    controlGroups = columns[i].querySelectorAll('.control-group');

    for (var j = 0; j < controlGroups.length; j++) {
      controlGroup = controlGroups[j];

      controlGroup.classList.add('verbose');
      tableContainer.appendChild(controlGroup);

      updateCompactContainer(compactContainer, controlGroup);
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