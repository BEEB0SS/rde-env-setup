import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  createUpperLevelAPI,
  type FileCapsule,
  type DirectoryCapsule,
  type ExportEntry,
  GeminiClient,
} from "../visualizer-core/index.js";

type CapsulesData = {
  stats: {
    totalFiles: number;
    totalDirectories: number;
    totalEdges: number;
    externalDependencies: string[];
    entryPoints: string[];
    projectOverview?: string;
  };
  files: Record<string, FileCapsule>;
  directories: Record<string, DirectoryCapsule>;
};

let canvasPanel: vscode.WebviewPanel | undefined;
let capsulesCache: CapsulesData | null = null;

const FILE_SUMMARY_CONCURRENCY = 25;
const DIRECTORY_SUMMARY_CONCURRENCY = 25;

export function registerVisualizerCommand(context: vscode.ExtensionContext): void {
  const openVisualizer = vscode.commands.registerCommand("rde.openVisualizer", async () => {
    if (canvasPanel) {
      canvasPanel.reveal(vscode.ViewColumn.Beside);
      sendCapsulesDataToWebview(canvasPanel.webview);
      return;
    }

    canvasPanel = vscode.window.createWebviewPanel(
      "rdeVisualizer",
      "RDE Repository Visualizer",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "out", "webview")),
        ],
      }
    );

    canvasPanel.onDidDispose(() => {
      canvasPanel = undefined;
    });

    canvasPanel.webview.html = getWebviewHtml(canvasPanel.webview, context.extensionPath);
    sendCapsulesDataToWebview(canvasPanel.webview);

    canvasPanel.webview.onDidReceiveMessage(async (message) => {
      if (!canvasPanel) return;

      if (message?.type === "openFile" && message.relativePath) {
        await openFileInEditor(message.relativePath, message.startLine, message.endLine, message.line);
        return;
      }

      if (message?.type === "setApiKey") {
        await promptForApiKeys();
        capsulesCache = null;
        sendCapsulesDataToWebview(canvasPanel.webview);
        return;
      }

      if (message?.type === "ready" || message?.type === "requestCapsules") {
        sendCapsulesDataToWebview(canvasPanel.webview);
        return;
      }

      if (message?.type === "refresh") {
        capsulesCache = null;
        sendCapsulesDataToWebview(canvasPanel.webview);
        return;
      }

      if (message?.type === "analyzeFile" && message.relativePath) {
        vscode.window.showInformationMessage("Deep analysis is not enabled in this build yet.");
      }
    });
  });

  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && canvasPanel && canvasPanel.visible) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders?.length) return;
      const rootPath = workspaceFolders[0].uri.fsPath;
      const fileName = editor.document.fileName;

      if (fileName.toLowerCase().startsWith(rootPath.toLowerCase())) {
        let relativePath = path.relative(rootPath, fileName);
        relativePath = relativePath.split(path.sep).join("/");
        canvasPanel.webview.postMessage({
          type: "highlightFile",
          data: { relativePath },
        });
      }
    }
  });

  context.subscriptions.push(openVisualizer, activeEditorListener);
}

async function openFileInEditor(
  relativePath: string,
  startLine?: number,
  endLine?: number,
  line?: number
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) return;

  const filePath = path.join(workspaceFolders[0].uri.fsPath, relativePath);
  const fileUri = vscode.Uri.file(filePath);

  let selection: vscode.Range | undefined;
  if (startLine && endLine) {
    selection = new vscode.Range(startLine - 1, 0, endLine - 1, 1000);
  } else if (line) {
    selection = new vscode.Range(line - 1, 0, line - 1, 1000);
  }

  await vscode.window.showTextDocument(fileUri, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
    selection,
  });
}

async function promptForApiKeys(): Promise<void> {
  const geminiKey = await vscode.window.showInputBox({
    prompt: "Enter your Gemini API key",
    placeHolder: "Gemini API key (starts with AIza...)",
    password: true,
    ignoreFocusOut: true,
  });

  const ttcKey = await vscode.window.showInputBox({
    prompt: "Enter your TTC API key (Optional)",
    placeHolder: "The Token Company API key",
    password: true,
    ignoreFocusOut: true,
  });

  if (geminiKey !== undefined) {
    const config = vscode.workspace.getConfiguration("rde");
    await config.update("geminiApiKey", geminiKey, vscode.ConfigurationTarget.Global);
  }

  if (ttcKey !== undefined) {
    const config = vscode.workspace.getConfiguration("rde");
    await config.update("ttcApiKey", ttcKey, vscode.ConfigurationTarget.Global);
  }
}

