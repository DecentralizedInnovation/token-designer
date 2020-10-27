import * as fs from "fs";
import * as path from "path";
import * as ttfArtifact from "./ttf/artifact_pb";
import * as ttfClient from "./ttf/service_grpc_pb";
import * as uuid from "uuid";
import * as vscode from "vscode";
import * as protobufAny from "google-protobuf/google/protobuf/any_pb";

import { artifactPanelBaseEvents } from "./panels/artifactPanelBaseEvents";
import ArtifactUpdate from "./panels/artifactUpdate";
import { PanelBase } from "./panelBase";
import { PrinterServiceHost } from "./serviceHosts/printerServiceHost";
import { TaxonomyAsObjects } from "./panels/taxonomyAsObjects";
import { TaxonomyServiceHost } from "./serviceHosts/taxonomyServiceHost";
import { TokenTaxonomy } from "./tokenTaxonomy";

type ArtifactType = {
  getArtifact(): ttfArtifact.Artifact | undefined;
  toObject(): any;
  serializeBinary(): Uint8Array;
  setArtifact(artifact: ttfArtifact.Artifact): void;
};

export abstract class ArtifactPanelBase<
  T extends ArtifactType
> extends PanelBase {
  static async createNew<T extends ArtifactType>(
    ttfConnection: ttfClient.ServiceClient,
    ttfTaxonomy: TokenTaxonomy,
    panel: ArtifactPanelBase<T>,
    newObject: T,
    ttfTypeString: string,
    artifactType: ttfArtifact.ArtifactType,
    taxonomyServiceHost: TaxonomyServiceHost
  ) {
    const newArtifactSymbol = new ttfArtifact.ArtifactSymbol();
    newArtifactSymbol.setId(uuid.v1());
    newArtifactSymbol.setTooling("U");
    newArtifactSymbol.setType(artifactType);
    const newArtifact = new ttfArtifact.Artifact();
    newArtifact.setName("Untitled");
    newArtifact.setArtifactSymbol(newArtifactSymbol);
    newArtifact.setArtifactDefinition(new ttfArtifact.ArtifactDefinition());
    newObject.setArtifact(newArtifact);
    const any = new protobufAny.Any();
    any.pack(newObject.serializeBinary(), ttfTypeString);
    const newArtifactRequest = new ttfArtifact.NewArtifactRequest();
    newArtifactRequest.setArtifact(any);
    newArtifactRequest.setType(artifactType);
    await new Promise((resolve, reject) =>
      ttfConnection.createArtifact(newArtifactRequest, (err) =>
        err ? reject(err) : resolve()
      )
    );

    // TODO: Fix bugs in the TaxonomyService that sometimes require it to be restarted to
    //       re-read its artifacts from disk, then remove this hack.
    await taxonomyServiceHost.restart();

    await ttfTaxonomy.refresh();
    await panel.openArtifact(newArtifactSymbol.getId());
    return panel;
  }

  get title() {
    const suffix = ` -  ${this.environment}`;
    if (this.artifact) {
      const name =
        this.artifact.getArtifact()?.getName() ||
        `New  ${this.artifactTypeString}`;
      return `${name} - ${this.artifactTypeString} ${suffix}`;
    } else {
      return `${this.artifactTypeString} Designer ${suffix}`;
    }
  }

  private taxonomyObjects: TaxonomyAsObjects | null = null;

  protected artifact: T | null = null;

  protected constructor(
    protected readonly ttfConnection: ttfClient.ServiceClient,
    private readonly ttfClassName: string,
    private readonly environment: string,
    protected readonly ttfTaxonomy: TokenTaxonomy,
    private readonly artifactTypeString: string,
    iconSvg: string,
    panelId: string,
    clientScript: string,
    extensionPath: string,
    disposables: vscode.Disposable[],
    panelReloadEvent: vscode.Event<void>,
    private readonly taxonomyServiceHost: TaxonomyServiceHost,
    private readonly printerServiceHost: PrinterServiceHost
  ) {
    super(panelId, clientScript, extensionPath, disposables, panelReloadEvent);
    this.setTitle(this.title, iconSvg);

    this.refreshTaxonomy();
    this.ttfTaxonomy.onRefresh(this.refreshTaxonomy, this);
  }

  protected abstract async onUnhandledMessage(message: any): Promise<void>;

  protected abstract async getArtifact(
    symbol: ttfArtifact.ArtifactSymbol
  ): Promise<T>;

  protected async openArtifact(artifactId: string) {
    this.refreshArtifact(artifactId);
  }

  protected postCurrentState() {
    this.postMessage({
      artifact: this.artifact?.toObject(),
      taxonomy: this.taxonomyObjects,
    });
  }

  protected async onMessage(message: any) {
    if (message.e === artifactPanelBaseEvents.Init) {
      this.postCurrentState();
    } else if (message.e === artifactPanelBaseEvents.Rename) {
      await this.rename();
    } else if (message.e === artifactPanelBaseEvents.Update) {
      await this.update(message.update);
    } else if (message.e === artifactPanelBaseEvents.Export) {
      await this.export();
    } else {
      await this.onUnhandledMessage(message);
    }
  }

  protected async saveChanges() {
    const symbol = this.artifact?.getArtifact()?.getArtifactSymbol();
    if (!this.artifact || !symbol) {
      return;
    }
    const any = new protobufAny.Any();
    any.pack(this.artifact.serializeBinary(), this.ttfClassName);
    const updateReqest = new ttfArtifact.UpdateArtifactRequest();
    updateReqest.setType(symbol.getType());
    updateReqest.setArtifactTypeObject(any);
    await new Promise((resolve, reject) =>
      this.ttfConnection.updateArtifact(
        updateReqest,
        (error, response) => (error && reject(error)) || resolve(response)
      )
    );

    // TODO: Fix bugs in the TaxonomyService that sometimes require it to be restarted to
    //       re-read its artifacts from disk, then remove this hack.
    await this.taxonomyServiceHost.restart();

    await this.refreshArtifact(symbol.getId());
  }

  private async export() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !workspaceFolders.length) {
      vscode.window.showErrorMessage(
        "A folder must be open in the current VS Code workspace to export"
      );
      return;
    }
    const firstWorkspaceFolderPath = workspaceFolders[0].uri.fsPath;
    let i = 0;
    const name = this.artifact?.getArtifact()?.getName() || "Artifact";
    let savePath = path.join(firstWorkspaceFolderPath, `${name}.docx`);
    while (fs.existsSync(savePath)) {
      i++;
      savePath = path.join(firstWorkspaceFolderPath, `${name} (${i}).docx`);
    }

    const id = this.artifact?.getArtifact()?.getArtifactSymbol()?.getId();
    const type = this.artifact?.getArtifact()?.getArtifactSymbol()?.getType();
    if (id && type !== undefined) {
      const openXmlDocument = await this.printerServiceHost.print(id, type);
      if (openXmlDocument) {
        fs.writeFileSync(savePath, Buffer.from(openXmlDocument, "base64"));
        vscode.window.showInformationMessage(`Exported to ${savePath}`);
      }
    }
  }

  private async refreshArtifact(artifactId: string) {
    const existingArtifactSymbol = new ttfArtifact.ArtifactSymbol();
    existingArtifactSymbol.setId(artifactId);
    this.artifact = await this.getArtifact(existingArtifactSymbol);
    this.postCurrentState();
    this.setTitle(this.title);
    await this.ttfTaxonomy.refresh();
    this.refreshTaxonomy();
  }

  private refreshTaxonomy() {
    this.taxonomyObjects = this.ttfTaxonomy.asObjects();
    this.postMessage({ taxonomy: this.taxonomyObjects });
  }

  private async rename() {
    if (this.artifact) {
      const newName = await vscode.window.showInputBox({
        value: this.artifact?.getArtifact()?.getName(),
        prompt: "Enter a new name for this artifact",
      });
      if (!newName) {
        return;
      }
      this.artifact.getArtifact()?.setName(newName);
      await this.saveChanges();
    }
  }

  private resolveList(field: string): any[] | undefined {
    switch (field) {
      case "alias":
        return this.artifact?.getArtifact()?.getAliasesList();
      case "analogy.name":
        return this.artifact
          ?.getArtifact()
          ?.getArtifactDefinition()
          ?.getAnalogiesList();
      case "contributor.name":
        return this.artifact?.getArtifact()?.getContributorsList();
      case "dependency":
        return this.artifact?.getArtifact()?.getDependenciesList();
      case "influencedBy":
        return this.artifact?.getArtifact()?.getInfluencedBySymbolsList();
      case "incompatibleWith":
        return this.artifact?.getArtifact()?.getIncompatibleWithSymbolsList();
    }
  }

  private resolveSetter(
    field: string,
    index?: number
  ): ((value: string) => void) | undefined {
    const analogies = this.artifact
      ?.getArtifact()
      ?.getArtifactDefinition()
      ?.getAnalogiesList();
    const contributors = this.artifact?.getArtifact()?.getContributorsList();
    switch (field) {
      case "symbol":
        return (_) =>
          this.artifact?.getArtifact()?.getArtifactSymbol()?.setTooling(_);
      case "businessDescription":
        return (_) =>
          this.artifact
            ?.getArtifact()
            ?.getArtifactDefinition()
            ?.setBusinessDescription(_);
      case "businessExample":
        return (_) =>
          this.artifact
            ?.getArtifact()
            ?.getArtifactDefinition()
            ?.setBusinessExample(_);
      case "comments":
        return (_) =>
          this.artifact?.getArtifact()?.getArtifactDefinition()?.setComments(_);
      case "analogy.name":
        return analogies && index !== undefined
          ? (_) => analogies[index].setName(_)
          : (_) => {
              const analogy = new ttfArtifact.ArtifactAnalogy();
              analogy.setName(_);
              this.artifact
                ?.getArtifact()
                ?.getArtifactDefinition()
                ?.addAnalogies(analogy);
            };
      case "analogy.description":
        return analogies && index !== undefined
          ? (_) => analogies[index].setDescription(_)
          : undefined;
      case "contributor.name":
        return contributors && index !== undefined
          ? (_) => contributors[index].setName(_)
          : (_) => {
              const contributor = new ttfArtifact.Contributor();
              contributor.setName(_);
              this.artifact?.getArtifact()?.addContributors(contributor);
            };
      case "contributor.organization":
        return contributors && index !== undefined
          ? (_) => contributors[index].setOrganization(_)
          : undefined;
    }
  }

  private async update(update: ArtifactUpdate) {
    if (!this.artifact) {
      return;
    }
    switch (update.action) {
      case "add":
        await this.updateAdd(update.type, this.resolveList(update.type));
        break;
      case "addRef":
        await this.updateAddRef(update.type);
        break;
      case "delete":
        await this.updateDelete(
          this.resolveList(update.type),
          update.existing,
          update.index
        );
        break;
      case "editListItem":
        await this.updateEditListItem(
          this.resolveList(update.type),
          update.existing
        );
        break;
      case "editString":
        await this.updateEditString(
          this.resolveSetter(update.type, update.index),
          update.existing
        );
        break;
    }
    await this.saveChanges();
  }

  private async updateAdd(description: string, list?: any[]) {
    if (!list) {
      return;
    }
    const newValue = await vscode.window.showInputBox({
      prompt: "Enter the new " + description,
    });
    if (!newValue) {
      return;
    }
    list.push(newValue);
  }

  private async updateAddRef(field: string) {
    const taxonomy = this.ttfTaxonomy.asObjects();
    if (!taxonomy) {
      return;
    }

    let addReference: (() => void) | undefined = undefined;
    let reference:
      | ttfArtifact.SymbolDependency
      | ttfArtifact.SymbolInfluence
      | undefined = undefined;
    let promptForDescription = true;
    switch (field) {
      case "dependency":
        reference = new ttfArtifact.SymbolDependency();
        addReference = () =>
          this.artifact
            ?.getArtifact()
            ?.addDependencies(reference as ttfArtifact.SymbolDependency);
        break;
      case "influencedBy":
        reference = new ttfArtifact.SymbolInfluence();
        addReference = () =>
          this.artifact
            ?.getArtifact()
            ?.addInfluencedBySymbols(reference as ttfArtifact.SymbolInfluence);
        break;
      case "incompatibleWith":
        reference = new ttfArtifact.SymbolDependency();
        promptForDescription = false;
        addReference = () =>
          this.artifact
            ?.getArtifact()
            ?.addIncompatibleWithSymbols(reference?.getSymbol());
        break;
    }
    if (!addReference || !reference) {
      return;
    }

    const quickPickItems = [
      ...taxonomy.baseTokenTypes,
      ...taxonomy.behaviorGroups,
      ...taxonomy.behaviors,
      ...taxonomy.propertySets,
    ]
      .filter(
        (_) =>
          !!_.artifact &&
          !!_.artifact.artifactSymbol &&
          !!_.artifact.artifactSymbol.id
      )
      .map(
        (_) =>
          ({
            symbol: _.artifact?.artifactSymbol,
            label: _.artifact?.name || "",
            description: _.artifact?.artifactSymbol?.id,
            detail: _.artifact?.artifactDefinition?.businessDescription,
          } as vscode.QuickPickItem & {
            symbol: ttfArtifact.ArtifactSymbol.AsObject;
          })
      );

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = quickPickItems;
    quickPick.canSelectMany = false;
    const item = await new Promise<
      | (vscode.QuickPickItem & {
          symbol: ttfArtifact.ArtifactSymbol.AsObject;
        })
      | undefined
    >((resolve) => {
      quickPick.onDidAccept(() => {
        const item = quickPick.selectedItems[0];
        resolve(
          item as vscode.QuickPickItem & {
            symbol: ttfArtifact.ArtifactSymbol.AsObject;
          }
        );
        quickPick.hide();
      });
      quickPick.onDidHide((_) => resolve(undefined));
      quickPick.show();
    });
    if (!item) {
      return;
    }

    const dependencySymbol = new ttfArtifact.ArtifactSymbol();
    dependencySymbol.setId(item.detail || "");
    dependencySymbol.setTemplateValidated(item.symbol.templateValidated);
    dependencySymbol.setTooling(item.symbol.tooling);
    dependencySymbol.setType(item.symbol.type);
    dependencySymbol.setVersion(item.symbol.version);
    dependencySymbol.setVisual(item.symbol.visual);
    reference.setSymbol(dependencySymbol);
    if (promptForDescription) {
      const description = await vscode.window.showInputBox({
        prompt: "Describe the reference (optional)",
      });
      reference.setDescription(description || "");
    }

    addReference();
  }

  private async updateEditListItem(list?: string[], existing?: string) {
    if (!list || !existing || list.indexOf(existing) === -1) {
      return;
    }
    const newValue = await vscode.window.showInputBox({
      value: existing,
      prompt: "Enter the new value",
    });
    if (!newValue) {
      return;
    }
    for (let i = 0; i < list.length; i++) {
      if (list[i] === existing) {
        list[i] = newValue;
        return;
      }
    }
  }

  private async updateEditString(
    setter?: (value: string) => void,
    existing?: string
  ) {
    if (!setter) {
      return;
    }
    const newValue = await vscode.window.showInputBox({
      value: existing,
      prompt: "Enter the new value",
    });
    if (!newValue && newValue !== "") {
      return;
    }
    setter(newValue);
  }

  private async updateDelete(
    list?: string[],
    existing?: string,
    index?: number
  ) {
    if (!list || (!existing && index === undefined)) {
      return;
    }
    const startAt =
      index !== undefined ? index : list.indexOf(existing as string);
    if (startAt === -1) {
      return;
    }
    for (let i = startAt; i < list.length - 1; i++) {
      list[i] = list[i + 1];
    }
    list.length--;
  }
}
