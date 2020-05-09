interface BuildMetadata {
    buildId: string;
    buildLink: string;
    branchName: string;
    branchType: string;
    fixes: string;
    patcherFixId: string | null;
}

declare function cloneInto(gmObject: any, window: UnsafeWindow) : any;
declare function exportFunction(gmFunction: any, window: UnsafeWindow) : any;

interface FixPackMetadata {
	tag: string;
	name: string;
	versionId: string;
}

interface UnsafeWindow {
  [key: string]: any;
};

declare var unsafeWindow: UnsafeWindow;