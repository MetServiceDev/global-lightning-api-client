#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
LIB="$DIR/lib";

docker run --rm -v ${LIB}:/mds-types swaggerapi/swagger-codegen-cli:2.4.14 generate \
    -i https://app.swaggerhub.com/apiproxy/schema/file/apis/ms-platform-devs/lightning-api/4.0.0?format=json
    -l typescript-angular \
    -o /mds-types

docker run --rm -v ${LIB}:/mds-types alpine chmod -R 777 /mds-types