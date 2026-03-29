import fs from "node:fs/promises";

import { Client } from "ssh2";

import { env } from "@/lib/env";
import { quoteShell } from "@/lib/utils";

export class SSHBridge {
  private client: Client | null = null;

  private async connect() {
    if (this.client) {
      return this.client;
    }

    const privateKey = await fs.readFile(env.sshKeyPath, "utf8");

    this.client = await new Promise<Client>((resolve, reject) => {
      const client = new Client();
      client
        .on("ready", () => resolve(client))
        .on("error", reject)
        .connect({
          host: env.sshHost,
          username: env.sshUser,
          privateKey,
        });
    });

    return this.client;
  }

  async execCommand(command: string) {
    const client = await this.connect();

    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      client.exec(command, (error, stream) => {
        if (error) {
          reject(error);
          return;
        }

        let stdout = "";
        let stderr = "";

        stream.on("close", () => {
          resolve({ stdout, stderr });
        });

        stream.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });

        stream.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
      });
    });
  }

  async readFile(remotePath: string) {
    const { stdout, stderr } = await this.execCommand(
      `python3 - <<'PY'\nfrom pathlib import Path\nprint(Path(${quoteShell(remotePath)}).expanduser().read_text())\nPY`,
    );

    if (stderr) {
      throw new Error(stderr.trim());
    }

    return stdout;
  }

  async writeFile(remotePath: string, content: string) {
    const encoded = Buffer.from(content, "utf8").toString("base64");
    const { stderr } = await this.execCommand(
      `python3 - <<'PY'\nfrom pathlib import Path\nimport base64\npath = Path(${quoteShell(remotePath)}).expanduser()\npath.parent.mkdir(parents=True, exist_ok=True)\npath.write_text(base64.b64decode(${quoteShell(encoded)}).decode())\nPY`,
    );

    if (stderr) {
      throw new Error(stderr.trim());
    }
  }
}

let singleton: SSHBridge | null = null;

export const getSshBridge = () => {
  if (!singleton) {
    singleton = new SSHBridge();
  }

  return singleton;
};
