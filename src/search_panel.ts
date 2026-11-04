/**
 * Gives the blank option of the given select the text All, so that the
 * select (and the text input of a project version filter select, see
 * getProjectVersionTexts) says what the blank option means.
 */

function labelBlankOption(select: HTMLSelectElement | null): void {
  if (!select) {
    return;
  }

  var option = Array.from(select.options).find(function (option) {
    return option.value == '';
  });

  if (option && !(option.textContent || '').trim()) {
    option.textContent = 'All';
  }
}

/**
 * Turns the search toggle of a list (the keywords input with the popover
 * of the advanced search, for example the fixes list or the builds list of
 * an account) into a search with two modes:
 *
 * - The advanced search, the default, shows the fields that people
 *   usually search with in a row in the page: the account fields (fields
 *   whose name has account in it), the name (Content for fixes), the
 *   project version and the patcher status, with a Search button. The
 *   other fields of the advanced search (for example Fix ID, Type, Match
 *   All or Any, Hide Old Fix Versions) are under More options, which is
 *   closed at the start.
 * - The basic search is the keywords input of the portlet, without the
 *   advanced search.
 *
 * A link switches between the two. A page starts in the advanced search,
 * except a page that a basic search loaded (keywords without an advanced
 * search in the URL), which starts in the basic search. The
 * fields stay the fields of the form of the portlet, and the fields of
 * the mode that is not shown are disabled, so that the form only submits
 * the fields of the mode that is shown, the same as the popover does.
 * Returns whether the toggle has the two modes.
 */

