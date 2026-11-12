#!/usr/bin/env node
'use strict';

const { execFile } = require('node:child_process');

const API_BASE = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 10_000;

function usage() {
  return [
    'Usage:',
    '  snip add <url>    Create a short link',
    '  snip ls           List links and hit counts',
    '  snip open <code>  Open the original URL in your browser',
    '  snip help         Show this help',
  ].join('\n');
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

async function request(path, options = {}) {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw new Error(`Could not reach the Snip API at ${API_BASE}: ${error.message}`);
  }
}

async function errorMessage(response) {
  try {
    const body = await response.json();
    if (typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Use the status-based message when the server does not return JSON.
  }
  return `API request failed with status ${response.status}`;
}

async function add(urlArgument) {
  if (!urlArgument) {
    throw new Error('Provide a URL to add.');
  }

  let url;
  try {
    url = new URL(urlArgument);
  } catch {
    throw new Error('Provide a valid http or https URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Provide a valid http or https URL.');
  }

  const response = await request('/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: urlArgument }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const link = await response.json();
  if (typeof link.shortUrl !== 'string' || link.shortUrl.length === 0) {
    throw new Error('The API response did not include a shortUrl.');
  }
  console.log(link.shortUrl);
}

async function list() {
  const response = await request('/api/links');
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const links = await response.json();
  if (!Array.isArray(links)) {
    throw new Error('The API response was not a link list.');
  }
  if (links.length === 0) {
    console.log('No links yet.');
    return;
  }

  const rows = links.map((link) => {
    if (
      typeof link.code !== 'string' ||
      !Number.isFinite(link.hits) ||
      typeof link.url !== 'string'
    ) {
      throw new Error('The API returned a link with an invalid shape.');
    }
    return [link.code, String(link.hits), link.url];
  });
  const codeWidth = Math.max(4, ...rows.map(([code]) => code.length));
  const hitsWidth = Math.max(4, ...rows.map(([, hits]) => hits.length));
  console.log(`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`);
  for (const [code, hits, url] of rows) {
    console.log(`${code.padEnd(codeWidth)}  ${hits.padStart(hitsWidth)}  ${url}`);
  }
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(new Error(`Could not open the browser: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

async function open(code) {
  if (!code) {
    throw new Error('Provide a short code to open.');
  }

  const response = await request(`/${encodeURIComponent(code)}`, { redirect: 'manual' });
  if (response.status === 404) {
    throw new Error(`No link found for code "${code}".`);
  }
  if (response.status < 300 || response.status >= 400) {
    throw new Error(await errorMessage(response));
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new Error('The API redirect did not include a Location header.');
  }

  let destination;
  try {
    destination = new URL(location);
  } catch {
    throw new Error('The API redirect included an invalid destination URL.');
  }
  if (!['http:', 'https:'].includes(destination.protocol)) {
    throw new Error('The API redirect destination must use http or https.');
  }

  await openBrowser(destination.href);
  console.log(`Opening ${destination.href}`);
}

async function main() {
  const [command, argument, ...extraArguments] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(usage());
    return;
  }
  if (extraArguments.length > 0) {
    throw new Error('Too many arguments.');
  }

  switch (command) {
    case 'add':
      await add(argument);
      break;
    case 'ls':
      if (argument) throw new Error('The ls command does not accept arguments.');
      await list();
      break;
    case 'open':
      await open(argument);
      break;
    default:
      throw new Error(`Unknown command "${command}".\n\n${usage()}`);
  }
}

main().catch((error) => fail(error.message));
