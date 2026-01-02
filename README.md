# README

## About

This is the official Wails React-TS template.

You can configure the project by editing `wails.json`. More information about the project settings can be found
here: https://wails.io/docs/reference/project-config

## Recommended Tools

To get the best experience with file imports (PDF, DOCX), it is recommended to install the following command-line tools:

- **Pandoc**: Enhances DOCX to Markdown conversion.
- **Poppler (`pdftotext`)**: Enhances PDF text extraction with layout preservation.

**macOS Installation:**

```bash
brew install pandoc poppler
```

The application will automatically detect these tools at startup if they are available in your PATH.

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Building

To build a redistributable, production mode package, use `wails build`.