function enhanceSearchToggle(toggle: HTMLElement): boolean {
  if (toggle.querySelector('.patcher-search-panel')) {
    return true;
  }

  var simple = <HTMLElement | null> toggle.querySelector('[id$="searchsimple"]');
  var advanced = <HTMLElement | null> toggle.querySelector('.taglib-search-toggle-advanced');
  var body = advanced ? <HTMLElement | null> advanced.querySelector('[id$="advancedBodyNode"]') : null;
  var advancedSearchInput = advanced ? <HTMLInputElement | null> advanced.querySelector('input[name="' + ns + 'advancedSearch"]') : null;
  var keywordsInput = simple ? <HTMLInputElement | null> simple.querySelector('input[name="' + ns + 'keywords"]') : null;

  if (!simple || !advanced || !body || !advancedSearchInput || !keywordsInput) {
    return false;
  }

  var groups = (<HTMLElement[]> Array.from(body.querySelectorAll('.control-group')));

  var findGroup = function (names: string[]) {
    return groups.find(function (group) {
      return names.some(function (name) {
        return !!group.querySelector('[name="' + ns + name + '"]');
      });
    });
  };

  // The account fields (for example the account code of the builds list of
  // an account) come first, before the name.
  var accountGroups = groups.filter(function (group) {
    return Array.from(group.querySelectorAll('input, select')).some(function (field) {
      var element = <HTMLInputElement> field;
      return (element.type != 'hidden') && /account/i.test(element.name.replace(ns, ''));
    });
  });

  var nameGroup = findGroup(['patcherFixName', 'patcherBuildName']);

  var primaryGroups = <HTMLElement[]> accountGroups.concat(<HTMLElement[]> [nameGroup, findGroup(['patcherProjectVersionIdFilter']), findGroup(['statusFilter'])].filter(function (group) {
    return !!group && (accountGroups.indexOf(group) == -1);
  }));

  if (primaryGroups.length == 0) {
    return false;
  }

  var secondaryGroups = groups.filter(function (group) {
    return primaryGroups.indexOf(group) == -1;
  });

  ['patcherProjectVersionIdFilter', 'statusFilter', 'typeFilter'].forEach(function (name) {
    labelBlankOption(<HTMLSelectElement | null> body!.querySelector('select[name="' + ns + name + '"]'));
  });

  // The Match select has its label in the text around it.
  var andOperatorGroup = findGroup(['andOperator']);

  if (andOperatorGroup && !andOperatorGroup.querySelector('label')) {
    var andOperatorLabel = document.createElement('label');
    andOperatorLabel.className = 'control-label';
    andOperatorLabel.htmlFor = ns + 'andOperator';
    andOperatorLabel.textContent = 'Match';
    andOperatorGroup.insertBefore(andOperatorLabel, andOperatorGroup.firstChild);
  }

  // The panel of the advanced search.

  var panel = document.createElement('div');
  panel.className = 'patcher-search-panel';

  primaryGroups.forEach(function (group) {
    panel.appendChild(group);
  });

  var actions = document.createElement('div');
  actions.className = 'patcher-search-actions';
  panel.appendChild(actions);

  var searchButton = document.createElement('button');
  searchButton.className = 'btn btn-primary';
  searchButton.type = 'submit';
  searchButton.textContent = 'Search';
  actions.appendChild(searchButton);

  var secondary = document.createElement('div');
  secondary.className = 'patcher-search-secondary';

  secondaryGroups.forEach(function (group) {
    secondary.appendChild(group);
  });

  var createLink = function (text: string) {
    var link = document.createElement('a');
    link.href = '#';
    link.setAttribute('role', 'button');
    link.className = 'patcher-search-link';
    link.textContent = text;
    return link;
  };

  var moreLink = createLink('More options');

  var setSecondaryShown = function (isShown: boolean) {
    secondary.style.display = isShown ? '' : 'none';
    moreLink.textContent = isShown ? 'Fewer options' : 'More options';
    moreLink.setAttribute('aria-expanded', String(isShown));
  };

  if (secondaryGroups.length > 0) {
    actions.appendChild(moreLink);
    panel.appendChild(secondary);

    moreLink.addEventListener('click', function (event) {
      event.preventDefault();
      setSecondaryShown(secondary.style.display == 'none');
    });
  }

  var basicLink = createLink('Basic search');
  actions.appendChild(basicLink);

  toggle.insertBefore(panel, advanced);

  // The popover of the portlet is no longer used: its fields are in the
  // panel, and the keywords input gets a link to the panel instead.

  advanced.style.display = 'none';

  var toggleAdvanced = <HTMLElement | null> simple.querySelector('[id$="toggleAdvanced"]');

  if (toggleAdvanced) {
    toggleAdvanced.style.display = 'none';
  }

  // The link goes after the keywords input and its button, outside of
  // their input-append, which has a font size of zero in the styles of
  // the portlet, so that a link in it would not show.
  var advancedLink = createLink('Advanced search');
  advancedLink.classList.add('patcher-search-advanced-link');
  (<HTMLElement> simple.parentElement).insertBefore(advancedLink, simple.nextSibling);

  // The arrow keys in the keywords input open the popover, which would
  // also turn the basic search into an advanced search.
  document.addEventListener('keydown', function (event) {
    if ((event.target == keywordsInput) && ((event.key == 'ArrowUp') || (event.key == 'ArrowDown'))) {
      event.stopImmediatePropagation();
    }
  }, true);

  setSecondaryShown(false);

  var nameField = nameGroup ? <HTMLInputElement | null> nameGroup.querySelector('input[type="text"]') : null;

  var setMode = function (mode: string) {
    var isAdvanced = mode == 'advanced';

    // The text moves to the field of the other mode, if that one is empty.
    if (nameField && isAdvanced && !nameField.value.trim() && keywordsInput!.value.trim()) {
      nameField.value = keywordsInput!.value.trim();
    }
    else if (nameField && !isAdvanced && !keywordsInput!.value.trim() && nameField.value.trim()) {
      keywordsInput!.value = nameField.value.trim();
    }

    panel.style.display = isAdvanced ? '' : 'none';
    simple!.style.display = isAdvanced ? 'none' : '';
    advancedLink.style.display = isAdvanced ? 'none' : '';
    keywordsInput!.disabled = isAdvanced;
    advancedSearchInput!.value = String(isAdvanced);

    Array.from(panel.querySelectorAll('input, select, textarea')).forEach(function (field) {
      (<HTMLInputElement> field).disabled = !isAdvanced;
    });
  };

  basicLink.addEventListener('click', function (event) {
    event.preventDefault();
    setMode('basic');
    keywordsInput!.focus();
  });

  advancedLink.addEventListener('click', function (event) {
    event.preventDefault();
    setMode('advanced');

    if (nameField) {
      nameField.focus();
    }
  });

  var params = getPageParameters();
  var isBasicSearchPage = (params.get(ns + 'advancedSearch') == 'false') && !!(params.get(ns + 'keywords') || '').trim();

  setMode(isBasicSearchPage ? 'basic' : 'advanced');

  // The text input of the project version filter select (see
  // addProjectVersionFilterInput) is added after the panel, so it gets
  // the state of the mode when it is added.
  new MutationObserver(function () {
    var isAdvanced = panel.style.display != 'none';

    Array.from(panel.querySelectorAll('input, select, textarea')).forEach(function (field) {
      if ((<HTMLInputElement> field).disabled == isAdvanced) {
        (<HTMLInputElement> field).disabled = !isAdvanced;
      }
    });
  }).observe(panel, {childList: true, subtree: true});

  return true;
}

/**
 * Adds the two search modes (see enhanceSearchToggle) to the search
 * toggles of the page. Returns whether any search toggle has them.
 */

function enhanceSearchToggles(): boolean {
  var isEnhanced = false;

  Array.from(document.querySelectorAll('.taglib-search-toggle')).forEach(function (toggle) {
    if (enhanceSearchToggle(<HTMLElement> toggle)) {
      isEnhanced = true;
    }
  });

  return isEnhanced;
}
