function replaceReadOnlySelect(
  name: string,
  text: string | null,
  link: string | null
) : void {

  var select = <HTMLSelectElement | null> querySelector(name);

  if (!select || !select.disabled) {
    return;
  }

  if (link) {
    replaceNode(select, '<a href="' + link + '">' + text + '</a>');
  }
  else {
    replaceNode(select, select.options[select.selectedIndex].textContent || 'unknown');
  }
}

/**
 * Adds a new element to the page to allow you to select from a list of
 * Liferay versions before choosing a product version.
 */

function addProductVersionFilter() : void {
  var productVersionSelect = <HTMLSelectElement> querySelector('patcherProductVersionId');

  if (!productVersionSelect) {
    return;
  }
  
  if (productVersionSelect.disabled) {
    var metadata = <FixPackMetadata> getFixPack();
    var patcherTagName = metadata.tag;
    var branchName = metadata.name;

    replaceReadOnlySelect('patcherProductVersionId', null, null);
    replaceReadOnlySelect('patcherProjectVersionId', branchName, 'https://github.com/liferay/liferay-portal-ee/tree/' + patcherTagName);

    return;
  }

  var versions = ['', '6.x', '7.0', '7.1', '7.2'];

  for (var i = 0; i < productVersionSelect.options.length; i++) {
    var option = productVersionSelect.options[i];
    var optionText = option.textContent || '';

    for (var j = 1; j < versions.length; j++) {
      if ((optionText.indexOf('DXP ' + versions[j]) != -1) || (optionText.indexOf('Portal ' + versions[j]) != -1)) {
        option.setAttribute('data-liferay-version', versions[j]);
      }
    }
  }

  var liferayVersionSelect = document.createElement('select');
  liferayVersionSelect.id = ns + 'liferayVersion';

  for (var i = 0; i < versions.length; i++) {
    var option = document.createElement('option');
    option.value = versions[i];
    option.textContent = versions[i];
    liferayVersionSelect.appendChild(option);
  };

  liferayVersionSelect.onchange = updateProductVersionSelect;
  var productVersionSelectParentElement = <HTMLElement> productVersionSelect.parentElement;
  productVersionSelectParentElement.insertBefore(liferayVersionSelect, productVersionSelect);
}

/**
 * Converts the tag name into a seven digit version number that can be
 * used for sorting. First four digits are the base version (7010, 7110),
 * and the remander are the fix pack level.
 */

function getLiferayVersion(version : string) : number {
  if (version.indexOf('fix-pack-de-') != -1) {
    var pos = version.indexOf('-', 12);
    var deVersion = version.substring(12, pos);
    var shortVersion = version.substring(pos + 1);

    pos = shortVersion.indexOf('-private');

    if (pos != -1) {
      shortVersion = shortVersion.substring(0, pos);
    }

    return parseInt(shortVersion) * 1000 + parseInt(deVersion);
  }
  else if (version.indexOf('fix-pack-dxp-') != -1) {
    var pos = version.indexOf('-', 13);
    var deVersion = version.substring(13, pos);
    var shortVersion = version.substring(pos + 1);

    pos = shortVersion.indexOf('-private');

    if (pos != -1) {
      shortVersion = shortVersion.substring(0, pos);
    }

    return parseInt(shortVersion) * 1000 + parseInt(deVersion);
  }
  else if (version.indexOf('fix-pack-base-') != -1) {
    var shortVersion = version.substring('fix-pack-base-'.length);
    var pos = shortVersion.indexOf('-private');

    if (pos != -1) {
      shortVersion = shortVersion.substring(0, pos);
    }

    pos = shortVersion.indexOf('-');

    if (pos == -1) {
      return parseInt(shortVersion) * 1000;
    }

    return parseInt(shortVersion.substring(0, pos)) * 1000 + parseInt(shortVersion.substring(pos + 3));
  }
  else {
    var matcher = /[0-9]*\.[0-9]/.exec(version);

    if (matcher) {
      var shortVersion = matcher[0].replace('.', '');

      return parseInt(shortVersion) * 100 * 1000;
    }
    else {
      return 0;
    }
  }
}

