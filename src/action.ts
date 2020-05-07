/**
 * Replaces any links that would have opened in a modal dialog / popup
 * window with one that opens in a regular new window.
 */

function replacePopupWindowLinks() : void {
  var buttons = document.querySelectorAll('button[onclick]');

  for (var i = 0; i < buttons.length; i++) {
    var attributes = <any> buttons[i].attributes;
    var onclickAttribute = attributes['onclick'];
    var onclickValue = onclickAttribute.value;

    if (onclickValue.indexOf('javascript:') == 0) {
      onclickValue = onclickValue.substring('javascript:'.length);
    }

    onclickValue = onclickValue.replace(/Liferay.Patcher.openWindow\('([^']*)',[^\)]*/g, "window.open('$1','_blank'");
    onclickValue = onclickValue.replace('?p_p_state=pop_up', '');
    onclickValue = onclickValue.replace('&p_p_state=pop_up', '');

    onclickAttribute.value = onclickValue;
  }
}

/**
 * Update the link to "Use as Build Template" to include additional
 * parameters so that they can be auto-selected.
 */

function addBaselineToBuildTemplate() : void {
  var baselineLinks = Array.from(document.querySelectorAll('.taglib-text-icon'))
  	.filter(function(x) { return (x.textContent || '').toLowerCase() == 'use as build template'; });

  if (baselineLinks.length != 1) {
    return;
  }

  var buildTemplateAnchor = <HTMLAnchorElement> baselineLinks[0].parentElement;

  buildTemplateAnchor.href += '&' + getQueryString({
    'patcherProductVersionId': getSelectedValue('patcherProductVersionId'),
    'patcherProjectVersionId': getSelectedValue('patcherProjectVersionId')
  });
}