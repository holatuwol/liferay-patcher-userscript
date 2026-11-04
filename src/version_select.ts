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

var liferayVersions = ['', '6.x', '7.0', '7.1', '7.2', '7.3', '7.4', 'Quarterly'];

/**
 * Determines the broad Liferay version (e.g. '7.4') that a product
 * version select option's text belongs to, based on the same text
 * patterns used to tag the options in addProductVersionFilter. The
 * 'Quarterly Releases' option has a broad version of its own, so that
 * 7.4 shows only the DXP 7.4 and Portal 7.4 options.
 */

function getProductVersionLiferayVersion(optionText : string) : string | null {
  if (optionText.trim() == 'Quarterly Releases') {
    return 'Quarterly';
  }

  for (var i = 1; i < liferayVersions.length; i++) {
    if ((optionText.indexOf('DXP ' + liferayVersions[i]) != -1) || (optionText.indexOf('Portal ' + liferayVersions[i]) != -1)) {
      return liferayVersions[i];
    }
  }

  return null;
}

/**
 * Removes the options from a project version select whose text doesn't
 * belong to the given broad Liferay version, so that the create fix
 * page's project version select only shows versions relevant to the
 * selected product version.
 */

function pruneProjectVersionOptions(
  select : HTMLSelectElement,
  liferayVersion : string
) : void {

  if ((liferayVersion == '7.4') || (liferayVersion == 'Quarterly')) {
    var versionString = (liferayVersion == '7.4') ? '7.4.13-' : '.q';

    for (var i = select.options.length - 1; i >= 0; i--) {
      var version = (select.options[i].textContent || '').trim();
      if ((version != '') && (version.indexOf(versionString) == -1)) {
        select.options[i].remove();
      }
    }
  }
  else {
    var versionString = '-' + liferayVersion.replace('.', '') + '10';

    for (var i = select.options.length - 1; i >= 0; i--) {
      var version = (select.options[i].textContent || '').trim();
      if ((version != '') && (version.indexOf(versionString) == -1)) {
        select.options[i].remove();
      }
    }
  }
}

/**
 * Returns whether the current page is the fixes list.
 */

function isFixesListPage(): boolean {
  var activeTab = document.querySelector('.tab.active');

  return !!activeTab && ((activeTab.textContent || '').trim() == 'Fixes') &&
    (document.location.pathname.indexOf('/create') == -1);
}

/**
 * Returns the text of the keywords search input of the page (the input
 * named keywords, or the one of the fixes list search toolbar), or an
 * empty string if the page has no such input.
 */

function getKeywordsInputValue(): string {
  var keywordsElement = <HTMLInputElement | null> (document.getElementById('toggle_id_patcher_fix_searchkeywords') ||
    document.getElementsByName(ns + 'keywords')[0] || null);

  return keywordsElement ? keywordsElement.value.trim() : '';
}

