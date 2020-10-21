import * as ttfArtifact from "./ttf/artifact_pb";
import * as ttfClient from "./ttf/service_grpc_pb";
import * as ttfCore from "./ttf/core_pb";
import * as vscode from "vscode";

import { ArtifactPanelBase } from "./artifactPanelBase";
import { tokenBasePanelEvents } from "./panels/tokenBasePanelEvents";
import { TokenTaxonomy } from "./tokenTaxonomy";

export class TokenBasePanel extends ArtifactPanelBase<ttfCore.Base> {
  static async openExistingTokenBase(
    artifactId: string,
    ttfConnection: ttfClient.ServiceClient,
    environment: string,
    ttfTaxonomy: TokenTaxonomy,
    extensionPath: string,
    disposables: vscode.Disposable[],
    panelReloadEvent: vscode.Event<void>
  ) {
    const panel = new TokenBasePanel(
      ttfConnection,
      environment,
      ttfTaxonomy,
      extensionPath,
      disposables,
      panelReloadEvent
    );
    await panel.openArtifact(artifactId);
    return panel;
  }

  private constructor(
    ttfConnection: ttfClient.ServiceClient,
    environment: string,
    ttfTaxonomy: TokenTaxonomy,
    extensionPath: string,
    disposables: vscode.Disposable[],
    panelReloadEvent: vscode.Event<void>
  ) {
    super(
      ttfConnection,
      "taxonomy.model.core.Base",
      environment,
      ttfTaxonomy,
      "Token Base",
      "token-base.svg",
      "tokenBasePanel",
      "tokenBasePanel.main.js",
      extensionPath,
      disposables,
      panelReloadEvent
    );
  }

  protected async onUnhandledMessage(message: any) {}

  protected async getArtifact(
    symbol: ttfArtifact.ArtifactSymbol
  ): Promise<ttfCore.Base> {
    return await new Promise((resolve, reject) =>
      this.ttfConnection.getBaseArtifact(
        symbol,
        (error, response) => (error && reject(error)) || resolve(response)
      )
    );
  }
}
