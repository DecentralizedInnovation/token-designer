import * as ttfArtifact from "./ttf/artifact_pb";
import * as ttfClient from "./ttf/service_grpc_pb";
import * as ttfCore from "./ttf/core_pb";
import * as vscode from "vscode";

import { ArtifactPanelBase } from "./artifactPanelBase";
import { behaviorPanelEvents } from "./panels/behaviorPanelEvents";
import { TaxonomyServiceHost } from "./taxonomyServiceHost";
import { TokenTaxonomy } from "./tokenTaxonomy";

export class BehaviorPanel extends ArtifactPanelBase<ttfCore.Behavior> {
  static async createNewBehavior(
    ttfConnection: ttfClient.ServiceClient,
    environment: string,
    ttfTaxonomy: TokenTaxonomy,
    extensionPath: string,
    disposables: vscode.Disposable[],
    panelReloadEvent: vscode.Event<void>,
    taxonomyServiceHost: TaxonomyServiceHost
  ) {
    const panel = new BehaviorPanel(
      ttfConnection,
      environment,
      ttfTaxonomy,
      extensionPath,
      disposables,
      panelReloadEvent,
      taxonomyServiceHost
    );
    return await ArtifactPanelBase.createNew(
      ttfConnection,
      ttfTaxonomy,
      panel,
      new ttfCore.Behavior(),
      "taxonomy.model.core.Behavior",
      ttfArtifact.ArtifactType.BEHAVIOR,
      taxonomyServiceHost
    );
  }

  static async openExistingBehavior(
    artifactId: string,
    ttfConnection: ttfClient.ServiceClient,
    environment: string,
    ttfTaxonomy: TokenTaxonomy,
    extensionPath: string,
    disposables: vscode.Disposable[],
    panelReloadEvent: vscode.Event<void>,
    taxonomyServiceHost: TaxonomyServiceHost
  ) {
    const panel = new BehaviorPanel(
      ttfConnection,
      environment,
      ttfTaxonomy,
      extensionPath,
      disposables,
      panelReloadEvent,
      taxonomyServiceHost
    );
    await panel.openArtifact(artifactId);
    return panel;
  }

  static buildInvocation(data: any) {
    const newInvocation = new ttfCore.Invocation();
    newInvocation.setId(data.id || "");
    newInvocation.setName(data.name || "");
    newInvocation.setDescription(data.description || "");
    if (
      data.request?.controlMessageName ||
      data.request?.description ||
      data.request?.inputParametersList?.length
    ) {
      const newRequest = new ttfCore.InvocationRequest();
      newRequest.setControlMessageName(data.request.controlMessageName || "");
      newRequest.setDescription(data.request.description || "");
      const parameters: ttfCore.InvocationParameter[] = [];
      for (const parameterData of data.request.inputParametersList || []) {
        const parameter = new ttfCore.InvocationParameter();
        parameter.setName(parameterData.name || "");
        parameter.setValueDescription(parameterData.valueDescription || "");
        parameters.push(parameter);
      }
      newRequest.setInputParametersList(parameters);
      newInvocation.setRequest(newRequest);
    }
    if (
      data.response?.controlMessageName ||
      data.response?.description ||
      data.response?.outputParametersList?.length
    ) {
      const newResponse = new ttfCore.InvocationResponse();
      newResponse.setControlMessageName(data.response.controlMessageName || "");
      newResponse.setDescription(data.response.description || "");
      const parameters: ttfCore.InvocationParameter[] = [];
      for (const parameterData of data.response.outputParametersList || []) {
        const parameter = new ttfCore.InvocationParameter();
        parameter.setName(parameterData.name || "");
        parameter.setValueDescription(parameterData.valueDescription || "");
        parameters.push(parameter);
      }
      newResponse.setOutputParametersList(parameters);
      newInvocation.setResponse(newResponse);
    }
    return newInvocation;
  }

  private constructor(
    ttfConnection: ttfClient.ServiceClient,
    environment: string,
    ttfTaxonomy: TokenTaxonomy,
    extensionPath: string,
    disposables: vscode.Disposable[],
    panelReloadEvent: vscode.Event<void>,
    taxonomyServiceHost: TaxonomyServiceHost
  ) {
    super(
      ttfConnection,
      "taxonomy.model.core.Behavior",
      environment,
      ttfTaxonomy,
      "Behavior",
      "behavior.svg",
      "behaviorPanel",
      "behaviorPanel.main.js",
      extensionPath,
      disposables,
      panelReloadEvent,
      taxonomyServiceHost
    );
  }