/**
 * Adds a new element to the page to allow you to select from a list of
 * Liferay versions before choosing a product version. Only applies on
 * the create pages, since on other pages (e.g. viewing an existing build
 * or fix) this select is either disabled or not meant to have its
 * defaults second-guessed. The lists have a search panel instead (see
 * enhanceSearchToggle).
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

  if (document.location.pathname.indexOf('/create') == -1) {
    return;
  }

  var selectedVersion = null;

  for (var i = 0; i < productVersionSelect.options.length; i++) {
    var option = productVersionSelect.options[i];
    var liferayVersion = getProductVersionLiferayVersion(option.textContent || '');

    if (liferayVersion) {
      option.setAttribute('data-liferay-version', liferayVersion);
    }

    if (option.selected) {
      selectedVersion = option.getAttribute('data-liferay-version');
    }
  }

  var hadSelectedVersion = !!selectedVersion;

  if (!selectedVersion) {
    selectedVersion = 'Quarterly';
  }

  var liferayVersionSelect = document.createElement('select');
  liferayVersionSelect.id = ns + 'liferayVersion';

  for (var i = 0; i < liferayVersions.length; i++) {
    var option = document.createElement('option');
    option.value = liferayVersions[i];
    option.selected = (selectedVersion == liferayVersions[i]);
    option.textContent = liferayVersions[i];
    liferayVersionSelect.appendChild(option);
  };

  liferayVersionSelect.addEventListener('change', updateProductVersionSelect);
  productVersionSelect.addEventListener('change', setTimeout.bind(null, updateProjectVersionOrder, 500));

  var productVersionSelectParentElement = <HTMLElement> productVersionSelect.parentElement;
  productVersionSelectParentElement.insertBefore(liferayVersionSelect, productVersionSelect);

  if (hadSelectedVersion && selectedVersion) {
    productVersionSelect.setAttribute('data-liferay-version', selectedVersion);
    addProjectVersionFilter(productVersionSelect, selectedVersion);
  }
  else {
    updateProductVersionSelect();
  }

  var addCreateProjectVersionFilterInput = function () {
    var projectVersionSelect = <HTMLSelectElement | null> querySelector('patcherProjectVersionId');

    if (projectVersionSelect && !projectVersionSelect.disabled) {
      addProjectVersionFilterInput(projectVersionSelect);
    }
  };

  new MutationObserver(<MutationCallback> debounce(addCreateProjectVersionFilterInput, 100)).observe(document.body, {
    childList: true,
    subtree: true,
  });

  addCreateProjectVersionFilterInput();
}

var projectVersionInputCount = 0;
var projectVersionSelectsWithInput = new WeakSet<HTMLSelectElement>();

/**
 * Returns the texts of the project version options, from the newest
 * version to the oldest. A filter select keeps its option without a
 * value (for example 'All') at the start, so that the filter can be
 * removed. On the create pages, Quarterly Releases keeps only the
 * quarterly versions, the same as the fixes list.
 */

function getProjectVersionTexts(projectVersionSelect: HTMLSelectElement): string[] {
  var isFilter = projectVersionSelect.name == (ns + 'patcherProjectVersionIdFilter');
  var pattern: RegExp | null = null;
  var productVersionSelect = <HTMLSelectElement | null> querySelector('patcherProductVersionId');

  if (!isFilter && productVersionSelect && (productVersionSelect.selectedIndex != -1)) {
    var productVersionText = (productVersionSelect.options[productVersionSelect.selectedIndex].textContent || '').trim();

    if (productVersionText == 'Quarterly Releases') {
      pattern = getProductProjectVersionPattern(productVersionText);
    }
  }

  var emptyValueTexts: string[] = [];
  var versionTexts: string[] = [];

  for (var i = 0; i < projectVersionSelect.options.length; i++) {
    var option = projectVersionSelect.options[i];
    var text = (option.textContent || '').trim();

    if (text == '') {
      continue;
    }

    if (option.value != '') {
      if (!pattern || pattern.test(text)) {
        versionTexts.push(text);
      }
    }
    else if (isFilter) {
      emptyValueTexts.push(text);
    }
  }

  // Newest first by the version (see getLiferayVersion), so that for
  // example the quarterly releases come before the fix packs and the
  // marketplace versions, and then by name for the same version.
  return emptyValueTexts.concat(versionTexts.sort(function (a, b) {
    return (getLiferayVersion(b) - getLiferayVersion(a)) || b.localeCompare(a, 'en', {numeric: true});
  }));
}

/**
 * Returns true if the page or the query string selects a project version
 * in the given select of a create page. The page can mark the version
 * with the selected attribute, and the query string can name the version.
 * Use as Build Template (templatePatcherBuildId in the query string)
 * selects the version of the template without the selected attribute.
 */

function isProjectVersionPreselected(projectVersionSelect: HTMLSelectElement): boolean {
  if (new RegExp(ns + 'templatePatcherBuildId=\\d+').test(document.location.search)) {
    return true;
  }

  var match = new RegExp(ns + 'patcherProjectVersionId=(\\d+)').exec(document.location.search);

  return Array.from(projectVersionSelect.options).some(function (option) {
    return option.hasAttribute('selected') || (match && (option.value == match[1]));
  });
}

/**
 * Creates a text input with a list of choices. Typing in the input
 * filters the list. When the input text is equal to a choice, the input
 * calls onSelect with that text. When the input gets the focus, it is
 * cleared, so that the list shows the first choices. The list (a datalist)
 * only has the choices that have the text of the input, at most
 * versionInputOptionCount of them, since a datalist with hundreds of
 * options is slow to filter as the user types.
 */

