declare interface AUI {
    () : any;
}

interface Liferay {
    Service: any;
    Language: any;
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

interface FixPackMetadata {
	tag: string;
	name: string;
	versionId: string;
}