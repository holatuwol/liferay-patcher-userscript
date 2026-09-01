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

interface JiraIssue {
  key: string;
  fields?: {
    fixVersions?: Array<{ name: string }>;
  };
}

interface JiraSearchRequest extends XMLHttpRequest {
  response: {
      issues?: JiraIssue[];
  }
}