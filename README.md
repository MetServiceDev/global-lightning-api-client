# Global Lightning API client

This client provides a wrapper around the Lightning API to make using the API easier. Most of it is automatically generated using our OpenRest documentation, with us providing some glue to handle things like pagination.

- [Global Lightning API client](#global-lightning-api-client)
- [Using this library](#using-this-library) - [Ingest historic data](#ingest-historic-data) - [Periodic upload of finalised data](#periodic-upload-of-finalised-data) - [Long running process to upload finalised data as it becomes ready.](#long-running-process-to-upload-finalised-data-as-it-becomes-ready) - [Non-websocket version of new data as it arrives](#non-websocket-version-of-new-data-as-it-arrives) - [WebSocket feed of data](#websocket-feed-of-data) - [Others](#others) - [Performance issues using languages other than NodeJS](#performance-issues-using-languages-other-than-nodejs)
- [Licenses](#licenses)

# Using this library

We provide a few ways to use this library depending on your use case. The up-to-date running versions of the code below lives in bin/examples.ts. We have extracted some common utility definitions such as the directory to store things and credentials. These are defined in the `bin/examples.ts` but are unnecessary noise below.

NOTE: Historic and finalised strikes are interchangable below and in this context they mean any period older than ten minutes ago.

## Ingest historic data

If you want to make a request for 3 hours or more of historic/finalised data, then the following query will do so. (We would suggest doing this for any query larger than 15 minutes).

```js
import {
	fetchAllFinalisedStrikesInChunks,
	persistStrikesToFile,
	CredentialType,
	SupportedVersion,
	SupportedMimeType,
} from '@metservice/global-lightning-client';
// Fill me in with your credentials.
const credentials = {
	type: CredentialType.jwt,
	token: '',
};
/**
 * Fetch ten days of data in 15 minute chunks.
 * This will make 960 parallel requests and ensure each chunk has its own data.
 */
const historicChunkedUsage = async () => {
	const strikeCollections = await fetchAllHistoricStrikesOverAreaAndTimeInChunks(SupportedMimeType.KML, 'PT15M', {
		apiVersion: SupportedVersion.Four,
		bbox: [-180, -90, 180, 90],
		credentials,
		limit: 10000,
		time: {
			start: '2020-06-20T00:00:00.000Z',
			end: '2020-06-30T00:00:00.000Z',
		},
	});
	await Promise.all(
		strikeCollections.map(async ({ strikeCollection, start, end }) => {
			const fileName = `${turnIsoDateIntoUrlPath(start.toISOString())}--${turnIsoDateIntoUrlPath(end.toISOString())}.kml`;
			await persistStrikesToFile(strikeCollection, FOLDER_TO_DOWNLOAD_STRIKES_TO, fileName);
			// Do something with the individual file
		})
	);
	// Do something with all of the files
};
```

## Periodic upload of finalised data

If you want to periodically fetch all new finalised data since you last ran it.

```js
/**
 * When run, this will ensure that all finalised data is fetched.
 *
 * NOTE: This is using luxon to parse the DateTime, but you could do this with anything that can returns a sortable date.
 * Alternatively, you could just run this every hour and download an hour and half of data.
 *
 * persistStrikesToFile will overwrite any existing files.
 */
const getAllFinalisedStrikes = async () => {
	const files = await readdirPromise(FOLDER_TO_DOWNLOAD_STRIKES_TO);
	const FILE_ISO_STRING_FORMAT = 'yyyy-MM-ddTHH_mm_ss_SSSZ';
	/**
	 *	For all the previously fetched files:
	 *	- Extract the finished time out of the filename and parse it into a sortable date
	 * Sort the array of dates, so that the last item is the latest date
	 */

	const fetchedDates = files
		.map((fileName) => {
			const [name] = fileName.split('.');
			const [from, to] = name.split('--');
			return DateTime.fromFormat(to, FILE_ISO_STRING_FORMAT);
		})
		.sort();
	// The latest date, or an hour ago.
	const latestToTime = fetchedDates.pop() || new Date(Date.now() - 60 * 60 * 1000);
	const strikeCollections = await fetchAllFinalisedStrikesInChunks(SupportedMimeType.KML, 'PT15M', {
		apiVersion: SupportedVersion.Four,
		bbox: [-180, -90, 180, 90],
		credentials,
		limit: 10000,
		time: {
			start: latestToTime,
		},
	});
	const newFiles = await Promise.all(
		strikeCollections.map(async ({ strikeCollection, start, end }) => {
			const fileName = `${turnIsoDateIntoUrlPath(start.toISOString())}--${turnIsoDateIntoUrlPath(end.toISOString())}.kml`;
			await persistStrikesToFile(strikeCollection, FOLDER_TO_DOWNLOAD_STRIKES_TO, fileName);
			// Do something with the individual file
			return fileName;
		})
	);
	// Do something with all the new files
};
```

## Long running process to upload finalised data as it becomes ready.

```js
/**
 * Every time a 15 minute chunk is finalised, it is published here
 */
const getStrikesAsTheyAreFinalised = async () => {
	await getADurationOfStrikesOnceFinalised(
		SupportedMimeType.GeoJsonV3,
		'PT15M',
		{
			apiVersion: SupportedVersion.Four,
			bbox: [-180, -90, 180, 90],
			credentials,
			limit: 10000,
			time: {
				start: '2020-02-01T00:00:00.000Z',
			},
		},
		async ({ strikeCollection, start, end }) => {
			await persistStrikesToFile(
				strikeCollection,
				FOLDER_TO_DOWNLOAD_STRIKES_TO,
				`${turnIsoDateIntoUrlPath(start.toISOString())}--${turnIsoDateIntoUrlPath(end.toISOString())}.json`
			);
		}
	);
};
```

## Non-websocket version of new data as it arrives

This is not currently implemented

## WebSocket feed of data

This is not currently on the roadmap

## Others

Have another use case? Raise a ticket and let us know. In the mean time, the lower-level utility functions are also available.

## Performance issues using languages other than NodeJS

This uses [jsii](https://github.com/aws/jsii) to generate the non-NodeJS libraries. This involves spinning up a NodeJS engine and has communication costs. What we are doing here is not particularly intensive and as such should not be too much of a problem but if you need to use this in a resource constrained environment this may not be appropriate.

If this is the case please let us know via a ticket, a Support Desk ticket, or a PR. We currently only provide jsii libraries in other languages, but Azure AutoRest can compile to other languages. This library is published under MIT, you are free to take our Azure AutoRest configuration, use this to generate code in your native language and port our helper code across.

# Licenses

- JSII - Apache 2.0
- Luxon
