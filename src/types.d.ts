declare interface AUI {
    () : any;
}

interface Liferay {
    Service: any;
    Language: any;
    authToken: string;
    fire: (string) => void;
    on: (string, Function) => void;
}

interface BuildMetadata {
    buildId: string;
    buildLink: string;
    branchName: string;
    branchType: string;
    fixes: string[]
    fixesHTML: string;
    patcherFixId: string | null;
}

declare function cloneInto(gmObject: any, window: Window) : any;
declare function exportFunction(gmFunction: any, window: Window) : any;
declare var unsafeWindow : globals | Window;

interface GM {
  xmlHttpRequest: Function
}

declare var GM : GM;

interface FixPackMetadata {
	tag: string;
	name: string;
	versionId: string;
}

interface JiraFields {
  versions?: Array<{ name: string }>;
  fixVersions?: Array<{ name: string }>;
  issuelinks?: Array<{ inwardIssue?: { key: string }, outwardIssue?: { key: string } }>;
  customfield_10786?: { value?: string, id?: string } | Array<{ value?: string, id?: string }>;
  customfield_10886?: Array<{ name: string }> | { name?: string };
  priority?: { name?: string, id?: string } | Array<{ name?: string, id?: string }>;
  labels?: string[] | Array<{ name?: string, value?: string }>;
}

interface JiraIssue {
  key: string;
  fields?: JiraFields;
}

interface JiraSearchRequest extends XMLHttpRequest {
  response: {
      issues: JiraIssue[];
      isLast: boolean;
      nextPageToken?: string;
  }
}

interface JiraSecurityStatus {
  severity: string;
  fixVersions: string[];
}