var versionInputOptionCount = 50;

function createVersionInput(placeholder: string, onSelect: (text: string) => void) {
  var dataList = document.createElement('datalist');
  dataList.id = ns + 'projectVersionList' + (++projectVersionInputCount);

  var input = document.createElement('input');
  input.setAttribute('list', dataList.id);
  input.style.minWidth = '16em';
  input.type = 'text';

  var selectedText = '';
  var texts: string[] = [];
  var shownFilter: string | null = null;

  // Fills the list with the first choices that have the given text (in
  // any case), in the order of the choices. The browser filters the list
  // the same way, so the list has the choices that it would show.
  var showOptions = function (text: string) {
    var filter = text.trim().toLowerCase();

    if (filter == shownFilter) {
      return;
    }

    shownFilter = filter;

    var fragment = document.createDocumentFragment();
    var count = 0;

    for (var i = 0; (i < texts.length) && (count < versionInputOptionCount); i++) {
      if ((filter == '') || (texts[i].toLowerCase().indexOf(filter) != -1)) {
        var option = document.createElement('option');
        option.value = texts[i];
        fragment.appendChild(option);
        count++;
      }
    }

    dataList.innerHTML = '';
    dataList.appendChild(fragment);
  };

  var selectText = function () {
    var text = input.value.trim();

    if (texts.indexOf(text) == -1) {
      return;
    }

    if (text != selectedText) {
      onSelect(text);
    } else {
      // A pick of the selected text changes nothing, so the input
      // gives up the focus, and the next click clears it again.
      input.blur();
    }
  };

  input.addEventListener('blur', function () {
    if (!input.value.trim()) {
      input.value = selectedText;
    }
  });

  input.addEventListener('change', selectText);

  input.addEventListener('focus', function () {
    input.value = '';
    showOptions('');
  });

  input.addEventListener('input', function (event: any) {
    showOptions(input.value);

    if (event.inputType != 'insertText') {
      selectText();
    }
  });

  return {
    dataList: dataList,
    input: input,
    insert: function (parentElement: HTMLElement, nextSibling: Node | null) {
      parentElement.insertBefore(input, nextSibling);
      parentElement.insertBefore(dataList, nextSibling);
    },
    setSelectedText: function (text: string) {
      // A change of a focused input with an open list can make the browser
      // close the list, so the input only changes when the text changes.
      if (text == selectedText) {
        return;
      }

      selectedText = text;
      input.placeholder = text || placeholder;

      if (document.activeElement != input) {
        input.value = text;
      }
    },
    hasText: function (text: string) {
      return texts.indexOf(text) != -1;
    },
    setTexts: function (newTexts: string[]) {
      texts = newTexts;
      shownFilter = null;
      showOptions((document.activeElement == input) ? input.value : '');
    }
  };
}

/**
 * Replaces a project version select with a text input that has a list of
 * the project versions. The select stays in the form but is hidden, and a
 * pick from the list selects the same version in the select. Called once
 * the portlet's own AJAX call populates the project version select of a
 * create page, and also for any other page's project version filter
 * select (see sortProjectVersionIdFilterSelects). A given select gets an
 * input only once, tracked in a WeakSet rather than by a fixed input id,
 * since there can be more than one such select on the same page. A
 * WeakSet and not an attribute, since the portlet can replace the select
 * with a copy of it, and the copy must get an input of its own. If the
 * portlet replaces the select, the input of the old select
 * is removed, and projectVersionIdReady does not fire again, so that
 * updateFromQueryString does not undo the choices of the user. A create
 * page select starts without a version, so that the user must pick one,
 * except when the page or the query string selects one (for example Use
 * as Build Template).
 */