/**
 * Comparison function that uses getLiferayVersion to compute versions,
 * and then sorts in alphabetical order for equivalent versions (thus,
 * we get private branches sorted after the equivalent public branch).
 */

function compareLiferayVersions(
  a : HTMLOptionElement,
  b : HTMLOptionElement
) : number {

  var aValue = getLiferayVersion(a.textContent || '');
  var bValue = getLiferayVersion(b.textContent || '');

  if (aValue != bValue) {
    return aValue - bValue;
  }

  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Places the project versions in numeric order rather than alphabetical
 * order, to make it easier to find the latest baseline.
 */

function updateProjectVersionOrder() : void {
  var projectVersionSelect = <HTMLSelectElement | null> querySelector('patcherProjectVersionId');

  if (!projectVersionSelect) {
      return;
  }

  var sortedOptions = Array.from(projectVersionSelect.options).sort(compareLiferayVersions);

  for (var i = 0; i < sortedOptions.length; i++) {
    projectVersionSelect.appendChild(sortedOptions[i]);
  }

  var event = document.createEvent('HTMLEvents');
  event.initEvent('change', false, true);
  projectVersionSelect.dispatchEvent(event);
}

/**
 * Updates the product version select based on the value of the Liferay
 * version select.
 */

function updateProductVersionSelect() {
  var productVersionSelect = <HTMLSelectElement> querySelector('patcherProductVersionId');

  var liferayVersion = getSelectedValue('liferayVersion');
  productVersionSelect.setAttribute('data-liferay-version', liferayVersion);

  if (productVersionSelect.selectedIndex != -1) {
    var selectedOption = productVersionSelect.options[productVersionSelect.selectedIndex];
    var selectedOptionText = selectedOption.textContent || '';

    if (selectedOption.getAttribute('data-liferay-version') == liferayVersion) {
      if (selectedOptionText.trim() == 'DXP ' + liferayVersion) {
        setTimeout(updateProjectVersionOrder, 500);
      }

      return;
    }
  }

  var option = <HTMLOptionElement | null> productVersionSelect.querySelector('option[data-liferay-version="' + liferayVersion + '"]');

  if (option) {
    option.selected = true;
    _1_WAR_osbpatcherportlet_productVersionOnChange(option.value);
    setTimeout(updateProjectVersionOrder, 500);
  }
}

/**
 * Selects anything that was specified in the query string.
 */

function updateFromQueryString() {
  var liferayVersionSelect = querySelector('liferayVersion');

  if (!liferayVersionSelect) {
    return;
  }

  var productVersionSelect = querySelector('patcherProductVersionId');

  if (!productVersionSelect) {
    return;
  }

  var re = new RegExp(ns + 'patcherProductVersionId=(\\d+)');
  var match = re.exec(document.location.search);

  if (match) {
    var patcherProductVersionId = match[1];
    var option = <HTMLOptionElement | null> productVersionSelect.querySelector('option[value="' + patcherProductVersionId + '"]');

    if (option) {
      var liferayVersion = option.getAttribute('data-liferay-version');

      option = <HTMLOptionElement | null> liferayVersionSelect.querySelector('option[value="' + liferayVersion + '"]');

      if (option) {
        option.selected = true;
        updateProductVersionSelect();
      }
    }
  }

  var projectVersionSelect = querySelector('patcherProjectVersionId');

  if (!projectVersionSelect) {
    return;
  }

  re = new RegExp(ns + 'patcherProjectVersionId=(\\d+)');
  match = re.exec(document.location.search);

  if (match) {
    var patcherProjectVersionId = match[1];
    var option = <HTMLOptionElement | null> projectVersionSelect.querySelector('option[value="' + patcherProjectVersionId + '"]');

    if (option) {
      option.selected = true;
    }
    else {
      setTimeout(updateFromQueryString, 500);
    }
  }
}