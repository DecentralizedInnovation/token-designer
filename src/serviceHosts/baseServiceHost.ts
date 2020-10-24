import * as childProcess from "child_process";
import * as extractZip from "extract-zip";
import * as fs from "fs";
import * as grpc from "grpc";
import * as path from "path";
import * as rimraf from "rimraf";
import * as ttfArtifacts from "../ttf/artifact_pb";
import * as ttfClient from "../ttf/service_grpc_pb";
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
          "Waiting for healthy local taxonomy service host...",
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

  protected constructor(private readonly binaryPath: string) {}

  async restart() {
    this.terminal?.dispose();
    this.terminal = null;
    this.healthy = false;
    this.everHealthy = false; // Speed up detection of healthy service
    this.ensureTerminal();
    console.log("Waiting for sandbox host to restart...");
    while (!this.healthy) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.log("Sandbox host restart complete");
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
  }

  private async watchdog() {
    try {
      const connection = new ttfClient.ServiceClient(
        "localhost:8086",
        grpc.credentials.createInsecure()
      );
      await new Promise((resolve, reject) =>
        connection.getConfig(new ttfArtifacts.ConfigurationRequest(), (err) =>
          err ? reject() : resolve()
        )
      );
      this.healthy = true;
      this.everHealthy = true;
    } catch {
      this.healthy = false;
      console.log(
        "No working connection to a local TTF server; connecting now..."
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