function addProjectVersionFilterInput(projectVersionSelect: HTMLSelectElement): void {
  if (projectVersionSelectsWithInput.has(projectVersionSelect)) {
    return;
  }

  projectVersionSelectsWithInput.add(projectVersionSelect);

  var oldElements = Array.from((<HTMLElement> projectVersionSelect.parentElement).children).filter(function (element) {
    return element.classList.contains('project-version-input');
  });

  var isReplacement = oldElements.length > 0;

  for (var i = 0; i < oldElements.length; i++) {
    oldElements[i].remove();
  }

  var isFilter = projectVersionSelect.name == (ns + 'patcherProjectVersionIdFilter');
  var isPicked = false;

  var versionInput = createVersionInput('Select a project version', function (text) {
    var option = Array.from(projectVersionSelect.options).find(function (option) {
      return (option.textContent || '').trim() == text;
    })!;

    isPicked = true;
    projectVersionSelect.value = option.value;
    projectVersionSelect.dispatchEvent(new Event('change', {bubbles: true}));
  });

  var updateVersionInput = function () {
    versionInput.setTexts(getProjectVersionTexts(projectVersionSelect));

    if (!isFilter && !isPicked && !isProjectVersionPreselected(projectVersionSelect)) {
      projectVersionSelect.selectedIndex = -1;
      versionInput.setSelectedText('');
      return;
    }

    var selectedOption = projectVersionSelect.options[projectVersionSelect.selectedIndex];
    var selectedText = selectedOption ? (selectedOption.textContent || '').trim() : '';
    versionInput.setSelectedText(versionInput.hasText(selectedText) ? selectedText : '');
  };

  versionInput.dataList.classList.add('project-version-input');
  versionInput.input.classList.add('project-version-input');
  versionInput.input.required = !isFilter;

  projectVersionSelect.style.display = 'none';
  versionInput.insert(<HTMLElement> projectVersionSelect.parentElement, projectVersionSelect);

  projectVersionSelect.addEventListener('change', updateVersionInput);

  new MutationObserver(function () {
    isPicked = false;
    updateVersionInput();
  }).observe(projectVersionSelect, {
    childList: true,
    subtree: true,
  });

  updateVersionInput();

  if (!isReplacement) {
    Liferay.fire('projectVersionIdReady');
  }
}

/**
 * Returns a pattern that matches the project versions of the given
 * product, or null if the fixes list does not filter the versions of
 * the product.
 */

function getProductProjectVersionPattern(productVersionText: string): RegExp | null {
  var fixPackNames: {[key: string]: string} = {
    'DXP 7.0': 'de-[0-9]+-7010',
    'DXP 7.1': 'dxp-[0-9]+-7110',
    'DXP 7.2': 'dxp-[0-9]+-7210',
    'DXP 7.3': 'dxp-[0-9]+-7310'
  };

  if (fixPackNames[productVersionText]) {
    return new RegExp('^fix-pack-' + fixPackNames[productVersionText] + '(-private)?$');
  }

  if (productVersionText == 'DXP 7.4') {
    return /^7\.4\.13-u[0-9]+$/;
  }

  if (productVersionText == 'Quarterly Releases') {
    return /[0-9]{4}\.q[0-9]+\.[0-9]+/;
  }

  return null;
}

/**
 * Returns the URL of the builds list of the current account, with the
 * given filters changed. A filter with an empty value is removed, and
 * the list starts again on the first page. The URL is an advanced search,
 * which finds nothing with a keywords parameter, so the keywords (the
 * ones of the keywords search input, or else the ones of the current URL)
 * become the build name instead.
 */

function getAccountBuildsListURL(filters: {[key: string]: string | null}): string {
  var params = new URLSearchParams(getPageParameters().toString());

  params.set(ns + 'advancedSearch', 'true');
  params.set(ns + 'andOperator', 'true');
  params.delete(ns + 'cur');

  // Keeps the keywords that the user typed after the page loaded, as the
  // build name of the advanced search.
  var keywords = (document.getElementsByName(ns + 'keywords').length > 0) ? getKeywordsInputValue() :
    (params.get(ns + 'keywords') || params.get(ns + 'patcherBuildName') || '');

  params.delete(ns + 'keywords');

  if (keywords) {
    params.set(ns + 'patcherBuildName', keywords);
  }
  else {
    params.delete(ns + 'patcherBuildName');
  }

  Object.keys(filters).forEach(function (key) {
    if (filters[key]) {
      params.set(ns + key, filters[key]!);
    }
    else {
      params.delete(ns + key);
    }
  });

  return 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher/accounts/view?' + params.toString();
}

/**
 * Returns the value of the given namespaced parameter of the current page
 * (see getPageParameters), or null if the page does not have it.
 */

