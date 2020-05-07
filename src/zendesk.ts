/**
 * Replaces a ticket name with a link to LESA or Help Center.
 */

function replaceLesaLink(target : string) {
  var oldNode = <HTMLInputElement | null> querySelector(target);

  if (oldNode && oldNode.readOnly) {
    var ticketURL;

    if (oldNode.value.indexOf('https:') == 0) {
      ticketURL = oldNode.value;
    }
    else if (isNaN(parseInt(oldNode.value))) {
      if ((oldNode.value.indexOf('LPP-') == 0) || (oldNode.value.indexOf('GROW-') == 0)) {
        ticketURL = 'https://issues.liferay.com/browse/' + oldNode.value;
      }
      else {
        ticketURL = 'https://web.liferay.com/group/customer/support/-/support/ticket/' + oldNode.value;
      }
    }
    else {
      ticketURL = 'https://liferay-support.zendesk.com/agent/tickets/' + oldNode.value;
    }

    replaceNode(oldNode, '<a href="' + ticketURL + '" target="_blank">' + ticketURL + '</a>');
  }
}
