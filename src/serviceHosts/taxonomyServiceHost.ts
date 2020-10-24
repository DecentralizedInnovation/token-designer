import * as childProcess from "child_process";
import * as extractZip from "extract-zip";
import * as fs from "fs";
import * as grpc from "grpc";
import * as path from "path";
import * as rimraf from "rimraf";
import * as ttfArtifacts from "../ttf/artifact_pb";
import * as ttfClient from "../ttf/service_grpc_pb";
import * as vscode from "vscode";

import { BaseServiceHost } from "./baseServiceHost";

export class TaxonomyServiceHost extends BaseServiceHost {
  private readonly artifactsSandbox: string;
  private readonly artifactsZip: string;

  static async create(
    context: vscode.ExtensionContext
  ): Promise<TaxonomyServiceHost | undefined> {
    const host = new TaxonomyServiceHost(context);
    await host.renewSandbox();
    return (await BaseServiceHost.initialize(host)) ? host : undefined;
  }

  private constructor(private readonly context: vscode.ExtensionContext) {
    super(
      path.join(
        context.extensionPath,
        "deps",
        "TaxonomyService",
        "TaxonomyService.dll"
      )
    );
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
  }

  private async renewSandbox() {
    console.log("Recreating TTF sandbox");
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
}
