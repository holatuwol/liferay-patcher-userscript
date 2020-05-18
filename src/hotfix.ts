/**
 * Replaces the "Download" link with the name of the hotfix you're downloading
 */

function replaceHotfixLink(target : string) : void {
  var labelNode = document.querySelector('label[for="' + ns + target + '"]');

  if (!labelNode) {
    return;
  }

  var containerNode = labelNode.parentElement;

  if (!containerNode) {
    return;
  }

  var anchor = containerNode.querySelector('a');

  if (!anchor || !anchor.textContent) {
    return;
  }

  var href = <string> anchor.getAttribute('href');
  anchor.textContent = href.substring(href.lastIndexOf('/') + 1);

  var anchorParentElement = <HTMLElement> anchor.parentElement;

  if ((target === 'official') || (target === 'debug')) {
    var buildMetadataCallback = function(obj : any) {
      var buildMetadata = obj.data;
      anchorParentElement.appendChild(document.createElement('br'));
      var qaStatusNode = document.createTextNode('(' + Liferay.Language.get(buildMetadata.qaStatusLabel) + ')');
      anchorParentElement.appendChild(qaStatusNode);
    }

    if (exportFunction) {
      buildMetadataCallback = exportFunction(buildMetadataCallback, unsafeWindow);
    }

    var buildId = document.location.pathname.substring(document.location.pathname.lastIndexOf('/') + 1);

    var buildMetadataArguments = {
      id: buildId
    };

    if (cloneInto) {
      buildMetadataArguments = cloneInto(buildMetadataArguments, unsafeWindow);
    }

    Liferay.Service(
      '/osb-patcher-portlet.builds/view',
      buildMetadataArguments,
      buildMetadataCallback
    );
  }
}
