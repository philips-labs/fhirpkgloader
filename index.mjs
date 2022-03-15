#!/usr/bin/env node
"use strict";

import { createWriteStream, readdirSync, readFileSync } from 'fs';
import fetch from 'node-fetch';
import { join } from 'path';
import { cwd } from 'process';
import { Readable } from 'stream';
import Yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
const opts = Yargs(hideBin(process.argv)).option('iam', {
  alias: 'i',
  describe: 'IAM Endpoint',
  demandOption: false,
  default: 'iam-client-test.us-east.philips-healthsuite.com',
  type: 'string'
}).option('fhir', {
  alias: 't',
  describe: 'FHIR Endpoint',
  demandOption: false,
  default: 'cdr-stu3-sandbox.us-east.philips-healthsuite.com',
  type: 'string'
}).option('module', {
  alias: 'm',
  describe: 'FHIR NPM module',
  demandOption: true,
  type: 'string'
}).option('user', {
  alias: 'u',
  describe: 'User name',
  demandOption: true,
  type: 'string'
}).option('pass', {
  alias: 'w',
  describe: 'Password',
  demandOption: true,
  type: 'string'
}).option('client', {
  alias: 'c',
  describe: 'OAuth2 Client Id',
  demandOption: true,
  type: 'string'
}).option('secret', {
  alias: 's',
  describe: 'OAuth2 Client secret',
  demandOption: true,
  type: 'string'
}).option('org', {
  alias: 'o',
  describe: 'CDR tenant organization',
  demandOption: true,
  type: 'string'
}).option('fhirVersion', {
  alias: 'v',
  describe: 'FHIR Version',
  demandOption: false,
  default: '3.0',
  type: 'string'
}).argv;

const metadataResources = [
  'CodeSystem', 'ValueSet', 'ConceptMap', 'StructureDefinition',
  'SearchParameter', 'CompartmentDefinition', 'OperationDefinition'];

async function * upload(fhir, org, version, token, items) {
  for (const item of items) {
    const res = await fetch(`https://${fhir}/store/fhir/${org}/${item.resourceType}`, {
      method: 'POST', body: JSON.stringify(item),
      headers: {
        Accept: `application/fhir+json;fhirVersion=${version}`,
        Authorization: `Bearer ${token}`,
        'api-version': '1',
        'Content-Type': `application/fhir+json;fhirVersion=${version}`,
        'If-None-Exist': `url=${item.url}`
      }
    });

    const out = await res.json();
    if (res.ok) {
      console.log(`Successfully created ${item.url} with id: ${out.id}`);
    } else {
      console.error(`Failed to create ${item.resourceType} with url: ${item.url || 'unknown'}.`);
      yield JSON.stringify({
        request: item,
        response: out
      }) + "\n";
    }
  }
}

async function main() {
  const pkgPath = join(cwd(), 'node_modules', opts.module);
  const pkgContents = readdirSync(pkgPath)
    .filter(i => i.endsWith('json'))
    .map(i => JSON.parse(readFileSync(pkgPath + '/' + i, 'utf-8')))
    .filter(r => r.resourceType && metadataResources.includes(r.resourceType));

  const cmp = (r) => {
    switch (r.resourceType) {
      case 'CodeSystem': return 1;
      case 'ValueSet': return 2;
      case 'ConceptMap': return 3;
      case 'StructureDefinition': {
        if (r.type === 'Extension') return 4;
        return 5;
      }
      case 'SearchParameter':
      case 'CompartmentDefinition':
      case 'OperationDefinition':
        return 6;
      default: return 10;
    }
  }

  const token = await fetch(`https://${opts.iam}/authorize/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      username: opts.user,
      password: opts.pass
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(opts.client + ":" + opts.secret, 'binary').toString('base64')}`,
      'api-version': 2,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }).then(t => t.json()).catch(e => console.error('Failed to get token', e));
  let items = pkgContents.sort((a, b) => cmp(a) - cmp(b));
  const resStream = Readable.from(upload(opts.fhir, opts.org, opts.fhirVersion, token.access_token, items));
  resStream.pipe(createWriteStream('failures.json', 'utf-8'));
}

main();