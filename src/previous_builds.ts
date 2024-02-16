var pastTickets = <Record<string, string[]>> {};

function getHotfixShortNames(hotfixes: string[]) : string[] {
  return hotfixes.map(it => {
    return (it.indexOf('.q') != -1) ?
      it.substring(it.indexOf('-hotfix') + 1, it.length - 4) :
      it.substring(it.indexOf('-') + 1, it.lastIndexOf('-'))
  });
}

function getTicketBuildCountSummary(
  ticketId: string,
  hotfixes: string[]
) : HTMLSpanElement {

  var summaryElement = document.createElement('span');
  summaryElement.classList.add('nowrap', 'osb-ticket-builds-summary');
  summaryElement.setAttribute('title', getHotfixShortNames(hotfixes).join(', '));

  summaryElement.innerHTML = getTicketLink('', ticketId, ticketId) + ' (' + hotfixes.length + ' build' + ((hotfixes.length == 1) ? '' : 's') + ')</span>';

  return summaryElement;
}

function checkFixesFromPreviousBuilds(
  buildNameNode : HTMLTextAreaElement,
  previousBuildsInput: HTMLDivElement,
  accountBuildsURL: string
) {

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

  previousBuildsInput.innerHTML = '';

  var buildsListLink = document.createElement('a');
  buildsListLink.setAttribute('href', accountBuildsURL);
  buildsListLink.setAttribute('target', '_blank');
  buildsListLink.textContent = 'see builds list';

  var buildsListParagraph = document.createElement('p');
  buildsListParagraph.appendChild(buildsListLink);

  previousBuildsInput.appendChild(buildsListParagraph);

  if (missingTickets.length > 0) {
    var ticketsListParagraph = missingTickets.reduce((acc, next, i) => {
      if (i > 0) {
        acc.appendChild(document.createTextNode(', '));
      }

      acc.appendChild(getTicketBuildCountSummary(next, pastTickets[next]));
      return acc;
    }, document.createElement('p'));

    ticketsListParagraph.setAttribute('inputcssclass', 'osb-patcher-input-wide');
    previousBuildsInput.appendChild(ticketsListParagraph);

    var buttonHolderRow = document.createElement('div');
    buttonHolderRow.classList.add('button-holder', 'osb-patcher-button-row');

    var button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.classList.add('btn', 'osb-patcher-button');
    button.onclick = function() {
      buildNameNode.value += ',' + missingTickets.join(',');
      checkFixesFromPreviousBuilds(buildNameNode, previousBuildsInput, accountBuildsURL);
      return false;
    };

    var buttonContent = document.createElement('i');
    buttonContent.classList.add('icon-plus-sign');

    button.appendChild(buttonContent);
    buttonHolderRow.appendChild(button);
    previousBuildsInput.appendChild(buttonHolderRow);
  }

  var compactCell = <HTMLTableCellElement> document.querySelector('tr[data-suggestion-type="Previous Builds"] td');
  var ticketCount = missingTickets.length;
  compactCell.textContent = ticketCount + ((ticketCount == 1) ? ' ticket' : ' tickets');
}

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

  if (Object.keys(pastTickets).length > 0) {
    checkFixesFromPreviousBuilds(buildNameNode, previousBuildsInput, accountBuildsURL);
    return;
  }

  var xhr = new XMLHttpRequest();

  xhr.open('GET', accountBuildsURL);

  xhr.onload = function() {
    // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
    var container = document.implementation.createHTMLDocument().documentElement;
    container.innerHTML = xhr.responseText;

    pastTickets = Array.from(container.querySelectorAll('td > a[title]')).
      reduce((acc: Record<string, string[]>, next: HTMLAnchorElement) => {
        var row = <HTMLTableRowElement> next.closest('tr');
        if ((row.cells[2].textContent || '').trim().toLowerCase() == 'ignore') {
          return acc;
        }
        if ((row.cells[9].textContent || '').trim().toLowerCase().indexOf('ignore') != -1) {
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

     checkFixesFromPreviousBuilds(buildNameNode, previousBuildsInput, accountBuildsURL);
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
