var AUI = <AUI> window.AUI;
var Liferay = <Liferay> window.Liferay;
var _1_WAR_osbpatcherportlet_productVersionOnChange = <Function> window._1_WAR_osbpatcherportlet_productVersionOnChange;

var portletId = '1_WAR_osbpatcherportlet';
var ns = '_' + portletId + '_';

/**
 * Utility function to convert an object into a query string with namespaced
 * parameter names.
 */

function getQueryString(params : any) : string {
  return Object.keys(params).map(key => (key.indexOf('p_p_') == 0 ? key : (ns + key)) + '=' + params[key]).join('&');
}

/**
 * Shorthand for fetching an element with a namespaced ID.
 */

function querySelector(target : string) : HTMLElement | null {
  return <HTMLElement> document.getElementById(ns + target);
}

/**
 * Utility function to extract the currently selected value of a
 * select box.
 */

function getSelectedValue(target : string) : string {
  var select = <HTMLSelectElement | null> querySelector(target);

  if (!select || select.selectedIndex == -1) {
    return '';
  }

  return select.options[select.selectedIndex].value;
}

/**
 * Replaces a GMT date with a date in the user's current time zone, according to
 * their web browser.
 */

function replaceDate(target : string) : void {
  var labelNode = document.querySelector('label[for="' + ns + target + '"]');

  if (!labelNode) {
    return;
  }

  var containerNode = labelNode.parentElement;

  if (!containerNode) {
  	return;
  }

  var dateNode = containerNode.childNodes[2];
  var oldDateText = dateNode.textContent;

  if (!oldDateText) {
  	return;
  }

  var dateString = new Date(oldDateText.trim() + ' GMT-0000').toString();

  dateNode.textContent = dateString;
}

/**
 * Utility function replace the specified input element with the given HTML
 * view, creating a hidden input so that forms still submit properly.
 */

function replaceNode(
  oldNode : HTMLElement,
  newHTML : string
) : void {

  var newNode = document.createElement('span');
  newNode.innerHTML = newHTML;

  var newHiddenInputNode = document.createElement('input');
  newHiddenInputNode.setAttribute('type', 'hidden');
  newHiddenInputNode.setAttribute('name', oldNode.getAttribute('name') || '');
  newHiddenInputNode.setAttribute('id', oldNode.getAttribute('id') || '');

  if (oldNode.tagName.toLowerCase() == 'select') {
  	var oldSelectNode = <HTMLSelectElement> oldNode;
    newHiddenInputNode.value = oldSelectNode.options[oldSelectNode.selectedIndex].value;
  }
  else if (oldNode.innerHTML) {
    newHiddenInputNode.value = oldNode.innerHTML
  }
  else {
    newHiddenInputNode.setAttribute('value', oldNode.getAttribute('value') || '');
  }

  var parentElement = <HTMLElement> oldNode.parentElement;

  parentElement.replaceChild(newHiddenInputNode, oldNode);
  parentElement.insertBefore(newNode, newHiddenInputNode);
}

/**
 * Returns a link to the ticket.
 */

function getTicketLink(
  className : string,
  ticket : string,
  title : string | null
) : string {

  if (ticket.toUpperCase() != ticket) {
    return ticket;
  }

  var ticketURL = 'https://issues.liferay.com/browse/' + ticket;

  if (className) {
  	var productVersionElement = <HTMLSelectElement> querySelector('patcherProductVersionId');
    var productVersionId = productVersionElement.value;
    var projectVersionElement = <HTMLSelectElement> querySelector('patcherProjectVersionId');
    var projectVersionId = projectVersionElement.value;

    var params = {
      advancedSearch: true,
      andOperator: true,
      hideOldFixVersions: true,
      patcherFixName: ticket,
      patcherProductVersionId: productVersionId,
      patcherProjectVersionIdFilter: projectVersionId
    };

    ticketURL = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher?' + getQueryString(params);
  }

  if (!title) {
    title = ticket;
  }

  return '<a class="nowrap ' + className + '" href="' + ticketURL + '" title="' + title + '" target="_blank">' + ticket + '</a>';
}

/**
 * Compares two tickets.
 */

function compareTicket(
  a : string,
  b : string
) : number {

  var aParts = a.split('-');
  var bParts = b.split('-');

  if (aParts[0] != bParts[0]) {
    return aParts[0] > bParts[0] ? 1 : -1;
  }

  if ((aParts.length == 1) || (bParts.length == 1)) {
    return bParts.length - aParts.length;
  }

  return parseInt(aParts[1]) - parseInt(bParts[1]);
}

/**
 * Converts the provided list of tickets into a nice HTML version.
 */

function getTicketLinks(
  text : string,
  className : string
) : string {

  return text.split(',').map(x => x.trim()).sort(compareTicket).map(getTicketLink.bind(null, className)).join(', ');
}