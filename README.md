# Global Lightning API client

This client provides a wrapper around MetService/Metraweather's [Lightning API](https://app.swaggerhub.com/apis-docs/ms-platform-devs/lightning-api/4.0.0) to make using the API easier.
Published to npm under [@metservice/global-lightning-client](https://www.npmjs.com/package/@metservice/global-lightning-client).

- [Global Lightning API client](#global-lightning-api-client)
- [Network delays and historic/finalised strikes](#network-delays-and-historicfinalised-strikes)
- [Installing and using this library/CLI](#installing-and-using-this-librarycli)
	- [Installing](#installing)
		- [CLI](#cli)
		- [Library](#library)
	- [Using](#using)
	- [Ingest historic data](#ingest-historic-data)
		- [When to use](#when-to-use)
		- [CLI](#cli-1)
		- [Code example](#code-example)
	- [Periodic upload of finalised data](#periodic-upload-of-finalised-data)
		- [When to use](#when-to-use-1)
		- [CLI](#cli-2)
		- [Code](#code)
	- [Long running process to upload finalised data as it becomes ready.](#long-running-process-to-upload-finalised-data-as-it-becomes-ready)
		- [When to use](#when-to-use-2)
		- [CLI](#cli-3)
		- [Code](#code-1)
	- [Non-websocket version of new data as it arrives](#non-websocket-version-of-new-data-as-it-arrives)
	- [WebSocket feed of data](#websocket-feed-of-data)
	- [Others](#others)
	- [Future work - multiple languages - Performance issues using languages other than NodeJS](#future-work---multiple-languages---performance-issues-using-languages-other-than-nodejs)
- [Licenses](#licenses)

# Network delays and historic/finalised strikes

We use the terminology historic and finalised strikes interachangably through our documentation, what this means is strikes inside a period that will not change. Due to network propogation delays and other upstream issues, strikes may be reported to the API out of order. This means that worst case it may take up to ten minutes to receive a strikes from when it occurred (we have not seen values higher than 5 minutes in practice). This means that the response to any query within the last ten minutes cannot be treated as definitive or "finalised" as a late strike may still be reported.

We have not built any functionality to deal with this complexity below, instead our use-cases assume that you will only fetch for strikes once they have been finalised. If you need strikes within the last ten minutes, please let us know by raising a ticket and we will look at adding polling/WebSocket support.

# Installing and using this library/CLI

## Installing
### CLI
This library provides a CLI which should meet most needs. You may run the latest version of this with `npx -p @metservice/global-lightning-client metraweather-global-lightning`, or a specific version with `npx -p @metservice/global-lightning-client metraweather-global-lightning@version`. Alternatively you may install it locally with `npm install -g @metservice/global-lightning-client` and then you can run `npm metraweather-global-lightning`. While every attempt will be made to not break the CLI, we recommend that you lock it to a specific version for production use-cases.

### Library
If you want to use this in a NodeJS project, you may run `npm install @metservice/global-lightning-client` or `yarn add @metservice/global-lightning-client`.

## Using
We provide a few ways to use this library depending on your use case. At it's simplest, you can use the CLI which will walk you through configuring and using it. It will ask you to set some defaults, which can be overridden at any time.

Otherwise you may import it into a NodeJS project. The three currently supported use-cases will discuss both options. For clarity's sake our CLI examples assume you have installed the CLI globally, but they will work with any installation option. The code examples are essentially what the CLI is doing under the hood. You can see these in `src/cli/commands.ts`.

## Ingest historic data

### When to use
If you want to make a request for 3 hours or more of historic/finalised data, then the following query will do so. (We would suggest doing this for any query larger than 15 minutes).

### CLI
Run `npm metraweather-global-lightning query`, this will default to asking you what you want.
The following code example can be run like so: `npm metraweather-global-lightning query --format kml --from 2020-06-20T00:00:00.000Z --to 2020-06-30T00:00:00.000Z --limit 10000 --bbox -180,-90 180,-90`

### Code example
```js
import {
	fetchPeriodOfHistoricStrikesInChunks,
	persistStrikesToFile,
	CredentialType,
	SupportedVersion,
	SupportedMimeType,
} from '@metservice/global-lightning-client';

/**
 * Fetch ten days of data in 15 minute chunks.
 * This will break the query into 960 chunks, and fetch 20 chunks at a time ensuring each chunk is finished.
 */
const fetchLargePeriodOfData = async ({ folderToDownloadStrikesTo, credentials }: ExampleArguments) => {
	const apiResponses = await fetchPeriodOfHistoricStrikesInChunks(SupportedMimeType.KML, 'PT15M', {
		apiVersion: SupportedVersion.Four,
		bbox: [-180, -90, 180, 90],
		credentials,
		limit: 10000,
		time: {
			start: '2020-06-20T00:00:00.000Z',
			end: '2020-06-30T00:00:00.000Z',
		},
	});
	const fileNames = await Promise.all(
		apiResponses.map(async ({ strikeCollection, start, end }) => {
			const fileName = `${turnIsoDateIntoUrlPath(start.toISOString())}--${turnIsoDateIntoUrlPath(end.toISOString())}.kml`;
			await persistStrikesToFile(strikeCollection, folderToDownloadStrikesTo, fileName);
			// Do something with the individual file
			return fileName;
		})
	);
	// Do something with all of the files
};
```

## Periodic upload of finalised data
### When to use
If you want to periodically fetch all new finalised data since you last ran the command/code.
### CLI
Run `npm metraweather-global-lightning configure` to configure what data you want, and then run `npm metraweather-global-lightning fetch-latest-batches`.

Every time `npm metraweather-global-lightning fetch-latest-batches` is run it will download the latest data that is not currently present.

**WARNING:** If you use STDOUT with this option, it will always fetch all the data from `from`. You must provide a new from or use FILE output to avoid this behaviour.
This can be done with `npm metraweather-global-lightning fetch-latest-batches --from 2020-10-20T14:00:00.000Z`
### Code
```js
import {
	fetchPeriodOfHistoricStrikesInChunks,
	persistStrikesToFile,
	CredentialType,
	SupportedVersion,
	SupportedMimeType,
} from '@metservice/global-lightning-client';
import { DateTime } from 'luxon';
import { promisify } from 'util';
import { readdir, mkdir } from 'fs';
/**
 * When run, this will ensure that all finalised data is fetched.
 *
 * NOTE: This is using luxon to parse the DateTime, but you could do this with anything that can returns a sortable date.
 * Alternatively, you could just run this every hour and download an hour and half of data.
 *
 * persistStrikesToFile will overwrite any existing files.
 */
const fetchAllFinishedData = async ({ folderToDownloadStrikesTo, credentials }: ExampleArguments) => {
	//Ensure the folder exists before reading from it
	await mkdirPromise(folderToDownloadStrikesTo, { recursive: true });
	const files = await readdirPromise(folderToDownloadStrikesTo);
	const FILE_ISO_STRING_FORMAT = 'yyyy-MM-ddTHH-mm-ss-SSSZ';

	/**
	 * Subtracts an hour from the current time, the rounds it to the nearest hour.
	 */
	const getAnHourAgoRoundedToTheHour = () => {
		const millisecondsInHour = 60 * 60 * 1000;
		return new Date(Math.round((Date.now() - millisecondsInHour) / millisecondsInHour) * millisecondsInHour);
	};

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
	const latestToTime = fetchedDates.pop() || getAnHourAgoRoundedToTheHour();
	const strikeCollections = await fetchLatestHistoricStrikesInChunks(SupportedMimeType.KML, 'PT15M', {
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
			await persistStrikesToFile(strikeCollection, folderToDownloadStrikesTo, fileName);
			// Do something with the individual file
			return fileName;
		})
	);
	// Do something with all the new files
};
```

## Long running process to upload finalised data as it becomes ready.
### When to use
If you want to a process that will continiously fetch all new finalised data.
### CLI
Run `npm metraweather-global-lightning configure` to configure what data you want, and then run `npm metraweather-global-lightning stream-latest-batches`.

Every time `npm metraweather-global-lightning stream-latest-batches` is run it will download the latest data that is not currently present and then download data as it becomes available. In this way, it is recoverable so the command can be interupted.

**WARNING:** If you use STDOUT with this option, it will always fetch all the data from `from`. You must provide a new from or use FILE output to avoid this behaviour.
This can be done with `npm metraweather-global-lightning stream-latest-batches --from 2020-10-20T14:00:00.000Z`

### Code
NOTE: This sample is not the same as the CLI, namely it does not handle recovering if the command is stopped. If you want that, you can use the code from `fetchAllFinishedData` and then use this. See `src/cli/commands.ts - streamLatestStrikeBatches` for a reference implementation.
```js
/**
 * Every time a 15 minute chunk is finalised, it is published here
 */
const getStrikesAsTheyAreFinalised = async () => {
	await fetchStrikesWhenFinalised(
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

Have another use case? Raise a ticket and let us know. In the mean time, the lower-level utility functions are also available. `fetchAllStrikesOverAreaAndTime` will fetch strikes handling the pagination for you, `fetchAndFormatStrikesAndFormatRetryingOnFail` will fetch strikes but without the pagination (it will let you know if there are still strikes to fetch).

```js
/**
 * Fetch twenty minutes of data from an hour ago
 */
const fetchHistoricData = async ({ folderToDownloadStrikesTo, credentials }: ExampleArguments) => {
	const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const fortyMinutesAgo = new Date(anHourAgo.valueOf() + 20 * 60 * 1000);
	const strikeCollection = await fetchAllStrikesOverAreaAndTime(SupportedMimeType.KML, {
		apiVersion: SupportedVersion.Four,
		bbox: [-180, -90, 180, 90],
		credentials,
		limit: 10000,
		time: {
			start: anHourAgo,
			end: fortyMinutesAgo,
		},
	});
	await persistStrikesToFile(
		strikeCollection,
		folderToDownloadStrikesTo,
		`${turnIsoDateIntoUrlPath(anHourAgo.toISOString())}--${turnIsoDateIntoUrlPath(fortyMinutesAgo.toISOString())}.kml`
	);
};
```

## Future work - multiple languages - Performance issues using languages other than NodeJS

We plan on supporting other languages using [jsii](https://github.com/aws/jsii) to generate the non-NodeJS libraries. This involves spinning up a NodeJS engine and has communication costs. What we are doing here is not particularly intensive and as such should not be too much of a problem but if you need to use this in a resource constrained environment this may not be appropriate.

If this is the case please let us know via a ticket, a Support Desk ticket, or a PR. This library is published under MIT, you are free to take our code and port this across to your preferred language.

# Licenses

- [isomorphic-fetch](https://www.npmjs.com/package/isomorphic-fetch) - MIT
- [luxon](https://www.npmjs.com/package/luxon) - MIT
- [parse-link-header](https://www.npmjs.com/package/parse-link-header) - MIT
- [xml2js](https://www.npmjs.com/package/xml2js) - MIT
