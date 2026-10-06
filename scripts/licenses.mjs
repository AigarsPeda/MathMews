import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "licenses.json");

const EXPO_LICENSE = `
The MIT License (MIT)

Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`.trim();

const LICENSE_FILE_PATTERN = /^licen[cs]e/i;

function isExpoPackage(name) {
  return name === "expo" || name.startsWith("expo-") || name.startsWith("@expo/");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, { encoding: "utf-8" }));
}

async function findLicenseFile(dependencyPath) {
  let entries;
  try {
    entries = await fs.readdir(dependencyPath);
  } catch {
    return null;
  }

  const directMatch = entries.find(
    (file) => LICENSE_FILE_PATTERN.test(file) && !file.endsWith(".json"),
  );
  if (directMatch) {
    return path.join(dependencyPath, directMatch);
  }

  try {
    const pkg = await readPackageMetadata(dependencyPath);
    if (pkg?.licenseFile && typeof pkg.licenseFile === "string") {
      const licenseFilePath = path.join(dependencyPath, pkg.licenseFile);
      await fs.access(licenseFilePath);
      return licenseFilePath;
    }
  } catch {
    // Fall through to default licenses.
  }

  return null;
}

const SPDX_LICENSES = {
  MIT: `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
};

function formatSpdxLicense(name, pkg) {
  const body = SPDX_LICENSES[name];
  if (!body) {
    return `Licensed under the ${name} license.`;
  }

  const copyrightHolder =
    pkg.author?.name ??
    (typeof pkg.author === "string" ? pkg.author : null) ??
    pkg.name;

  return `${name} License\n\nCopyright (c) ${copyrightHolder}\n\n${body}`;
}

async function readPackageMetadata(dependencyPath) {
  try {
    return await readJson(path.join(dependencyPath, "package.json"));
  } catch {
    return null;
  }
}

async function resolveLicense(dependency, dependencyPath) {
  const licenseFile = await findLicenseFile(dependencyPath);
  if (licenseFile) {
    const license = await fs.readFile(licenseFile, { encoding: "utf-8" });
    return license.trim();
  }

  const pkg = await readPackageMetadata(dependencyPath);
  if (pkg) {
    const spdx =
      typeof pkg.license === "string"
        ? pkg.license
        : typeof pkg.license?.type === "string"
          ? pkg.license.type
          : null;
    if (spdx) {
      return formatSpdxLicense(spdx, pkg).trim();
    }
  }

  if (isExpoPackage(dependency)) {
    return EXPO_LICENSE;
  }

  return null;
}

const packageJson = await readJson(path.join(root, "package.json"));
const dependencies = Object.keys(packageJson.dependencies).sort();
const licenses = await readJson(path.join(root, "data", "asset-licenses.json"));
const missing = [];

for (const dependency of dependencies) {
  const dependencyPath = path.join(root, "node_modules", dependency);

  try {
    const license = await resolveLicense(dependency, dependencyPath);
    if (license) {
      licenses.push({ dependency, license });
      continue;
    }

    missing.push(dependency);
    console.error(`Missing license for dependency ${dependency}`);
  } catch (error) {
    missing.push(dependency);
    console.error(`Error processing dependency ${dependency}:`, error.message);
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(licenses, null, 2)}\n`, {
  encoding: "utf-8",
});

console.log(`Generated ${outputPath} with ${licenses.length} licenses.`);

if (missing.length > 0) {
  console.error(`Could not resolve ${missing.length} license(s).`);
  process.exitCode = 1;
}