function getNamespacedParameter(name: string): string | null {
  return getPageParameters().get(ns + name);
}

/**
 * Returns whether the given product version text is the product that a
 * pick of the given broad Liferay version selects, for example DXP 7.3
 * for 7.3, and Quarterly Releases for Quarterly.
 */

function isDefaultProductVersionText(liferayVersion: string, productVersionText: string): boolean {
  return (liferayVersion == 'Quarterly') ?
    (productVersionText.trim() == 'Quarterly Releases') :
    (productVersionText.trim() == 'DXP ' + liferayVersion);
}

/**
 * Returns the URL of the current list with the given filters changed (a
 * null value removes the filter), on the first page: for the builds list
 * of an account, the builds of the account (see getAccountBuildsListURL),
 * and for another list, the current URL with the filters changed.
 */

function getListFilterURL(filters: {[key: string]: string | null}): string {
  if (document.location.pathname.indexOf('/accounts/view') != -1) {
    return getAccountBuildsListURL(filters);
  }

  var params = new URLSearchParams(getPageParameters().toString());

  params.delete(ns + 'cur');

  Object.keys(filters).forEach(function (key) {
    var value = filters[key];

    if (value) {
      params.set(ns + key, value);
    }
    else {
      params.delete(ns + key);
    }
  });

  return document.location.origin + document.location.pathname + '?' + params.toString();
}

/**
 * The columns of the tables of a list whose values become links to the list
 * filtered by that value (see addFilterColumnLinks): the header of the
 * column, the name of the select of the page whose options give the value
 * of each text, and the URL of a value. A project version filter is an
 * advanced search. A product filter removes the project version filter,
 * since a project version belongs to one product.
 */

var filterColumns = [
  {
    header: 'Project Version',
    selectName: 'patcherProjectVersionIdFilter',
    getURL: function (value: string) {
      return getListFilterURL({advancedSearch: 'true', patcherProjectVersionIdFilter: value});
    }
  },
  {
    header: 'Product',
    selectName: 'patcherProductVersionId',
    getURL: function (value: string) {
      return getListFilterURL({patcherProductVersionId: value, patcherProjectVersionIdFilter: null});
    }
  }
];

/**
 * Turns the values of the filter columns (see filterColumns) of the tables
 * of a list (for example the Product and Project Version columns of the
 * fixes list, or the Project Version column of the builds list of an
 * account) into links to the list filtered by that value. The value of a
 * cell is the option of the select of the column with the same text (the
 * select with the most options, if the page has more than one), and a
 * cell without such an option, or that already has a link, stays as it
 * is. The links send no Referer header, the same as the pagination links
 * (see addNoReferrerToPaginationLinks). Since the table can be created again (for example by the
 * search container of the portlet), the cells are checked again whenever
 * the page changes.
 */

