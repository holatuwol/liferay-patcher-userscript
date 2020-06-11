/**
 * Replaces a ticket name with a link to LESA or Help Center.
 */

function replaceLesaLink(target : string) {
  var oldNode = <HTMLInputElement | null> querySelector(target);

  if (!oldNode) {
    return;
  }

  if (oldNode.readOnly) {
    var ticketHREF;
    var ticketId;
    var jiraSearchLinkHREF = null;

    if (oldNode.value.indexOf('https:') == 0) {
      ticketHREF = oldNode.value;
      ticketId = ticketHREF.substring(ticketHREF.lastIndexOf('/') + 1);
    }
    else if (isNaN(parseInt(oldNode.value))) {
      if ((oldNode.value.indexOf('LPP-') == 0) || (oldNode.value.indexOf('GROW-') == 0) || (oldNode.value.indexOf('LRP-') == 0)) {
        ticketHREF = 'https://issues.liferay.com/browse/' + oldNode.value;
        ticketId = oldNode.value;
        jiraSearchLinkHREF = ticketHREF;
      }
      else {
        ticketHREF = 'https://web.liferay.com/group/customer/support/-/support/ticket/' + oldNode.value;
        ticketId = oldNode.value;
      }
    }
    else {
      ticketHREF = 'https://liferay-support.zendesk.com/agent/tickets/' + oldNode.value;
      ticketId = oldNode.value;
    }

    if (jiraSearchLinkHREF == null) {
      var query = `"Customer Ticket Permalink" = "${ticketHREF}" OR "Zendesk Ticket IDs" ~ ${ticketId} OR "Customer Ticket" = "${ticketId}" OR "Customer Ticket" = "${ticketHREF}"`;

      var encodedQuery = encodeURIComponent(query);

      jiraSearchLinkHREF = 'https://issues.liferay.com/issues/?jql=' + encodedQuery;
    }

    var newNode;

    if (ticketHREF == jiraSearchLinkHREF) {
      newNode = `${ticketId} | <a href="${jiraSearchLinkHREF}" target="_blank">JIRA ticket</a>`;
    }
    else if (ticketHREF.indexOf('https://web.liferay.com/') == 0) {
      newNode = `${ticketId} | <a href="${ticketHREF}" target="_blank">LESA ticket</a> | <a href="${jiraSearchLinkHREF}" target="_blank">JIRA tickets</a>`;
    }
    else {
      newNode = `${ticketId} | <a href="${ticketHREF}" target="_blank">zendesk ticket</a> | <a href="${jiraSearchLinkHREF}" target="_blank">JIRA tickets</a>`;
    }

    replaceNode(oldNode, newNode);
  }
}
