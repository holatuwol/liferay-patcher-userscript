function addEngineerComments() : void {
  var buildsRegEx = /\/-\/osb_patcher\/builds\/[0-9]+[^\/]*$/;

  if (!buildsRegEx.test(document.location.pathname)) {
    return;
  }

  var commentsURL = document.location.pathname + '/editCommentsField';

  var xhr1 = new XMLHttpRequest();

  xhr1.open('GET', commentsURL, false);

  xhr1.onload = function() {
    // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
    var container1 = document.implementation.createHTMLDocument().documentElement;
    container1.innerHTML = xhr1.responseText;

    var newCommentsElement = document.createElement('div');
    newCommentsElement.classList.add('control-group', 'field-wrapper');

    var newLabelElement = document.createElement('label');
    newLabelElement.classList.add('control-label');
    newLabelElement.textContent = 'Engineer Comments';
    newCommentsElement.appendChild(newLabelElement);

    var commentsElement = <HTMLTextAreaElement> container1.querySelector('#_1_WAR_osbpatcherportlet_comments');
    newCommentsElement.appendChild(document.createTextNode(commentsElement.value || '(none)'));

    var statusLabelElement = <HTMLLabelElement> document.querySelector('label[for="_1_WAR_osbpatcherportlet_status"]');
    var statusElement = <HTMLDivElement> statusLabelElement.parentElement

    statusElement.after(newCommentsElement);
  }

  xhr1.setRequestHeader('Cache-Control', 'no-cache, no-store, max-age=0');
  xhr1.setRequestHeader('Pragma', 'no-cache');

  xhr1.send(null);
}