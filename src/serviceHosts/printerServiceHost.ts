import * as fs from "fs";
import * as grpc from "grpc";
import * as path from "path";
import * as ttfArtifact from "../ttf/artifact_pb";
import * as ttfPrinting from "../ttf/printersvc_pb";
import * as ttfPrinterClient from "../ttf/printersvc_grpc_pb";
import * as vscode from "vscode";

import { BaseServiceHost } from "./baseServiceHost";

const APP_SETTINGS = {
  taxonomyHost: "localhost",
  taxonomyPort: 8086,
  printerHost: "localhost",
  printerPort: 8088,
  printToPath: "../artifacts",
};

export class PrinterServiceHost extends BaseServiceHost {
  static async create(
    context: vscode.ExtensionContext
  ): Promise<PrinterServiceHost | undefined> {
    fs.writeFileSync(
      path.join(
        context.extensionPath,
        "deps",
        "TTF-Printer",
        "appsettings.json"
      ),
      JSON.stringify(APP_SETTINGS)
    );
    const host = new PrinterServiceHost(context);
    return (await BaseServiceHost.initialize(host)) ? host : undefined;
  }

  private constructor(context: vscode.ExtensionContext) {
    super(
      path.join(
        context.extensionPath,
        "deps",
        "TTF-Printer",
        "TTF-Printer.dll"
      ),
      "TTF-Printer",
      async () => {
        return (
          (await this.print(
            "89ca6daf-5585-469e-abd1-19bc44e7a012",
            ttfArtifact.ArtifactType.BASE
          )) !== null
        );
      }
    );
  }

  async export(artifact?: ttfArtifact.Artifact) {
    if (!artifact) {
      return;
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !workspaceFolders.length) {
      vscode.window.showErrorMessage(
        "A folder must be open in the current VS Code workspace to export"
      );
      return;
    }
    const firstWorkspaceFolderPath = workspaceFolders[0].uri.fsPath;
    let i = 0;
    const name = artifact.getName() || "Artifact";
    let savePath = path.join(firstWorkspaceFolderPath, `${name}.docx`);
    while (fs.existsSync(savePath)) {
      i++;
      savePath = path.join(firstWorkspaceFolderPath, `${name} (${i}).docx`);
    }

    const id = artifact.getArtifactSymbol()?.getId();
    const type = artifact.getArtifactSymbol()?.getType();
    if (id && type !== undefined) {
      const openXmlDocument = await this.print(id, type);
      if (openXmlDocument) {
        fs.writeFileSync(savePath, Buffer.from(openXmlDocument, "base64"));
        if (
          (await vscode.window.showInformationMessage(
            `Exported to ${savePath}`,
            "Open",
            "Dismiss"
          )) === "Open"
        ) {
          if (!(await vscode.env.openExternal(vscode.Uri.file(savePath)))) {
            vscode.window.showErrorMessage("The file could not be opened");
          }
        }
      }
    }
  }

  private async print(
    artifactId: string,
    artifactType: ttfArtifact.ArtifactType
  ): Promise<string | null> {
    try {
      const connection = new ttfPrinterClient.PrinterServiceClient(
        "localhost:8088",
        grpc.credentials.createInsecure()
      );
      const artifact = new ttfPrinting.ArtifactToPrint();
      artifact.setId(artifactId);
      artifact.setType(artifactType);
      const response: ttfPrinting.PrintResult = await new Promise(
        (resolve, reject) =>
          connection.printTTFArtifact(artifact, (err, response) =>
            err ? reject() : resolve(response)
          )
      );
      return response.getOpenXmlDocument();
    } catch (e) {
      console.error("Could not print", artifactId, artifactType, e.message);
      return null;
    }
  }
}
