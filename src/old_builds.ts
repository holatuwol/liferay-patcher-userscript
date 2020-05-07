/**
 * Replaces the account name with a link to all builds for the account.
 */

function replaceAccountLink(target : string) {
  var oldNode = <HTMLInputElement | null> querySelector(target);

  if (oldNode && oldNode.readOnly) {
  	var projectVersionElement = <HTMLInputElement> querySelector('patcherProductVersionId');

    var params = {
      'p_p_id': portletId,
      'patcherBuildAccountEntryCode': oldNode.value,
      'patcherProductVersionId': projectVersionElement.value
    };

    replaceNode(oldNode, '<a href="https://patcher.liferay.com/group/guest/patching/-/osb_patcher/accounts/view?' + getQueryString(params) + '" target="_blank">' + oldNode.value + '</a>');
  }
}