async function sendCapsulesDataToWebview(webview: vscode.Webview): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    webview.postMessage({ type: "error", message: "No workspace folder is open." });
    return;
  }

  webview.postMessage({ type: "loading" });

  try {
    if (!capsulesCache) {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const api = await createUpperLevelAPI(rootPath);

      const stats = api.getStats();
      const allFiles = api.getAllFiles();
      const files: Record<string, FileCapsule> = {};

      for (const filePath of allFiles) {
        const capsule = api.getFileCapsule(filePath);
        if (capsule) {
          files[capsule.relativePath] = capsule;
        }
      }

      const directories: Record<string, DirectoryCapsule> = {};
      for (const file of Object.values(files)) {
        const dirPath = path.dirname(file.path);
        const dirRelativePath = path.dirname(file.relativePath);

        if (!directories[dirRelativePath]) {
          directories[dirRelativePath] = {
            path: dirPath,
            relativePath: dirRelativePath,
            name: path.basename(dirPath),
            files: [],
            subdirectories: [],
            metadata: { fileCount: 0, subdirCount: 0 },
          };
        }

        directories[dirRelativePath].files.push(file.relativePath);
        directories[dirRelativePath].metadata!.fileCount++;
      }

      const dirKeys = Object.keys(directories).sort();
      for (const dirRel of dirKeys) {
        if (dirRel === ".") continue;
        const parentDir = path.dirname(dirRel);
        if (directories[parentDir]) {
          directories[parentDir].subdirectories.push(dirRel);
          directories[parentDir].metadata!.subdirCount++;
        }
      }

      if (!directories["."]) {
        directories["."] = {
          path: rootPath,
          relativePath: ".",
          name: path.basename(rootPath),
          files: [],
          subdirectories: dirKeys.filter((d) => path.dirname(d) === "." && d !== "."),
          metadata: { fileCount: 0, subdirCount: 0 },
        };
        directories["."].metadata!.subdirCount = directories["."].subdirectories.length;
      }

      capsulesCache = { stats, files, directories };

      webview.postMessage({ type: "setCapsules", data: capsulesCache });

      await generateSummariesIfConfigured(rootPath, webview, files, directories, stats);
    } else {
      webview.postMessage({ type: "setCapsules", data: capsulesCache });
    }
  } catch (error) {
    webview.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Failed to scan workspace",
    });
  }
}

async function generateSummariesIfConfigured(
  rootPath: string,
  webview: vscode.Webview,
  files: Record<string, FileCapsule>,
  directories: Record<string, DirectoryCapsule>,
  stats: CapsulesData["stats"]
): Promise<void> {
  const config = vscode.workspace.getConfiguration("rde");
  const apiKey = config.get<string>("geminiApiKey");
  const ttcApiKey = config.get<string>("ttcApiKey");

  if (!apiKey) {
    return;
  }

  const client = new GeminiClient({ apiKey, ttcApiKey });

  const fileEntries = Object.entries(files);
  await processInParallelWithLimit(fileEntries, async ([relativePath, capsule]) => {
    if (capsule.upperLevelSummary || !capsule.metadata) {
      return;
    }

    const result = await client.generateCapsuleSummary(relativePath, {
      fileDocstring: capsule.metadata.fileDocstring,
      functionSignatures: capsule.metadata.functionSignatures,
      firstNLines: capsule.metadata.firstNLines,
      usedBy: capsule.metadata.usedBy,
      dependsOn: capsule.metadata.dependsOn,
      exports: capsule.exports.map((e: ExportEntry) => e.name),
    });

    capsule.upperLevelSummary = result.summary;
    capsule.upperLevelSummaryVersion = result.version;

    webview.postMessage({
      type: "updateFileSummary",
      data: { relativePath, summary: result.summary, version: result.version },
    });
  }, FILE_SUMMARY_CONCURRENCY);

  const dirEntries = Object.entries(directories);
  await processInParallelWithLimit(dirEntries, async ([dirRelPath, dirCapsule]) => {
    const fileContexts = dirCapsule.files.map((fPath) => ({
      name: path.basename(fPath),
      summary: files[fPath]?.upperLevelSummary || "No summary",
    }));

    const summary = await client.generateDirectorySummary(dirRelPath, fileContexts, dirCapsule.subdirectories);
    dirCapsule.upperLevelSummary = summary;

    webview.postMessage({
      type: "updateDirectorySummary",
      data: { relativePath: dirRelPath, summary },
    });
  }, DIRECTORY_SUMMARY_CONCURRENCY);

  if (capsulesCache) {
    capsulesCache.stats = stats;
  }

  const outputDir = path.join(rootPath, ".rde");
  const outputPath = path.join(outputDir, "capsules.json");
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(capsulesCache, null, 2), "utf-8");
  } catch {
    // Ignore write errors
  }
}

async function processInParallelWithLimit<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrencyLimit: number
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit);
    await Promise.all(batch.map((item) => fn(item)));
  }
}

function getWebviewHtml(webview: vscode.Webview, extensionPath: string): string {
  const webviewPath = path.join(extensionPath, "out", "webview");
  const htmlPath = path.join(webviewPath, "index.html");

  if (!fs.existsSync(htmlPath)) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RDE Repository Visualizer</title>
  <style>
  body {
    margin: 0;
    padding: 40px;
    background: #121212;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  h1 { color: #007acc; }
  code { background: #333; padding: 2px 6px; border-radius: 4px; }
  pre { background: #1a1a1a; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Build Required</h1>
  <p>The webview UI has not been built yet. Please run:</p>
  <pre><code>cd webview-ui && pnpm install && pnpm build</code></pre>
  <p>Then reload this window.</p>
</body>
</html>`;
  }

  let html = fs.readFileSync(htmlPath, "utf-8");
  const assetsUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, "assets")));

  html = html.replace(/href="\.\/assets\//g, `href="${assetsUri}/`);
  html = html.replace(/src="\.\/assets\//g, `src="${assetsUri}/`);
  html = html.replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, "");

  const assetsDir = path.join(webviewPath, "assets");
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const jsFile = files.find((f) => f.endsWith(".js"));
    const cssFile = files.find((f) => f.endsWith(".css"));

    if (cssFile) {
      html = html.replace("</head>", `<link rel=\"stylesheet\" href=\"${assetsUri}/${cssFile}\">\n</head>`);
    }
    if (jsFile) {
      html = html.replace("</body>", `<script type=\"module\" src=\"${assetsUri}/${jsFile}\"></script>\n</body>`);
    }
  }

  return html;
}
