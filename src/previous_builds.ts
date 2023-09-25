function updateFixesFromPreviousBuilds(
  accountNode: HTMLInputElement,
  buildNameNode : HTMLTextAreaElement,
  projectNode: HTMLSelectElement,
  previousBuildsInput: HTMLDivElement
) : void {

  var queryString = getQueryString({
    advancedSearch: true,
    andOperator: true,
    delta: 200,
    patcherBuildAccountEntryCode: accountNode.value,
    patcherProjectVersionIdFilter: projectNode.value
  });

  var accountBuildsURL = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher/accounts/view?' + queryString;

  var xhr = new XMLHttpRequest();

  xhr.open('GET', accountBuildsURL);

  xhr.onload = function() {
    // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
    var container = document.implementation.createHTMLDocument().documentElement;
    container.innerHTML = xhr.responseText;

    var pastTickets = Array.from(container.querySelectorAll('td > a[title]')).
        reduce((acc: Record<string, string[]>, next: HTMLAnchorElement) => {
          var row = <HTMLTableRowElement> next.closest('tr');
          if ((row.cells[2].textContent || '').trim().toLowerCase() == 'ignore') {
            return acc;
          }

          var hotfixId = (row.cells[12].textContent || '').trim();

          var newTickets = (next.getAttribute('title') || '').split(/\s*,\s*/g);
          for (var i = 0; i < newTickets.length; i++) {
            var newTicket = newTickets[i]
            if (!acc[newTicket]) {
              acc[newTicket] = [hotfixId];
            }
            else {
              acc[newTicket].push(hotfixId);
            }
          }
          return acc;
        }, {});

    var currentTickets = new Set(
      (buildNameNode.value || '').split(/\s*,\s*/g)
    );

    var missingTickets = Array.from(Object.keys(pastTickets)).
      filter(it => !currentTickets.has(it)).
      sort((a, b) => {
        var splitA = a.split('-');
        var splitB = b.split('-');

        return splitA[0] != splitB[0] ? splitA[0] > splitB[0] ? 1 : -1 :
          parseInt(splitA[1]) - parseInt(splitB[1]);
      });

    previousBuildsInput.innerHTML = '<p><a href="' + accountBuildsURL + '" target="_blank">see builds list</a></p><p>' +
      missingTickets.map(it1 => {
        return '<span class="nowrap" title="' +
          pastTickets[it1].map(it => it.substring(it.indexOf('-') + 1, it.lastIndexOf('-'))).join(', ') +
          '">' + getTicketLink('', it1, it1) + ' (' +
          pastTickets[it1].length + ((pastTickets[it1].length == 1) ? ' build' : ' builds') + ')</span>'
     }).join(', ') + '</p>';

    var compactCell = <HTMLTableCellElement> document.querySelector('tr[data-suggestion-type="Previous Builds"] td');
    var ticketCount = missingTickets.length;
    compactCell.textContent = ticketCount + ((ticketCount == 1) ? ' ticket' : ' tickets');
  };

  xhr.send(null);
};

function getFixesFromPreviousBuilds() : Element {
  var previousBuildsContainer = document.createElement('div');
  previousBuildsContainer.classList.add('control-group', 'field-wrapper', 'verbose');

  if (document.location.pathname.indexOf('/builds/create') == -1) {
    return previousBuildsContainer;
  }

  var previousBuildsLabel = document.createElement('label');
  previousBuildsLabel.classList.add('control-label');
  previousBuildsLabel.setAttribute('for', '_1_WAR_osbpatcherportlet_previousBuildsTicketList');
  previousBuildsLabel.textContent = 'Previous Builds Ticket Suggestions';
  previousBuildsContainer.appendChild(previousBuildsLabel);

  var previousBuildsInput = document.createElement('div');
  previousBuildsInput.classList.add('input');
  previousBuildsInput.setAttribute('id', '_1_WAR_osbpatcherportlet_previousBuildsTicketList');
  previousBuildsInput.setAttribute('name', '_1_WAR_osbpatcherportlet_previousBuildsTicketList');
  previousBuildsInput.setAttribute('inputcssclass', 'osb-patcher-input-wide');
  previousBuildsContainer.appendChild(previousBuildsInput);

  var accountNode = <HTMLInputElement | null> querySelector('patcherBuildAccountEntryCode');
  var buildNameNode = <HTMLTextAreaElement | null> querySelector('patcherBuildName');
  var projectNode = <HTMLSelectElement | null> querySelector('patcherProjectVersionId');

  if (accountNode != null && buildNameNode != null && projectNode != null) {
    updateFixesFromPreviousBuilds(accountNode, buildNameNode, projectNode, previousBuildsInput);

    var refreshPreviousBuilds = updateFixesFromPreviousBuilds.bind(null, accountNode, buildNameNode, projectNode, previousBuildsInput);

    accountNode.addEventListener('blur', refreshPreviousBuilds);
    buildNameNode.addEventListener('blur', refreshPreviousBuilds);
    projectNode.addEventListener('change', refreshPreviousBuilds);
  }

  return previousBuildsContainer;
}
