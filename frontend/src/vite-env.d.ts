/// <reference types="vite/client" />

interface Window {
    go: {
        main: {
            App: {
                GetOS(): Promise<string>;
            };
        };
    };
}

