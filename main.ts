import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(repositoryRoot, "entry.png");
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outputPath = path.join(outputDirectory, "entry.png");

const entryImage = await readFile(inputPath);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, entryImage);

const outputSize = (await stat(outputPath)).size;
if (outputSize !== entryImage.byteLength) {
  throw new Error(
    `Output size mismatch: expected ${entryImage.byteLength} bytes, received ${outputSize}`,
  );
}