function addFilterColumnLinks(): void {
  var getValues = function (selectName: string) {
    var select = (<HTMLSelectElement[]> Array.from(document.getElementsByName(ns + selectName)).filter(function (element) {
      return element.tagName == 'SELECT';
    })).sort(function (a, b) {
      return b.options.length - a.options.length;
    })[0];

    var values: {[key: string]: string} = {};

    if (select) {
      Array.from(select.options).forEach(function (option) {
        var text = (option.textContent || '').trim();

        if ((option.value != '') && (option.value != '0') && text) {
          values[text] = option.value;
        }
      });
    }

    return values;
  };

  var update = function () {
    filterColumns.forEach(function (column) {
      var values = getValues(column.selectName);

      if (Object.keys(values).length == 0) {
        return;
      }

      Array.from(document.querySelectorAll('table')).forEach(function (table) {
        var index = Array.from(table.querySelectorAll('thead th')).findIndex(function (headerCell) {
          return (headerCell.textContent || '').trim() == column.header;
        });

        if (index == -1) {
          return;
        }

        Array.from(table.querySelectorAll('tbody tr')).forEach(function (row) {
          var cell = (<HTMLTableRowElement> row).cells[index];

          if (!cell || (cell.children.length > 0)) {
            return;
          }

          var text = (cell.textContent || '').trim();
          var value = values[text];

          if (!value) {
            return;
          }

          var link = document.createElement('a');
          link.href = column.getURL(value);
          link.textContent = text;
          link.title = 'Show only ' + text;
          link.setAttribute('rel', 'noreferrer');
          link.setAttribute('referrerpolicy', 'no-referrer');

          cell.textContent = '';
          cell.appendChild(link);
        });
      });
    });
  };

  update();

  new MutationObserver(<MutationCallback> debounce(update, 300)).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * A keyword search of the fixes list ignores the project version filter.
 * If a project version is selected, the search becomes an advanced search
 * with the keywords as the fix name, also when the keywords are empty.
 * After an advanced search, the keywords input shows that fix name.
 */

function addKeywordsProjectVersionFilter(): void {
  var keywordsElement = <HTMLInputElement | null> document.getElementById('toggle_id_patcher_fix_searchkeywords');

  if (!keywordsElement || !keywordsElement.form) {
    return;
  }

  var form = keywordsElement.form;
  var isAdvancedSearch = getNamespacedParameter('advancedSearch') == 'true';
  var patcherFixName = getNamespacedParameter('patcherFixName');

  if (isAdvancedSearch && patcherFixName && !keywordsElement.value) {
    keywordsElement.value = patcherFixName;
  }

  document.addEventListener('submit', function (event) {
    if (event.target != form) {
      return;
    }

    var advancedSearchElement = <HTMLInputElement> (<any> form.elements)[ns + 'advancedSearch'];
    var patcherFixNameElement = <HTMLInputElement> (<any> form.elements)[ns + 'patcherFixName'];
    var projectVersionSelect = <HTMLSelectElement> (<any> form.elements)[ns + 'patcherProjectVersionIdFilter'];

    if (!advancedSearchElement || !patcherFixNameElement || !projectVersionSelect || !projectVersionSelect.value) {
      return;
    }

    // With the two search modes (see enhanceSearchToggle), the keywords
    // are disabled in the advanced search, and the project version is
    // disabled in the basic search, which then stays a basic search.
    if (keywordsElement!.disabled || projectVersionSelect.disabled) {
      return;
    }

    advancedSearchElement.value = 'true';
    patcherFixNameElement.value = keywordsElement!.value.trim();
    keywordsElement!.value = '';
  }, true);
}

function addProjectVersionFilter(
  productVersionSelect: HTMLSelectElement,
  selectedVersion : string
) : void {

  var projectVersionSelect = <HTMLSelectElement> querySelector('patcherProjectVersionId');

  if (projectVersionSelect) {
    return;
  }

  var projectVersionSelectFilter = <HTMLSelectElement | null> querySelector('patcherProjectVersionIdFilter');

  if (!projectVersionSelectFilter) {
    return;
  }

  projectVersionSelect = <HTMLSelectElement> projectVersionSelectFilter.cloneNode(true);

  pruneProjectVersionOptions(projectVersionSelect, selectedVersion);

  groupAndSortOptions(projectVersionSelect);

  var versionContainer = <HTMLElement> productVersionSelect.parentElement;
  versionContainer.appendChild(projectVersionSelect);

  addProjectVersionFilterInput(projectVersionSelect);

  var advancedSearchElement = <HTMLInputElement> document.getElementById('toggle_id_patcher_fix_searchadvancedSearch');

  var re = new RegExp(ns + 'patcherProjectVersionIdFilter=(\\d+)');
  var match = re.exec(document.location.search);

  if (match) {
    var patcherProjectVersionId = match[1];
    var option = <HTMLOptionElement | null> projectVersionSelect.querySelector('option[value="' + patcherProjectVersionId + '"]');

    if (option) {
      option.selected = true;
      advancedSearchElement.value = 'true';
    }
    else {
      var parameterString = ns + 'patcherProjectVersionIdFilter=' + patcherProjectVersionId + '&';
      document.location.search = document.location.search.replace(parameterString, '');
    }
  }

  var keywordsElement = <HTMLInputElement> document.getElementById('toggle_id_patcher_fix_searchkeywords');

  re = new RegExp(ns + 'patcherFixName=([^&]+)');
  match = re.exec(document.location.search);

  if (match) {
    keywordsElement.value = match[1];
  }

  projectVersionSelect.addEventListener('change', function() {
    document.location.href = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher?' +
      getQueryString({
        'advancedSearch': 'true',
        'andOperator': 'true',
        'statusFilter': '100',
        'patcherFixName': '',
        'patcherProductVersionId': productVersionSelect.options[productVersionSelect.selectedIndex].value,
        'patcherProjectVersionIdFilter': projectVersionSelect.options[projectVersionSelect.selectedIndex].value
      })
  });
}

/**
 * Converts the tag name into a seven digit version number that can be
 * used for sorting. First four digits are the base version (7010, 7110),
 * and the remander are the fix pack level.
 */

function getLiferayVersion(version: string) : number {
  if (version.trim() == '') {
    return 0;
  }
  else if (version.indexOf('marketplace-') != -1) {
    // The suffix is the four digit version at the end (before -private),
    // since the name of the app can also have -private in it (for example
    // marketplace-social-private-messaging-1.0.0-7010).
    var suffixMatcher = /-([0-9]{4})(?:-private)?$/.exec(version);
    return suffixMatcher ? parseInt(suffixMatcher[1]) * 1000 : 0;
  }
  else if (version.indexOf('fix-pack-de-') != -1) {
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
  else if (version.indexOf('-ga1') != -1) {
    var shortVersionMatcher = <RegExpExecArray> /^([0-9]*)\.([0-9]*)\.([0-9]*)/.exec(version);
    var shortVersion = shortVersionMatcher[1] + shortVersionMatcher[2];
    return parseInt(shortVersion) * 100 * 1000 + parseInt(shortVersionMatcher[3]);
  }
  else if (version.indexOf('-u') != -1) {
    var shortVersionMatcher = <RegExpExecArray> /[0-9]*\.[0-9]\.[0-9]+/.exec(version);
    var shortVersion = shortVersionMatcher[0].replace(/\./g, '');
    var updateVersionMatcher = <RegExpExecArray> /-u([0-9]*)/.exec(version);
    var updateVersion = updateVersionMatcher[1];
    return parseInt(shortVersion) * 1000 + parseInt(updateVersion);
  }
  else if (version.indexOf('.q') != -1) {
    var shortVersionMatcher = <RegExpExecArray> /([0-9][0-9][0-9][0-9])\.q([0-9])\.([0-9]*)/.exec(version);
    var shortVersion = shortVersionMatcher[1] + shortVersionMatcher[2];
    var updateVersion = shortVersionMatcher[3];
    return 8000000 + parseInt(shortVersion) * 100 + parseInt(updateVersion);
  }
  else {
    return 0;
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

  var aValue = getLiferayVersion((a.textContent || '').trim());
  var bValue = getLiferayVersion((b.textContent || '').trim());

  if (aValue != bValue) {
    return aValue - bValue;
  }

  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Formats a 4-digit version suffix (e.g. "7010") to its semantic version
 * counterpart (e.g. "7.0.10").
 */

function formatSuffixVersion(suffix: string) : string {
  var first = parseInt(suffix.charAt(0));
  var second = parseInt(suffix.charAt(1));
  var lastTwo = parseInt(suffix.substring(2));

  if ((first == 7) && (second <= 3)) {
    return first + '.' + second + '.10';
  }

  return first + '.' + second + '.' + lastTwo;
}

/**
 * Returns the corresponding option group label for a given version string.
 * Supports quarterly releases, 6.1, 6.2, 7.4.13, suffix-based fix packs,
 * and suffix-based marketplace releases.
 */

function getOptionGroup(optionText: string) : string | null {
  if (optionText === '') {
    return null;
  }

  // Quarterly Release
  var qMatcher = /([0-9]{4})\.q([0-9]+)/.exec(optionText);
  if (qMatcher) {
    return qMatcher[0];
  }

  // Marketplace
  if (optionText.indexOf('marketplace-') === 0) {
    var suffixMatcher = /-([0-9]{4})(?:-private)?$/.exec(optionText);
    if (suffixMatcher) {
      return formatSuffixVersion(suffixMatcher[1]) + ' Marketplace';
    }
    return 'Marketplace';
  }

  // Fix Pack
  if (optionText.indexOf('fix-pack-') === 0) {
    var suffixMatcher = /-([0-9]{4})(?:-private)?$/.exec(optionText);
    if (suffixMatcher) {
      return formatSuffixVersion(suffixMatcher[1]);
    }
    return 'Fix Pack';
  }

  // 6.x
  if (optionText.indexOf('6.1') === 0) {
    return '6.1';
  }

  if (optionText.indexOf('6.2') === 0) {
    return '6.2';
  }

  // 7.4
  if (optionText.indexOf('7.4') !== -1) {
    return '7.4.13';
  }

  return null;
}

/**
 * Groups and sorts select options under <optgroup> elements, sorting all
 * options/optgroups appropriately, and updating the select's DOM structure.
 * The select keeps its selected option, since removing the options makes
 * the browser select the first option that is added back.
 */

function groupAndSortOptions(select: HTMLSelectElement): void {
  var selectedIndex = select.selectedIndex;
  var selectedOption = (selectedIndex == -1) ? null : select.options[selectedIndex];
  var options = Array.from(select.options);
  options.sort(compareLiferayVersions);

  select.innerHTML = '';

  var optgroupsMap: Record<string, HTMLOptGroupElement> = {};

  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionText = (option.textContent || '').trim();
    var optionGroup = getOptionGroup(optionText);

    if (optionGroup) {
      var optgroup = optgroupsMap[optionGroup];
      if (!optgroup) {
        optgroup = document.createElement('optgroup');
        optgroup.setAttribute('label', optionGroup);
        optgroupsMap[optionGroup] = optgroup;
        select.appendChild(optgroup);
      }
      optgroup.appendChild(option);
    } else {
      select.appendChild(option);
    }
  }

  if (selectedOption) {
    selectedOption.selected = true;
  } else {
    select.selectedIndex = -1;
  }
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

  groupAndSortOptions(projectVersionSelect);

  var event = document.createEvent('HTMLEvents');
  event.initEvent('change', false, true);
  projectVersionSelect.dispatchEvent(event);
}

/**
 * Some pages have their own project version filter select (used to
 * filter the list of fixes/builds via advanced search) that isn't
 * created by addProjectVersionFilter, so it never gets sorted by
 * updateProjectVersionOrder, or given a text filter input. There can be
 * more than one element sharing this name, since addProjectVersionFilter
 * clones it without renaming the clone, so every matching select is
 * sorted and given a filter input here.
 */

function sortProjectVersionIdFilterSelects() : void {
  var elements = document.getElementsByName(ns + 'patcherProjectVersionIdFilter');

  for (var i = 0; i < elements.length; i++) {
    var select = <HTMLSelectElement> elements[i];
    
    groupAndSortOptions(select);

    addProjectVersionFilterInput(select);
  }
}

/**
 * Returns the option that should be auto-selected in the product version
 * select for the given Liferay version.
 */

function getDefaultProductVersionOption(
  productVersionSelect : HTMLSelectElement,
  liferayVersion : string
) : HTMLOptionElement | null {

  return <HTMLOptionElement | null> productVersionSelect.querySelector('option[data-liferay-version="' + liferayVersion + '"]');
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
      if (isDefaultProductVersionText(liferayVersion, selectedOptionText)) {
        setTimeout(updateProjectVersionOrder, 500);
      }

      return;
    }
  }

  var option = getDefaultProductVersionOption(productVersionSelect, liferayVersion);

  if (option) {
    option.selected = true;
    unsafeWindow._1_WAR_osbpatcherportlet_productVersionOnChange(option.value);
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

  if (productVersionSelect) {
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
  }

  var projectVersionSelect = querySelector('patcherProjectVersionId');

  if (projectVersionSelect) {
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

  var autoFixCheckbox = <HTMLInputElement | null> querySelector('autoFixCheckbox');

  for (var inputName of ['committish', 'gitRemoteURL']) {
    var input = <HTMLInputElement | null> querySelector(inputName);
    if (!input) {
      continue;
    }

    re = new RegExp(ns + inputName + '=([^&]+)');
    match = re.exec(document.location.search);

    if (!match) {
      continue;
    }

    if (autoFixCheckbox && autoFixCheckbox.checked) {
      autoFixCheckbox.click();
    }

    input.value = match[1];
  }
}