function getBuildFix(
  accumulator : Map<string, string>,
  row : HTMLTableRowElement
) : Map<string, string> {

  var cells = <HTMLCollectionOf<HTMLTableDataCellElement>> row.cells;

  var fixName = (<string> cells[2].innerText).trim();
  var fixVersion = (<string> cells[3].innerText).trim();

  accumulator.set(fixName, fixVersion);

  return accumulator;
}

function processBuildFixes(
  xhr : XMLHttpRequest
) : void {

  // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
  var container = document.implementation.createHTMLDocument().documentElement;
  container.innerHTML = xhr.responseText;

  var prefixFixRows = <Array<HTMLTableRowElement>> Array.from(container.querySelectorAll('table tbody tr')).filter(row => !row.classList.contains('lfr-template'));

  var previousFixes = prefixFixRows.reduce(getBuildFix, new Map());

  var headerRow = <HTMLTableRowElement> document.querySelector('table thead tr');

  var headerCell = <HTMLTableHeaderCellElement> document.createElement('th');
  headerCell.textContent = 'Previous';
  headerRow.cells[3].innerText = 'Current';
  headerRow.cells[3].after(headerCell);

  var tbody = <HTMLTableElement> document.querySelector('table tbody');
  var currentFixRows = <Array<HTMLTableRowElement>> Array.from(tbody.querySelectorAll('tr')).filter(row => !row.classList.contains('lfr-template'));

  for (var i = 0; i < currentFixRows.length; i++) {
    var row = currentFixRows[i];

    var fixName = (<string> row.cells[2].innerText).trim();
    var currentFixVersion = (<string> row.cells[3].innerText).trim();

    var previousFixVersion = previousFixes.get(fixName) || '';
    previousFixes.delete(fixName)

    var dataCell = <HTMLTableDataCellElement> document.createElement('td');

    dataCell.innerText = previousFixVersion;
    row.cells[3].after(dataCell);

    if (currentFixVersion == previousFixVersion) {
      row.cells[3].style.color = '#ccc';
      row.cells[4].style.color = '#ccc';
    }
  }

  previousFixes.forEach(function(value, key, map) {
    var newRow = document.createElement('tr');
    newRow.appendChild(document.createElement('td'));
    newRow.appendChild(document.createElement('td'));

    var fixNameCell = document.createElement('td');
    fixNameCell.innerHTML = key.split(',').map(getTicketLink.bind(null, '')).join(', ');
    newRow.appendChild(fixNameCell);

    newRow.appendChild(document.createElement('td'));

    var fixVersionCell = document.createElement('td');
    fixVersionCell.innerText = value;
    newRow.appendChild(fixVersionCell);

    newRow.appendChild(document.createElement('td'));
    newRow.appendChild(document.createElement('td'));
    newRow.appendChild(document.createElement('td'));
    newRow.appendChild(document.createElement('td'));
    newRow.appendChild(document.createElement('td'));

    tbody.appendChild(newRow);
  })
}

function compareBuildFixes() : void {
  if (document.location.pathname.indexOf('/builds/') == -1) {
    return;
  }

  var queryString = document.location.search || '';

  if (document.location.pathname.indexOf('/fixes') != -1) {
    if (queryString.indexOf('?compareTo=') == 0) {
      var xhr = new XMLHttpRequest();

      xhr.open('GET', '/group/guest/patching/-/osb_patcher/builds/' + queryString.substring(11) + '/fixes');
      xhr.onload = processBuildFixes.bind(null, xhr);

      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, max-age=0');
      xhr.setRequestHeader('Pragma', 'no-cache');

      xhr.send(null);
    }
  }
  else {
    var currentBuildRow = <HTMLTableRowElement | null> document.querySelector('#_1_WAR_osbpatcherportlet_patcherBuildsSearchContainer tr.selected');

    if (!currentBuildRow) {
      return;
    }

    var previousBuildRow = <HTMLTableRowElement> currentBuildRow.nextElementSibling;

    if (!previousBuildRow.classList.contains('lfr-template')) {
      var previousBuildId = (previousBuildRow.cells[0].textContent || '').trim();

      var buttons = document.querySelectorAll('button');

      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];

        if ((button.textContent || '').trim() == 'View Fixes') {
          button.onclick = window.open.bind(null, document.location.pathname + '/fixes?compareTo=' + previousBuildId, '_blank');
        }
      }
    }
  }
}