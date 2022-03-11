#!/usr/bin/env node
"use strict";

import {dirname} from 'path';
import { readdirSync, writeFileSync } from 'fs';
import fetch from 'node-fetch'; 
import {hideBin} from 'yargs/helpers';
import Yargs from 'yargs';
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
}).argv;
const metadataResources = [
  'CodeSystem', 'ValueSet', 'ConceptMap', 'StructureDefinition',
  'SearchParameter', 'CompartmentDefinition', 'OperationDefinition'];


async function main() {
  const pkgPath = dirname(require.resolve(opts.module + '/package.json'));
  const pkgContents = readdirSync(pkgPath)
    .filter(i => i.endsWith('json'))
    .map(i => require(pkgPath + '/' + i))
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
  }).then(t => t.json());
  let failures = [];
  for (const item of pkgContents.sort((a, b) => cmp(a) - cmp(b))) {
    const res = await fetch(`https://${opts.fhir}/store/fhir/${opts.org}/${item.resourceType}`, {
      method: 'POST', body: JSON.stringify(item),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token.access_token}`,
        'api-version': '1',
        'Content-Type': 'application/json',
        'If-None-Exist': `url=${item.url}`
      }
    });

    const out = await res.json();
    if (res.ok) {
      console.log(`Successfully created ${item.url} with id: ${out.id}`);
    } else {
      console.log(`Failed to create ${item.resourceType} with url: ${item.url || 'unknown'}.`);
      failures.push({
        request: item,
        response: out
      })
    }
  }

  if (failures)
    writeFileSync('failures.json', JSON.stringify(failures));
}

main();