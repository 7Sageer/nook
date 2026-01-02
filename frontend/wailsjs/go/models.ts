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

export namespace handlers {
	
	export class ChunkMatch {
	    blockId: string;
	    sourceBlockId?: string;
	    content: string;
	    blockType: string;
	    headingContext: string;
	    score: number;
	
	    static createFrom(source: any = {}) {
	        return new ChunkMatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.blockId = source["blockId"];
	        this.sourceBlockId = source["sourceBlockId"];
	        this.content = source["content"];
	        this.blockType = source["blockType"];
	        this.headingContext = source["headingContext"];
	        this.score = source["score"];
	    }
	}
	export class DocumentSearchResult {
	    docId: string;
	    docTitle: string;
	    maxScore: number;
	    matchedChunks: ChunkMatch[];
	
	    static createFrom(source: any = {}) {
	        return new DocumentSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.docId = source["docId"];
	        this.docTitle = source["docTitle"];
	        this.maxScore = source["maxScore"];
	        this.matchedChunks = this.convertValues(source["matchedChunks"], ChunkMatch);
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
	export class FileInfo {
	    filePath: string;
	    fileName: string;
	    fileSize: number;
	    fileType: string;
	    mimeType: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.fileName = source["fileName"];
	        this.fileSize = source["fileSize"];
	        this.fileType = source["fileType"];
	        this.mimeType = source["mimeType"];
	    }
	}
	export class RAGStatus {
	    enabled: boolean;
	    indexedDocs: number;
	    indexedBookmarks: number;
	    indexedFiles: number;
	    totalDocs: number;
	    lastIndexTime: string;
	
	    static createFrom(source: any = {}) {
	        return new RAGStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.indexedDocs = source["indexedDocs"];
	        this.indexedBookmarks = source["indexedBookmarks"];
	        this.indexedFiles = source["indexedFiles"];
	        this.totalDocs = source["totalDocs"];
	        this.lastIndexTime = source["lastIndexTime"];
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
	export class SemanticSearchResult {
	    docId: string;
	    docTitle: string;
	    blockId: string;
	    content: string;
	    blockType: string;
	    score: number;
	
	    static createFrom(source: any = {}) {
	        return new SemanticSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.docId = source["docId"];
	        this.docTitle = source["docTitle"];
	        this.blockId = source["blockId"];
	        this.content = source["content"];
	        this.blockType = source["blockType"];
	        this.score = source["score"];
	    }
	}
	export class Settings {
	    theme: string;
	    language: string;
	    sidebarWidth: number;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.language = source["language"];
	        this.sidebarWidth = source["sidebarWidth"];
	    }
	}
	export class TagInfo {
	    name: string;
	    count: number;
	    color?: string;
	    isPinned?: boolean;
	    collapsed?: boolean;
	    order?: number;
	
	    static createFrom(source: any = {}) {
	        return new TagInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.count = source["count"];
	        this.color = source["color"];
	        this.isPinned = source["isPinned"];
	        this.collapsed = source["collapsed"];
	        this.order = source["order"];
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

export namespace rag {
	
	export class EmbeddingConfig {
	    provider: string;
	    baseUrl: string;
	    model: string;
	    apiKey: string;
	    maxChunkSize: number;
	    overlap: number;
	
	    static createFrom(source: any = {}) {
	        return new EmbeddingConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	        this.maxChunkSize = source["maxChunkSize"];
	        this.overlap = source["overlap"];
	    }
	}
	export class ExternalBlockContent {
	    id: string;
	    docId: string;
	    blockId: string;
	    blockType: string;
	    url: string;
	    filePath: string;
	    title: string;
	    content: string;
	    extractedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new ExternalBlockContent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.docId = source["docId"];
	        this.blockId = source["blockId"];
	        this.blockType = source["blockType"];
	        this.url = source["url"];
	        this.filePath = source["filePath"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.extractedAt = source["extractedAt"];
	    }
	}

}

