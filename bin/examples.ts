import {
	persistStrikesToFile,
	fetchAllStrikesOverAreaAndTime,
	fetchAllHistoricStrikesOverAreaAndTimeInChunks,
	fetchAllFinalisedStrikesInChunks,
	fetchStrikesWhenFinalised,
	SupportedMimeType,
	SupportedVersion,
	CredentialType,
} from '../src';
import { DateTime } from 'luxon';
import { promisify } from 'util';
import { readdir, mkdir } from 'fs';

const readdirPromise = promisify(readdir);
const mkdirPromise = promisify(mkdir);

const turnIsoDateIntoUrlPath = (isoDate: string) => isoDate.replace(/:|\./g, '_');
export interface ExampleArguments {
	folderToDownloadStrikesTo: string;
	credentials: {
		type: CredentialType;
		token: string;
	};
}
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
/**
 * Fetch ten days of data in 15 minute chunks.
 * This will make 960 parallel requests and ensure each chunk has its own data.
 */
const fetchLargePeriodOfData = async ({ folderToDownloadStrikesTo, credentials }: ExampleArguments) => {
	const apiResponses = await fetchAllHistoricStrikesOverAreaAndTimeInChunks(SupportedMimeType.KML, 'PT15M', {
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
	const FILE_ISO_STRING_FORMAT = 'yyyy-MM-ddTHH_mm_ss_SSSZ';

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
			await persistStrikesToFile(strikeCollection, folderToDownloadStrikesTo, fileName);
			// Do something with the individual file
			return fileName;
		})
	);
	// Do something with all the new files
};

/**
 * Every time a 15 minute chunk is finalised, it is published here
 */
const fetchPeriodOfStrikesAsTheyAreFinalised = ({ folderToDownloadStrikesTo, credentials }: ExampleArguments) => {
	fetchStrikesWhenFinalised(
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
				folderToDownloadStrikesTo,
				`${turnIsoDateIntoUrlPath(start.toISOString())}--${turnIsoDateIntoUrlPath(end.toISOString())}.json`
			);
		}
	);
};

// Add a nice wrapper around this to call it from the CLI and have it switch examples and take args? As it stands, you just replace historicFetchUsage with the example you care about
export { fetchHistoricData, fetchLargePeriodOfData, fetchAllFinishedData, fetchPeriodOfStrikesAsTheyAreFinalised };
