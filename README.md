# FHIR Package Loader

## Overview

This tool can be used to upload FHIR NPM packages from any repository to HSP CDR.
This tool will collect the below FHIR metadata artifacts in JSON format in the below order and publish to CDR.

1. CodeSystem
1. ValueSet
1. ConceptMap
1. StructureDefinition(extension)
1. StructureDefinition(profile)
1. SearchParameter
1. CompartmentDefinition
1. OperationDefinition

It uses FHIR conditional create interaction with `If-None-Exist` to create the artifact only if it doesn't exist.

## Downloading packages

This tool relies on NPM to download packages from any FHIR NPM repository. The packages can be added as regular or developmental dependencies.

For example,

1. To retrieve a standard FHIR package from https://packages.fhir.org
    ```
    npm --registry https://packages.fhir.org install --save-dev hl7.fhir.r3.core
    npm --registry https://packages.fhir.org install --save-dev hl7.fhir.r4.core
    npm --registry https://packages.fhir.org install --save-dev hl7.fhir.us.core
    ```
1. To retrieve a private package from https://packages.simplifier.net
    ```
    npm --registry https://packages.simplifier.net install --save-dev nictiz.fhir.nl.stu3.zib2017
    ```
1. To retrieve from ILS-NPM repo from Artifactory (omitting version to get latest dev version)
    ```
    npm --registry https://artifactory-ehv.ta.philips.com/artifactory/api/npm/CAO-ILS-NPM install --save-dev com.philips.fhir.stu3.common@2021.2.1
    npm --registry https://artifactory-ehv.ta.philips.com/artifactory/api/npm/CAO-ILS-NPM install --save-dev com.philips.fhir.stu3.ambulatorycare@2021.2.1
    npm --registry https://artifactory-ehv.ta.philips.com/artifactory/api/npm/CAO-ILS-NPM install --save-dev com.philips.fhir.stu3.populationhealthmanagement@2020.1.0
    ```

For authenticating to ILS Artifactory outside the PGN network, you will need to export your CODE1 user certificate and private key in PEM format.
After that, create the file `.npmrc` as below with newline escaping of the certificate and private key.
That is, change all newline characters to `\n`

```
registry=https://artifactory-ehv.ta.philips.com/artifactory/api/npm/CAO-ILS-NPM/
cert="-----BEGIN CERTIFICATE-----\n.....\n-----END CERTIFICATE-----"
key="-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----"
```

## Usage

Once the necessary FHIR packages are downloaded using NPM, this tool can then be used to upload that package to CDR.
This tool extracts the necessary artifacts of the installed module from the `node_modules` directory.

```
./index.js

Options:+
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -i, --iam      IAM Endpoint
           [string] [default: "iam-client-test.us-east.philips-healthsuite.com"]
  -t, --fhir     FHIR Endpoint
          [string] [default: "cdr-stu3-sandbox.us-east.philips-healthsuite.com"]
  -m, --module   FHIR NPM module name                        [string] [required]
  -u, --user     User name                                   [string] [required]
  -w, --pass     Password                                    [string] [required]
  -c, --client   OAuth2 Client Id                            [string] [required]
  -s, --secret   OAuth2 Client secret                        [string] [required]
  -o, --org      CDR tenant organization                     [string] [required]
```

**Example**

Here, we are trying to upload ILS-AmbulatoryCare. But ILS-AmbulatoryCare depends on ILS-Common.
So first we need to download ILS-Common and upload it to CDR

```
npm --registry https://artifactory-ehv.ta.philips.com/artifactory/api/npm/CAO-ILS-NPM install --save-dev com.philips.fhir.stu3.common@2021.2.1

./index.js -m com.philips.fhir.stu3.common -u "<HSP IAM Login ID>" -w "<Password>" -c "<OAuth2 Client ID>" -s "<OAuth2 Client Secret>" -o "<CDR Tenant Org ID>"
```

Then, similarly for ILS-AmbulatoryCare,
```
npm --registry https://artifactory-ehv.ta.philips.com/artifactory/api/npm/CAO-ILS-NPM install --save-dev com.philips.fhir.stu3.ambulatorycare@2021.2.1

./index.js -m com.philips.fhir.stu3.ambulatorycare -u "<HSP IAM Login ID>" -w "<Password>" -c "<OAuth2 Client ID>" -s "<OAuth2 Client Secret>" -o "<CDR Tenant Org ID>"
```

Any failures are captured along with their responses into the file `failures.json`
