import * as childProcess from "child_process";
import * as path from "path";
import * as vscode from "vscode";

export class TaxonomyServiceHost {
  static async create(
    context: vscode.ExtensionContext
  ): Promise<TaxonomyServiceHost | undefined> {
    if (!TaxonomyServiceHost.checkForDotNet()) {
      vscode.window.showErrorMessage(
        ".NET Core 3+ is required to get the most out of the Token Designer."
      );
      return undefined;
    }
    return new TaxonomyServiceHost();
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

  dispose() {}
}
