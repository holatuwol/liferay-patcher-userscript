var AUI = <AUI> unsafeWindow.AUI;
var Liferay = <Liferay> unsafeWindow.Liferay;
var portletId = '1_WAR_osbpatcherportlet';
var ns = '_' + portletId + '_';

/**
 * Standard implementation of debounce.
 */

function debounce(func: Function, delay: number): Function {
  let timeoutId: number;
  return function(...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function() {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Utility function to wait for the given parent to have the given selector available.
 */

async function waitForElement(selector: string): Promise<Element> {
	return new Promise(function(resolve) {
		var observerCallback = <MutationCallback> debounce(function() {
			const result = selector.indexOf(ns) != -1 ? document.querySelector(selector) : querySelector(selector);
			if (result) {
				observer.disconnect();
				resolve(result);
			}
		}, 500);

		const observer = new MutationObserver(observerCallback);

		observerCallback([], observer);

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	})
}

/**
 * Utility function to convert an object into a query string with namespaced
 * parameter names.
 */

function getQueryString(params : any) : string {
  return Object.keys(params).map(key => (key.indexOf('p_p_') == 0 ? key : (ns + key)) + '=' + params[key]).join('&');
}

/**
 * Leaves out the blank fields of a form that the browser submits with GET,
 * since their names alone can make the URL too long. This runs when the
 * browser collects the fields of the form for the submit (the formdata
 * event), so the fields of the form stay as they are, and it also covers
 * a submit by a script of the page (form.submit()). Fields with their
 * default value (hide old fix versions) are left out too, but not when the
 * checkbox is cleared, since then the value is false. A simple search with
 * a status becomes an advanced search, and an advanced search sends its
 * keywords as the build name or the fix name, since it finds nothing with
 * keywords. Forms submitted with POST are left alone, since their fields
 * are not in the URL.
 */

function removeEmptyGetFormFields(): void {
  document.addEventListener('formdata', function (event) {
    var form = <HTMLFormElement> event.target;
    // TypeScript 3.6 has no types for the formdata event.
    var formData = <any> (<any> event).formData;

    if (!form || !formData || !isGetForm(form)) {
      return;
    }

    var entries: [string, FormDataEntryValue][] = [];

    formData.forEach(function (value: FormDataEntryValue, name: string) {
      entries.push([name, value]);
    });


    // Parameters that have their default value can be left off as well.
    var defaultValues: {[key: string]: string} = {};
    defaultValues[ns + 'hideOldFixVersions'] = 'true';
    defaultValues[ns + 'hideOldFixVersionsCheckbox'] = 'true';

    var names = entries.map(function (entry) {
      return entry[0];
    }).filter(function (name, index, array) {
      return array.indexOf(name) == index;
    });

    names.forEach(function (name) {
      var values = entries.filter(function (entry) {
        return entry[0] == name;
      }).map(function (entry) {
        return entry[1];
      });

      var nonEmptyValues = values.filter(function (value) {
        return (typeof value != 'string') || ((value != '') && (value != defaultValues[name]));
      });

      if (nonEmptyValues.length == values.length) {
        return;
      }

      formData.delete(name);

      nonEmptyValues.forEach(function (value) {
        formData.append(name, value);
      });
    });

    // A simple search ignores the status filter, so a search with a status
    // becomes an advanced search.
    if (String(formData.get(ns + 'statusFilter') || '') && (formData.get(ns + 'advancedSearch') == 'false')) {
      formData.set(ns + 'advancedSearch', 'true');
    }

    // An advanced search finds nothing with keywords, so the keywords
    // become the name field of the search, if it is empty: the build name
    // for builds (for example the builds list of an account), and the fix
    // name for fixes.
    if ((formData.get(ns + 'advancedSearch') == 'true') && formData.has(ns + 'keywords')) {
      var keywords = String(formData.get(ns + 'keywords') || '').trim();

      var hasField = function (name: string) {
        return Array.from(form.elements).some(function (element) {
          return (<HTMLInputElement> element).name == ns + name;
        });
      };

      var nameField = ns + (hasField('patcherBuildName') ? 'patcherBuildName' :
        hasField('patcherFixName') ? 'patcherFixName' :
        (document.location.pathname.indexOf('/accounts') != -1) ? 'patcherBuildName' : 'patcherFixName');

      formData.delete(ns + 'keywords');

      if (keywords && !String(formData.get(nameField) || '').trim()) {
        formData.set(nameField, keywords);
      }
    }
  }, true);
}

/**
 * Returns whether the given form submits with GET, the default method.
 */

function isGetForm(form: HTMLFormElement): boolean {
  return (form.getAttribute('method') || 'get').toLowerCase() == 'get';
}

/**
 * Sets the referrer policy of the page to no-referrer, so that the
 * requests that follow send no Referer header.
 */

function setNoReferrerPolicy(): void {
  var meta = <HTMLMetaElement | null> document.querySelector('meta[name="referrer"]');

  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'referrer';
    document.head.appendChild(meta);
  }

  meta.content = 'no-referrer';
}

/**
 * Makes the forms that submit with GET send no Referer header, since the
 * URL of the current page can be long enough that the request is too large
 * for the server. The forms get the noreferrer link type of the rel
 * attribute, but Chromium ignores it on forms, so a GET submit also sets
 * the referrer policy of the page (see setNoReferrerPolicy) just before the
 * browser loads the next page: on the submit event of a submit button, and
 * on the formdata event of a submit by a script (form.submit()), which has
 * no submit event. Forms submitted with POST are left alone.
 */

function addNoReferrerToGetForms(): void {
  var addNoReferrer = function (form: HTMLFormElement) {
    if (!isGetForm(form)) {
      return;
    }

    var rel = (form.getAttribute('rel') || '').split(/\s+/).filter(function (value) {
      return value != '';
    });

    if (rel.indexOf('noreferrer') == -1) {
      rel.push('noreferrer');
      form.setAttribute('rel', rel.join(' '));
    }
  };

  Array.from(document.forms).forEach(addNoReferrer);

  var onSubmit = function (event: Event) {
    if ((event.target instanceof HTMLFormElement) && isGetForm(event.target)) {
      addNoReferrer(event.target);
    }
  };

  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('formdata', onSubmit, true);
}

/**
 * Makes the pagination links of the search containers of the page send no
 * Referer header, the same as the forms (see addNoReferrerToGetForms),
 * since the URL of the current page can be long enough that the request
 * is too large for the server. A pagination link is a link in a page
 * iterator (the page and items per page menus, and the first, previous,
 * next and last links), or a link to a page or a number of items per page
 * of a list (the cur and delta parameters). The links of the page get it
 * when the page is ready, and a link that the portlet adds later (for
 * example when it renders a menu again) gets it when it is clicked,
 * before the browser follows it.
 */

function addNoReferrerToPaginationLinks(): void {
  var paginationPattern = new RegExp('[?&]' + ns + '(cur|delta)=');

  var isPaginationLink = function (link: HTMLAnchorElement) {
    return !!link.closest('.taglib-page-iterator, .lfr-pagination') || paginationPattern.test(link.href);
  };

  var addNoReferrer = function (link: HTMLAnchorElement) {
    var rel = (link.getAttribute('rel') || '').split(/\s+/).filter(function (value) {
      return value != '';
    });

    if (rel.indexOf('noreferrer') == -1) {
      rel.push('noreferrer');
      link.setAttribute('rel', rel.join(' '));
    }

    link.setAttribute('referrerpolicy', 'no-referrer');
  };

  Array.from(document.querySelectorAll('a[href]')).forEach(function (link) {
    if (isPaginationLink(<HTMLAnchorElement> link)) {
      addNoReferrer(<HTMLAnchorElement> link);
    }
  });

  var onActivate = function (event: Event) {
    var link = <HTMLAnchorElement | null> ((event.target instanceof Element) ? event.target.closest('a[href]') : null);

    if (link && isPaginationLink(link)) {
      addNoReferrer(link);
    }
  };

  ['mousedown', 'click', 'auxclick'].forEach(function (type) {
    document.addEventListener(type, onActivate, true);
  });
}

/**
 * Returns the parameters of the query string of the current page.
 */

function getPageParameters(): URLSearchParams {
  return new URLSearchParams(document.location.search);
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

  var dateString = new Date(oldDateText.trim() + ' UTC').toString();

  if (dateString.indexOf(':') != -1) {
    dateNode.textContent = dateString;
  }
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

  var ticketURL = 'https://liferay.atlassian.net/browse/' + ticket;

  if (className) {
  	var productVersionElement = <HTMLSelectElement> querySelector('patcherProductVersionId');
    var productVersionId = productVersionElement.value;
    var projectVersionElement = <HTMLSelectElement> querySelector('patcherProjectVersionId');
    var projectVersionId = projectVersionElement.value;

    var params = {
      advancedSearch: true,
      andOperator: true,
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

var spinnerMax = 0;
var spinnerCurrent = 0;

/**
 * Adds a spinner
 */
function addSpinner(max?: number) {
    var spinnerOverlay = document.createElement('div');
    spinnerOverlay.setAttribute('id', 'spinner-overlay');
    spinnerOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(255, 255, 255, 0.7); /* Semi-transparent background */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999; /* Ensures it sits above other content */
        transition: opacity 0.2s ease-in-out;
      `;

    var spinnerContainer = document.createElement('div');
    spinnerContainer.style.cssText = `
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    `;

    var spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 80px;
        height: 80px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db; /* Color of spinning arc */
        border-radius: 50%;
        animation: spin 1s linear infinite;
      `;

    spinnerContainer.appendChild(spinner);

    if (max !== undefined && max !== null) {
        spinnerMax = max;
        spinnerCurrent = 0;

        var spinnerProgress = document.createElement('div');
        spinnerProgress.setAttribute('id', 'spinner-progress');
        spinnerProgress.style.cssText = `
            position: absolute;
            font-family: sans-serif;
            font-size: 14px;
            font-weight: bold;
            color: #333;
        `;
        spinnerProgress.textContent = `0/${max}`;
        spinnerContainer.appendChild(spinnerProgress);
    }

    spinnerOverlay.appendChild(spinnerContainer);

    document.body.appendChild(spinnerOverlay);
}

/**
 * Updates the spinner progress
 */
function updateSpinner(step: number = 1) {
    spinnerCurrent += step;
    var spinnerProgress = document.getElementById('spinner-progress');
    if (spinnerProgress) {
        spinnerProgress.textContent = `${spinnerCurrent}/${spinnerMax}`;
    }
}

/**
 * Adds a spinner
 */
function removeSpinner() {
  var spinnerOverlay = document.getElementById('spinner-overlay');
  if (!spinnerOverlay) {
    return;
  }

  spinnerOverlay.remove();
}