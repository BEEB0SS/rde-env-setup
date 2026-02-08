import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export function registerDiagnosticsView(context: vscode.ExtensionContext): void {
  const provider = new DiagnosticsTreeProvider();
  const treeView = vscode.window.createTreeView("rde.diagnosticsView", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  const openCmd = vscode.commands.registerCommand(
    "rde.openDiagnostic",
    async (item: DiagnosticItem) => {
      const uri = item.uri;
      if (!uri) {
        return;
      }

      const selection = item.range
        ? new vscode.Range(
            item.range.start.line,
            item.range.start.character,
            item.range.end.line,
            item.range.end.character
          )
        : undefined;

      await vscode.window.showTextDocument(uri, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
        selection,
      });
    }
  );

  const refreshCmd = vscode.commands.registerCommand("rde.refreshDiagnostics", () => {
    provider.refresh();
  });

  context.subscriptions.push(treeView, openCmd, refreshCmd);

  const watcher = vscode.workspace.createFileSystemWatcher("**/.rde/errors.forge");
  watcher.onDidChange(() => provider.refresh());
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());
  context.subscriptions.push(watcher);
}

type ForgeEntry = {
  problem: string;
  solution: string;
  metadata?: {
    date?: string;
    agent?: string;
    related_files?: string[];
    notes?: string;
  };
};

class DiagnosticsTreeProvider implements vscode.TreeDataProvider<DiagnosticItem> {
  private readonly emitter = new vscode.EventEmitter<DiagnosticItem | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: DiagnosticItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DiagnosticItem): DiagnosticItem[] {
    if (!element) {
      const files = this.getForgeFileNodes();
      if (files.length === 0) {
        return [
          new DiagnosticItem(
            "No problems have been recorded yet in this workspace, this tab will automatically fill up with problem/solution pairs as your AI Agent helps you build your project.",
            vscode.TreeItemCollapsibleState.None,
            "empty"
          ),
        ];
      }
      return files;
    }

    if (element.kind === "file") {
      return this.getForgeEntriesForFile(element.fileKey ?? "");
    }

    return [];
  }

  private getForgeFileNodes(): DiagnosticItem[] {
    const entries = this.loadForgeEntries();
    const grouped = new Map<string, ForgeEntry[]>();

    for (const entry of entries) {
      const related = entry.metadata?.related_files ?? [];
      if (related.length === 0) {
        const key = "(unlinked)";
        const list = grouped.get(key) || [];
        list.push(entry);
        grouped.set(key, list);
        continue;
      }

      for (const file of related) {
        const key = file;
        const list = grouped.get(key) || [];
        list.push(entry);
        grouped.set(key, list);
      }
    }

    const items: DiagnosticItem[] = [];
    for (const [fileKey, fileEntries] of grouped) {
      const description = `${fileEntries.length} issue${fileEntries.length === 1 ? "" : "s"}`;
      const uri = this.resolveRelatedFileUri(fileKey);
      items.push(
        new DiagnosticItem(
          fileKey,
          vscode.TreeItemCollapsibleState.Collapsed,
          "file",
          uri,
          undefined,
          description,
          undefined,
          fileKey
        )
      );
    }

    return items.sort((a, b) => {
      const aLabel = typeof a.label === "string" ? a.label : a.label?.label ?? "";
      const bLabel = typeof b.label === "string" ? b.label : b.label?.label ?? "";
      return aLabel.localeCompare(bLabel);
    });
  }

  private getForgeEntriesForFile(fileKey: string): DiagnosticItem[] {
    const entries = this.loadForgeEntries();
    const items: DiagnosticItem[] = [];
    const root = this.getWorkspaceRoot();
    const errorsForgeUri = root
      ? vscode.Uri.file(path.join(root, ".rde", "errors.forge"))
      : undefined;

    for (const entry of entries) {
      const related = entry.metadata?.related_files ?? [];
      const matches =
        fileKey === "(unlinked)" ? related.length === 0 : related.includes(fileKey);

      if (!matches) continue;

      const label = entry.problem;
      const description = entry.solution;
      const tooltip = `${entry.problem}\n\nSolution:\n${entry.solution}`;

      items.push(
        new DiagnosticItem(
          label,
          vscode.TreeItemCollapsibleState.None,
          "diagnostic",
          errorsForgeUri,
          undefined,
          description,
          errorsForgeUri ? "rde.openDiagnostic" : undefined
        )
      );
      items[items.length - 1].tooltip = tooltip;
    }

    return items;
  }

  private loadForgeEntries(): ForgeEntry[] {
    const root = this.getWorkspaceRoot();
    if (!root) return [];

    const filePath = path.join(root, ".rde", "errors.forge");
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as { entries?: ForgeEntry[] };
      return Array.isArray(data.entries) ? data.entries : [];
    } catch {
      return [];
    }
  }

  private resolveRelatedFileUri(fileKey: string): vscode.Uri | undefined {
    const root = this.getWorkspaceRoot();
    if (!root) return undefined;
    if (fileKey === "(unlinked)") return undefined;
    return vscode.Uri.file(path.join(root, fileKey));
  }

  private getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}

class DiagnosticItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly kind: "file" | "diagnostic" | "empty",
    public readonly uri?: vscode.Uri,
    public readonly range?: vscode.Range,
    description?: string,
    commandId?: string,
    public readonly fileKey?: string
  ) {
    super(label, collapsibleState);
    this.description = description;

    if (commandId && uri) {
      this.command = {
        command: commandId,
        title: "Open Diagnostic",
        arguments: [this],
      };
    }

    this.contextValue = kind;
    if (kind === "file") {
      this.iconPath = vscode.ThemeIcon.File;
    } else if (kind === "diagnostic") {
      this.iconPath = new vscode.ThemeIcon("issue-opened");
    } else {
      this.iconPath = new vscode.ThemeIcon("info");
    }
  }
}
