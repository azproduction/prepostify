#!/usr/bin/env -S npx --no tsx
import sharp from 'sharp';
import assert from 'assert';
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';

const [, , ...fileNames] = process.argv;

assert(fileNames.length > 0, 'fileName is required');

const aspectRatio = 4 / 5;
const targetHeight = 2048;
const targetWidth = Math.round(targetHeight * aspectRatio);

function withSuffix(fileName: string, suffix: string): string {
    const ext = path.extname(fileName);

    return path.join(
        path.dirname(fileName),
        `${path.basename(fileName, ext)}-${suffix}${ext}`
    );
}

async function processImage(content: Buffer): Promise<Buffer> {
    let { width = 0, height = 0 } = await sharp(content).metadata();

    assert(width !== 0, 'width is 0');
    assert(height !== 0, 'height is 0');

    if (height >= width) {
        // Vertical: resize so height = 2048, no upscaling; if already small, just copy
        if (Math.max(width, height) <= targetHeight) {
            return content;
        }
        return sharp(content).withMetadata().resize({
            withoutEnlargement: true,
            height: targetHeight,
        }).toBuffer();
    }

    // Horizontal: add blurred top/bottom padding to make 4:5
    // Resize so width is at most targetWidth
    const resizedContent = await sharp(content).withMetadata().resize({
        withoutEnlargement: true,
        width: targetWidth,
    }).toBuffer();

    const resizedMeta = await sharp(resizedContent).metadata();
    const resizedWidth = resizedMeta.width!;
    const resizedHeight = resizedMeta.height!;

    const canvasHeight = Math.round(resizedWidth / aspectRatio);
    const padTop = Math.ceil((canvasHeight - resizedHeight) / 2);

    // Create blurred version stretched to fill the 4:5 area
    const blurredBg = await sharp(resizedContent)
        .withMetadata()
        .resize(resizedWidth, canvasHeight, {
            fit: 'cover',
        })
        .blur(24)
        .toBuffer();

    // Composite sharp image centered on blurred background
    return await sharp(blurredBg)
        .composite([{
            input: resizedContent,
            left: 0,
            top: padTop,
        }])
        .jpeg({
            quality: 95,
            force: false,
        })
        .toBuffer();
}

await Promise.all(
    fileNames.map(async (fileName) => {
        const outputFile = withSuffix(fileName, `${targetHeight}-p`);

        if (existsSync(outputFile)) {
            console.log(`⚠️️ ${outputFile}`);
            return;
        }

        const content = await fs.readFile(fileName);
        const result = await processImage(content);

        await fs.writeFile(outputFile, result);
        console.log(`☑️ ${outputFile}`);
    })
)
