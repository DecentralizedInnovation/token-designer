import * as childProcess from "child_process";
import * as extractZip from "extract-zip";
import * as fs from "fs";
import * as grpc from "grpc";
import * as path from "path";
import * as rimraf from "rimraf";
import * as ttfArtifacts from "./ttf/artifact_pb";
import * as ttfClient from "./ttf/service_grpc_pb";
import * as vscode from "vscode";

export class TaxonomyServiceHost {
  private readonly binaryPath: string;
  private readonly artifactsSandbox: string;
  private readonly artifactsZip: string;

  private terminal: vscode.Terminal | null = null;

  static async create(
    context: vscode.ExtensionContext
  ): Promise<TaxonomyServiceHost | undefined> {
    if (!TaxonomyServiceHost.checkForDotNet()) {
      vscode.window.showErrorMessage(
        ".NET Core 3+ is required to get the most out of the Token Designer."
      );
      return undefined;
    }

    const host = new TaxonomyServiceHost(context);
    await host.renewSandbox();
    host.ensureTerminal();

    let attempts = 0;
    while (true) {
      try {
        attempts++;
        console.log("Looking for local taxonomy service...", attempts);
        if (attempts > 15) {
          return undefined;
        }
        const connection = new ttfClient.ServiceClient(
          "localhost:8086",
          grpc.credentials.createInsecure()
        );
        await new Promise((resolve, reject) =>
          connection.getConfig(
            new ttfArtifacts.ConfigurationRequest(),
            (err, response) => (err ? reject() : resolve())
          )
        );
        return host;
      } catch {
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.artifactsSandbox = path.join(
      this.context.extensionPath,
      "deps",
      "artifacts"
    );
    this.artifactsZip = path.join(
      this.context.extensionPath,
      "deps",
      "artifacts.zip"
    );
    this.binaryPath = path.join(
      this.context.extensionPath,
      "deps",
      "TaxonomyService",
      "TaxonomyService.dll"
    );
  }

  private static checkForDotNet() {
    try {
      return (
        parseInt(
          childProcess.execFileSync("dotnet", ["--version"]).toString()
        ) >= 3
      );
    } catch (e) {
      console.error("checkForDotNet error:", e.message);
      return false;
    }
  }

  private ensureTerminal() {
    if (!!this.terminal && this.terminal.exitStatus === undefined) {
      return;
    }
    const dotNetArguments = [this.binaryPath];
    this.terminal = vscode.window.createTerminal({
      name: "TokenTaxonomyService",
      shellPath: "dotnet",
      shellArgs: dotNetArguments,
      hideFromUser: false,
    });
    this.terminal.show();
  }

  private async renewSandbox() {
    if (fs.existsSync(this.artifactsSandbox)) {
      await new Promise((resolve, reject) =>
        rimraf(this.artifactsSandbox, (error) =>
          error ? reject(error) : resolve()
        )
      );
    }
    fs.mkdirSync(this.artifactsSandbox);
    await extractZip(this.artifactsZip, { dir: this.artifactsSandbox });
  }

  dispose() {}
}
