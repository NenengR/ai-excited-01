import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1024;

function pngSize(image) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!image.subarray(0, signature.length).equals(signature)) {
    return undefined;
  }

  if (image.length < 24) {
    throw new Error("The PNG header is incomplete");
  }

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

function jpegSize(image) {
  if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8) {
    return undefined;
  }

  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;

  while (offset < image.length) {
    while (image[offset] === 0xff && offset + 1 < image.length) {
      offset += 1;
    }

    const marker = image[offset];
    offset += 1;

    if (marker === undefined || marker === 0xd9) {
      break;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > image.length) {
      throw new Error("The JPEG segment header is incomplete");
    }

    const segmentLength = image.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > image.length) {
      throw new Error("The JPEG segment is invalid");
    }

    if (frameMarkers.has(marker)) {
      if (segmentLength < 7) {
        throw new Error("The JPEG frame header is invalid");
      }

      return {
        height: image.readUInt16BE(offset + 3),
        width: image.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  throw new Error("The JPEG has no frame header");
}

function validateImage(image) {
  if (image.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `The image is ${image.length} bytes; the maximum is ${MAX_IMAGE_BYTES} bytes`,
    );
  }

  const size = pngSize(image) ?? jpegSize(image);
  if (!size) {
    throw new Error("The entry must be a PNG or JPEG image");
  }

  if (
    size.width < 1 ||
    size.height < 1 ||
    size.width > MAX_IMAGE_DIMENSION ||
    size.height > MAX_IMAGE_DIMENSION
  ) {
    throw new Error(
      `The image is ${size.width}x${size.height}; the maximum is ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}`,
    );
  }
}

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(repositoryRoot, "entry.png");
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outputPath = path.join(outputDirectory, "entry.png");

const sourceImage = await readFile(sourcePath);
validateImage(sourceImage);

await mkdir(outputDirectory, { recursive: true });
await copyFile(sourcePath, outputPath);

const outputImage = await readFile(outputPath);
validateImage(outputImage);

if (!outputImage.equals(sourceImage)) {
  throw new Error("The copied output does not match the source image");
}
