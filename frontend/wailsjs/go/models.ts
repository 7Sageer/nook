export namespace document {
	
	export class Meta {
	    id: string;
	    title: string;
	    folderId?: string;
	    tags?: string[];
	    order: number;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Meta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.folderId = source["folderId"];
	        this.tags = source["tags"];
	        this.order = source["order"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Index {
	    documents: Meta[];
	    activeId: string;
	
	    static createFrom(source: any = {}) {
	        return new Index(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.documents = this.convertValues(source["documents"], Meta);
	        this.activeId = source["activeId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace folder {
	
	export class Folder {
	    id: string;
	    name: string;
	    order: number;
	    createdAt: number;
	    collapsed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.order = source["order"];
	        this.createdAt = source["createdAt"];
	        this.collapsed = source["collapsed"];
	    }
	}

}

export namespace main {
	
	export class ExternalFile {
	    path: string;
	    name: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new ExternalFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.content = source["content"];
	    }
	}
	export class SearchResult {
	    id: string;
	    title: string;
	    snippet: string;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.snippet = source["snippet"];
	    }
	}
	export class Settings {
	    theme: string;
	    language: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.language = source["language"];
	    }
	}

}

export namespace markdown {
	
	export class ImportResult {
	    content: string;
	    fileName: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	        this.fileName = source["fileName"];
	    }
	}

}

export namespace opengraph {
	
	export class LinkMetadata {
	    url: string;
	    title: string;
	    description: string;
	    image: string;
	    favicon: string;
	    siteName: string;
	
	    static createFrom(source: any = {}) {
	        return new LinkMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.image = source["image"];
	        this.favicon = source["favicon"];
	        this.siteName = source["siteName"];
	    }
	}

}

