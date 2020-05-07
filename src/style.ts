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

th.branch-type,
th.branch-type a {
  font-weight: bold;
  width: 5em;
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