  protected async onUnhandledMessage(message: any) {
    if (message.e === behaviorPanelEvents.EditConstructorType) {
      const newConstructorType = await vscode.window.showInputBox({
        prompt: "Constructor type",
        value: this.artifact?.getConstructorType(),
      });
      if (newConstructorType || newConstructorType === "") {
        this.artifact?.setConstructorType(newConstructorType || "");
        await this.saveChanges();
      }
    } else if (message.e === behaviorPanelEvents.EditInvocation) {
      if (!this.artifact) {
        return;
      }
      const newInvocation = BehaviorPanel.buildInvocation(message.invocation);
      const i = message.i;
      if (i >= this.artifact.getInvocationsList().length) {
        this.artifact.addInvocations(newInvocation);
      } else {
        this.artifact.getInvocationsList()[i] = newInvocation;
      }
      await this.saveChanges();
    } else if (message.e === behaviorPanelEvents.EditPropertyInvocation) {
      if (!this.artifact) {
        return;
      }
      const pi = message.pi;
      const property = this.artifact.getPropertiesList()[pi];
      if (!property) {
        return;
      }
      const newInvocation = BehaviorPanel.buildInvocation(message.invocation);
      const i = message.i;
      if (i >= property.getPropertyInvocationsList().length) {
        property.addPropertyInvocations(newInvocation);
      } else {
        property.getPropertyInvocationsList()[i] = newInvocation;
      }
      await this.saveChanges();
    } else if (message.e === behaviorPanelEvents.DeleteInvocation) {
      if (!this.artifact) {
        return;
      }
      const i = message.i;
      this.artifact.setInvocationsList(
        this.artifact.getInvocationsList().filter((_, j) => j !== i)
      );
      await this.saveChanges();
    } else if (message.e === behaviorPanelEvents.DeletePropertyInvocation) {
      if (!this.artifact) {
        return;
      }
      const i = message.i;
      const pi = message.pi;
      const property = this.artifact.getPropertiesList()[pi];
      if (!property) {
        return;
      }
      property.setPropertyInvocationsList(
        property.getPropertyInvocationsList().filter((_, j) => j !== i)
      );
      await this.saveChanges();
    } else if (message.e === behaviorPanelEvents.EditPropertyDescription) {
      await this.editProperty(
        "property description",
        this.artifact?.getPropertiesList()[message.pi]?.getValueDescription(),
        (newValue) =>
          this.artifact
            ?.getPropertiesList()
            [message.pi]?.setValueDescription(newValue)
      );
    } else if (message.e === behaviorPanelEvents.EditPropertyName) {
      await this.editProperty(
        "property name",
        this.artifact?.getPropertiesList()[message.pi]?.getName(),
        (newValue) =>
          this.artifact?.getPropertiesList()[message.pi]?.setName(newValue)
      );
    } else if (message.e === behaviorPanelEvents.EditPropertyValue) {
      await this.editProperty(
        "template value",
        this.artifact?.getPropertiesList()[message.pi]?.getTemplateValue(),
        (newValue) =>
          this.artifact
            ?.getPropertiesList()
            [message.pi]?.setTemplateValue(newValue)
      );
    } else if (message.e === behaviorPanelEvents.DeleteProperty) {
      this.artifact?.setPropertiesList(
        this.artifact.getPropertiesList().filter((_, pi) => pi !== message.pi)
      );
      await this.saveChanges();
    } else if (message.e === behaviorPanelEvents.AddProperty) {
      const newPropertyName = await vscode.window.showInputBox({
        prompt: "Enter a name for the new property",
      });
      if (newPropertyName) {
        const newProperty = new ttfCore.Property();
        newProperty.setName(newPropertyName);
        this.artifact?.addProperties(newProperty);
        await this.saveChanges();
      }
    }
  }

  protected async getArtifact(
    symbol: ttfArtifact.ArtifactSymbol
  ): Promise<ttfCore.Behavior> {
    return await new Promise((resolve, reject) =>
      this.ttfConnection.getBehaviorArtifact(
        symbol,
        (error, response) => (error && reject(error)) || resolve(response)
      )
    );
  }

  private async editProperty(
    description: string,
    value?: string,
    setter?: (value: string) => void
  ) {
    if (!setter) {
      return;
    }
    const newValue = await vscode.window.showInputBox({
      prompt: "Enter a new " + description,
      value,
    });
    if (!newValue && newValue !== "") {
      return;
    }
    setter(newValue);
    await this.saveChanges();
  }
}
