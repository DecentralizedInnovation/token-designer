import * as childProcess from "child_process";
import * as vscode from "vscode";

export abstract class BaseServiceHost {
  private healthy = false;
  private everHealthy = false;
  private terminal: vscode.Terminal | null = null;

  protected static async initialize(host: BaseServiceHost): Promise<boolean> {
    if (!BaseServiceHost.checkForDotNet()) {
      vscode.window.showErrorMessage(
        ".NET Core 3+ is required to get the most out of the Token Designer."
      );
      return false;
    }

    await host.watchdog();

    let attempts = 0;
    while (true) {
      try {
        attempts++;
        console.log(
          `Waiting for healthy ${host.terminalName} service host...`,
          attempts
        );
        if (attempts > 15) {
          return false;
        }
        if (host.healthy) {
          return true;
        }
      } catch {
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  protected constructor(
    private readonly binaryPath: string,
    private readonly terminalName: string,
    private readonly isHealthy: () => Promise<boolean>
  ) {}

  async restart() {
    this.terminal?.dispose();
    this.terminal = null;
    this.healthy = false;
    this.everHealthy = false; // Speed up detection of healthy service
    this.ensureTerminal();
    console.log(this.terminalName, "Waiting for restart...");
    while (!this.healthy) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.log(this.terminalName, "restart complete");
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
      name: this.terminalName,
      shellPath: "dotnet",
      shellArgs: dotNetArguments,
      hideFromUser: false,
    });
  }

  private async watchdog() {
    try {
      if (await this.isHealthy()) {
        this.healthy = true;
        this.everHealthy = true;
      } else {
        throw Error();
      }
    } catch {
      this.healthy = false;
      console.log(
        this.terminalName,
        "No working connection to a local server; connecting now..."
      );
      this.ensureTerminal();
    } finally {
      setTimeout(() => this.watchdog(), this.everHealthy ? 15000 : 250);
    }
  }

  dispose() {
    this.terminal?.dispose();
  }
}
