import * as fs from "fs";
import * as grpc from "grpc";
import * as path from "path";
import * as ttfArtifacts from "../ttf/artifact_pb";
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
            ttfArtifacts.ArtifactType.BASE
          )) !== null
        );
      }
    );
  }

  async print(
    artifactId: string,
    artifactType: ttfArtifacts.ArtifactType
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
