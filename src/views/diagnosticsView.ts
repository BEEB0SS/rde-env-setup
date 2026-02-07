import * as vscode from "vscode";

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
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => provider.refresh())
  );
}

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
      const files = this.getFileNodes();
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
      return this.getDiagnosticsForFile(element.uri!);
    }

    return [];
  }

  private getFileNodes(): DiagnosticItem[] {
    const diagnostics = vscode.languages.getDiagnostics();
    const items: DiagnosticItem[] = [];

    for (const [uri, fileDiagnostics] of diagnostics) {
      if (!fileDiagnostics.length) {
        continue;
      }

      const label = vscode.workspace.asRelativePath(uri, false);
      const description = `${fileDiagnostics.length} issue${fileDiagnostics.length === 1 ? "" : "s"}`;

      items.push(
        new DiagnosticItem(
          label,
          vscode.TreeItemCollapsibleState.Collapsed,
          "file",
          uri,
          undefined,
          description
        )
      );
    }

    return items.sort((a, b) => {
      const aLabel =
        typeof a.label === "string" ? a.label : a.label?.label ?? "";
      const bLabel =
        typeof b.label === "string" ? b.label : b.label?.label ?? "";
      return aLabel.localeCompare(bLabel);
    });
  }

  private getDiagnosticsForFile(uri: vscode.Uri): DiagnosticItem[] {
    const diags = vscode.languages.getDiagnostics(uri);
    return diags.map((diag, index) => {
      const label = diag.message.split("\n")[0];
      const severity = severityLabel(diag.severity);
      const line = diag.range.start.line + 1;
      const description = `${severity} • L${line}`;

      return new DiagnosticItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        "diagnostic",
        uri,
        diag.range,
        description,
        "rde.openDiagnostic"
      );
    });
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
    commandId?: string
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

function severityLabel(severity: vscode.DiagnosticSeverity): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "Error";
    case vscode.DiagnosticSeverity.Warning:
      return "Warning";
    case vscode.DiagnosticSeverity.Information:
      return "Info";
    case vscode.DiagnosticSeverity.Hint:
      return "Hint";
    default:
      return "Info";
  }
}
