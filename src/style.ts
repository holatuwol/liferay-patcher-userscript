var styleElement = document.createElement('style');

styleElement.textContent = `
a.included-in-baseline,
a.included-in-baseline:hover {
  color: #ddd;
  text-decoration: line-through;
}

.nowrap {
  white-space: nowrap;
}

#_1_WAR_osbpatcherportlet_patcherProductVersionId,
#_1_WAR_osbpatcherportlet_patcherProjectVersionId {
  width: auto;
}

#_1_WAR_osbpatcherportlet_patcherProductVersionId option {
  display: none;
}

#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="6.x"] option[data-liferay-version="6.x"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.0"] option[data-liferay-version="7.0"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.1"] option[data-liferay-version="7.1"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.2"] option[data-liferay-version="7.2"] {
  display: block;
}

#_1_WAR_osbpatcherportlet_patcherBuildName,
#_1_WAR_osbpatcherportlet_patcherFixName {
  height: 5em;
  width: 60em;
}

.control-group.field-wrapper .table,
.control-group.input-select-wrapper .table,
.control-group.input-String-wrapper .table,
.control-group.input-text-wrapper .table {
  margin-bottom: 0.5em;
}

#security-fixes .show-details {
  background-color: #fff;
  font-size: x-small;
  line-height: 0.5em;
  text-align: right;
}

.compact .verbose,
.verbose .compact {
  display: none;
}

th.branch-type,
th.branch-type a {
  font-weight: bold;
  width: 5em;
}

.control-group.field-wrapper,
.control-group.input-select-wrapper,
.control-group.input-String-wrapper,
.control-group.input-text-wrapper {
  display: flex;
  margin-bottom: 0.1em;
}

a[href*="https://grow.liferay.com/"] {
  padding-left: 0.5em;
}

a[href*="https://test-5-2.liferay.com/"] {
  padding-right: 0.5em;
}

a[href*="http://files.liferay.com/"],
a[href*="https://files.liferay.com/"] {
  font-size: x-large;
}

.control-group.field-wrapper .control-label,
.control-group.input-select-wrapper .control-label,
.control-group.input-String-wrapper .control-label,
.control-group.input-text-wrapper .control-label {
  font-weight: bold;
  min-width: 15em;
  width: 15em;
}

#security-fixes dl {
  margin-block-start: 0em;
  margin-block-end: 0em;
  margin-bottom: 0px;
}

/**
 * http://vrl.cs.brown.edu/color
 * 4 colors, lightness between 25 and 85, add alpha of 0.3
 */

tr.qa-analysis-needed.version-6210 td {
  background-color: rgba(79,140,157,0.3) !important;
}

tr.qa-analysis-needed.version-7010 td {
  background-color: rgba(75,214,253,0.3) !important;
}

tr.qa-analysis-needed.version-7110 td {
  background-color: rgba(101,52,102,0.3) !important;
}

tr.qa-analysis-needed.version-7210 td {
  background-color: rgba(131,236,102,0.3) !important;
}

tr.qa-analysis-unneeded {
  opacity: 0.3;
}
`;

document.head.appendChild(styleElement);