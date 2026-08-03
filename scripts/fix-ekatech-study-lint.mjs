import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, search, replacement, label) {
	const source = await readFile(path, 'utf8');
	if (!source.includes(search)) throw new Error(`Could not find ${label}`);
	await writeFile(path, source.replace(search, replacement));
}

await replace(
	'src/ekatech-study.ts',
	'.replace(/[\\\\/:*?"<>|\\u0000-\\u001F]/g, \'-\')',
	'.replace(/[\\\\/:*?"<>|]/g, \'-\')',
	'safe filename regex',
);

await replace(
	'src/main.ts',
	'\tnormalizePath,\n\topenExternal,\n} from \'obsidian\';',
	'\tnormalizePath,\n} from \'obsidian\';',
	'openExternal import',
);
await replace(
	'src/main.ts',
	'\t\topenExternal(createEkatechStudyConnectURL(nonce));',
	"\t\twindow.open(createEkatechStudyConnectURL(nonce), '_blank', 'noopener,noreferrer');",
	'link opening call',
);

await replace(
	'src/gallery-view.ts',
	'\t\t\t\tconst binary = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;',
	'\t\t\t\tconst binary = Uint8Array.from(encoded).buffer;',
	'array buffer assertion',
);

let eslint = await readFile('eslint.config.mts', 'utf8');
if (!eslint.includes("scripts/fix-ekatech-study-lint.mjs")) {
	eslint = eslint.replace(
		"\t\t'scripts/apply-ekatech-study-integration.mjs',",
		"\t\t'scripts/apply-ekatech-study-integration.mjs',\n\t\t'scripts/fix-ekatech-study-lint.mjs',",
	);
}
await writeFile('eslint.config.mts', eslint);
