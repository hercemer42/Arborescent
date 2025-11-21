#!/usr/bin/env node

/**
 * Migration script to convert Arborescent JSON files to YAML with .arbo extension
 *
 * Usage:
 *   node scripts/migrate-json-to-arbo.mjs <file-or-directory>
 *   node scripts/migrate-json-to-arbo.mjs arbo/todo.json
 *   node scripts/migrate-json-to-arbo.mjs arbo/
 *
 * This script will:
 * 1. Find all .json files in the specified path
 * 2. Validate they are Arborescent files
 * 3. Convert them to YAML format
 * 4. Save them with .arbo extension
 * 5. Optionally delete the original .json files
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function isArboFile(content) {
  try {
    const data = JSON.parse(content);
    return data.format === 'Arborescent';
  } catch {
    return false;
  }
}

async function convertFile(filePath) {
  console.log(`Processing: ${filePath}`);

  try {
    // Read the JSON file
    const content = await fs.readFile(filePath, 'utf-8');

    // Check if it's an Arborescent file
    if (!await isArboFile(content)) {
      console.log(`  ⚠️  Skipping (not an Arborescent file): ${filePath}`);
      return false;
    }

    // Parse JSON
    const data = JSON.parse(content);

    // Convert to YAML
    const yamlContent = yaml.dump(data, { indent: 2, lineWidth: -1 });

    // Generate new filename with .arbo extension
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, '.json');
    const newPath = path.join(dir, `${basename}.arbo`);

    // Write YAML file
    await fs.writeFile(newPath, yamlContent, 'utf-8');
    console.log(`  ✓ Converted: ${newPath}`);

    return true;
  } catch (error) {
    console.error(`  ✗ Error converting ${filePath}:`, error.message);
    return false;
  }
}

async function findJsonFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/migrate-json-to-arbo.mjs <file-or-directory>');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/migrate-json-to-arbo.mjs arbo/todo.json');
    console.error('  node scripts/migrate-json-to-arbo.mjs arbo/');
    process.exit(1);
  }

  const targetPath = args[0];

  try {
    const stat = await fs.stat(targetPath);
    let filesToConvert = [];

    if (stat.isDirectory()) {
      console.log(`Scanning directory: ${targetPath}`);
      filesToConvert = await findJsonFiles(targetPath);
    } else if (stat.isFile() && targetPath.endsWith('.json')) {
      filesToConvert = [targetPath];
    } else {
      console.error('Error: Target must be a .json file or directory');
      process.exit(1);
    }

    if (filesToConvert.length === 0) {
      console.log('No .json files found to convert.');
      return;
    }

    console.log(`Found ${filesToConvert.length} file(s) to process\n`);

    let converted = 0;
    for (const file of filesToConvert) {
      if (await convertFile(file)) {
        converted++;
      }
    }

    console.log(`\n✓ Conversion complete: ${converted}/${filesToConvert.length} files converted`);

    if (converted > 0) {
      console.log('\nNote: Original .json files have been preserved.');
      console.log('You can delete them manually after verifying the .arbo files.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
