import { CAPSULE_SUMMARY_VARIANTS, DEEP_ANALYSIS_VARIANTS } from "./prompts.js";

export interface AnthropicConfig {
  apiKey: string;
  model: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
}

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicClient {
  private apiKey: string;
  private model: string;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  private async chat(
    system: string,
    messages: AnthropicMessage[],
    maxTokens = 2048
  ): Promise<string> {
    const response = await fetch(ANTHROPIC_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    return data.content?.map((c) => c.text).join("\n").trim() || "";
  }

  async generateCapsuleSummary(
    filePath: string,
    context: {
      fileDocstring?: string;
      functionSignatures: { name: string; signature: string; jsdoc?: string }[];
      firstNLines: string;
      usedBy: string[];
      dependsOn: string[];
      exports: string[];
    }
  ): Promise<{ summary: string; version: string }> {
    const versionId = "anthropic";
    const variant = CAPSULE_SUMMARY_VARIANTS["v1_balanced"];

    const docstring = context.fileDocstring ? `Docstring: ${context.fileDocstring}` : "";
    const signatures =
      context.functionSignatures
        .map((s) => `- ${s.signature}${s.jsdoc ? ` // ${s.jsdoc}` : ""}`)
        .join("\n") || "None";
    const firstLines = context.firstNLines.split("\n").slice(0, 15).join("\n");

    const prompt = variant.template
      .replace("{{filePath}}", filePath)
      .replace("{{docstring}}", docstring)
      .replace("{{exports}}", context.exports.join(", ") || "None")
      .replace("{{usedBy}}", context.usedBy.join(", ") || "No dependents")
      .replace("{{dependsOn}}", context.dependsOn.join(", ") || "No local dependencies")
      .replace("{{signatures}}", signatures)
      .replace("{{firstLines}}", firstLines);

    const summary = await this.chat(variant.systemInstruction, [
      { role: "user", content: prompt },
    ]);

    return { summary: summary.trim(), version: versionId };
  }

  async generateDirectorySummary(
    dirPath: string,
    files: { name: string; summary: string }[],
    subdirectories: string[]
  ): Promise<string> {
    const fileList = files
      .map((f) => `- ${f.name}: ${f.summary}`)
      .join("\n");

    const prompt = `Generate a concise summary for this directory based on its contents.

Directory: ${dirPath}

Files:
${fileList}

Subdirectories: ${subdirectories.join(", ") || "None"}

Respond with a short 1-sentence summary:
1. What is the primary purpose of this directory?
2. What are the key functionalities contained within?
(Does not need to be grammatically correct; the sentence can start with a verb)
`;

    return this.chat(
      "You are a code documentation expert. Generate extremely concise 1-sentence directory summaries.",
      [{ role: "user", content: prompt }]
    );
  }

  async generateArchitectureOverview(
    fileSummaries: { path: string; summary: string; exports: string[]; imports: string[] }[]
  ): Promise<string> {
    const fileList = fileSummaries
      .map((f) => `- ${f.path}: ${f.summary}`)
      .join("\n");

    const prompt = `Given these file summaries from a codebase, generate a high-level architecture overview.

Files:
${fileList}

Generate:
1. A brief description of what this codebase does (2-3 sentences)
2. The main components/modules and their responsibilities
3. How the components relate to each other

Keep it concise and focused on the big picture.`;

    return this.chat(
      "You are a software architect. Generate clear, high-level architecture overviews.",
      [{ role: "user", content: prompt }],
      2048
    );
  }

  async generateDeepAnalysis(
    filePath: string,
    fileContent: string
  ): Promise<{ lowerLevelSummary: string; structure: any[]; version: string }> {
    const versionId = "anthropic";
    const variant = DEEP_ANALYSIS_VARIANTS["v1_structured"];

    const contentToAnalyze = fileContent
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1));

    const prompt = variant.template
      .replace("{{filePath}}", filePath)
      .replace("{{content}}", contentToAnalyze);

    const response = await this.chat(variant.systemInstruction, [
      { role: "user", content: prompt },
    ], 4096);

    let parsed: { lowerLevelSummary?: string; structure?: any[] } = {};
    try {
      parsed = JSON.parse(response);
    } catch {
      // Best-effort fallback: keep summary empty and structure empty
    }

    return {
      lowerLevelSummary: parsed.lowerLevelSummary ?? "",
      structure: parsed.structure ?? [],
      version: versionId,
    };
  }
}
