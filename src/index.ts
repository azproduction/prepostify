#!/usr/bin/env -S npx --no tsx
import sharp from 'sharp';
import assert from 'assert';
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';

const [, , ...fileNames] = process.argv;

assert(fileNames.length > 0, 'fileName is required');

function resizeToLongestSize(longestSide: number = 2048) {
    return async function (content: Buffer) {
        let { width = 0, height = 0 } = await sharp(content).metadata();

        assert(width !== 0, 'width is 0');
        assert(height !== 0, 'width is 0');

        return sharp(content).withMetadata().resize({
            withoutEnlargement: true,
            width: width > height ? longestSide : undefined,
            height: height >= width ? longestSide : undefined,
        }).toBuffer();
    }
}

function squareupWithGaussianBlur(longestSide: number = 2048) {
    return async function (content: Buffer) {
        let { width = 0, height = 0 } = await sharp(content).metadata();

        assert(width !== 0, 'width is 0');
        assert(height !== 0, 'width is 0');

        const resizedContent = await resizeToLongestSize(longestSide)(content);

        ({width = 0, height = 0} = await sharp(resizedContent).metadata());
        const biggestDimension = Math.max(width, height);

        const imageLayer = await sharp(resizedContent)
            .withMetadata()
            .extend({
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                bottom: Math.floor((biggestDimension - height) / 2),
                top: Math.ceil((biggestDimension - height) / 2),
                left: Math.floor((biggestDimension - width) / 2),
                right: Math.ceil((biggestDimension - width) / 2),
            })
            .toFormat('png')
            .toBuffer();

        return await sharp(resizedContent)
            .withMetadata()
            .resize(biggestDimension, biggestDimension, {
                fit: 'cover',
            })
            .blur(24)
            .composite([
                {
                    input: imageLayer,
                    gravity: 'centre',
                },
            ])
            .jpeg({
                quality: 95,
                force: false,
            })
            .toBuffer();
    }
}

function withSuffix(fileName: string, suffix: string): string {
    const ext = path.extname(fileName);

    return path.join(
        path.dirname(fileName),
        `${path.basename(fileName, ext)}-${suffix}${ext}`
    );
}

const longestSide = 2048;

await Promise.all(
    fileNames.map(async (fileName) => {
        const outputs: [string, (content: Buffer) => Promise<Buffer>][] = [
            [
                withSuffix(fileName, `${longestSide}`),
                resizeToLongestSize(longestSide)
            ],
            [
                withSuffix(fileName, `${longestSide}-s`),
                squareupWithGaussianBlur(longestSide)
            ]
        ];

        const content = await fs.readFile(fileName);

        await Promise.all(
            outputs.map(async ([outputFile, processor]) => {
                if (existsSync(outputFile)) {
                    console.log(`⚠️️ ${outputFile}`);
                    return;
                }

                const result = await processor(content);

                await fs.writeFile(outputFile, result);
                console.log(`☑️ ${outputFile}`);
            })
        );
    })
)
