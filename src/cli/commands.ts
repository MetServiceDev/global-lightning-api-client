import { fetchAllStrikesOverAreaAndTime, ClosedIntervalStrikeQueryParameters, fetchPeriodOfHistoricStrikesInChunks, supportedMimeTypeToExtension, fetchLatestHistoricStrikesInChunks, fetchStrikesWhenFinalised, OpenEndedStrikeQueryParameters } from "../friendly-api";
import { SupportedMimeType, SupportedVersion, CredentialsDetails } from "../api-client/strike-api";
import { ClientConfiguration } from "./config";
import { StrikeCollectionAndTime, persistStrikesToFile } from '../friendly-api';
import { StrikeCollectionType } from "../api-client/strike-collections";
import { DateTime, Duration } from "luxon";
import { listFilesInDirectory } from "./file-utils";

enum OutputTypes {
	STDOUT = 'STDOUT',
	FILE = 'FILE'
}
type FileOutputDetails = {
	type: OutputTypes.FILE,
	timeFormat: string;
	fileNameFormat: string;
	directory: string;
}
type OutputDetails = {
	type: OutputTypes.STDOUT
} | FileOutputDetails

enum OutputTokens {
	START_DATE_TOKEN = '{START_DATE}',
	END_DATE_TOKEN = '{END_DATE}',
	DURATION_TOKEN = '{DURATION}',
	BBOX_TOKEN = '{BBOX}'
};
enum Command {
	QUERY = 'query',
	POLL = 'fetch-latest-batches',
	STREAM = 'stream-latest-batches'
}
const commandDescriptions = {
	[Command.QUERY]: 'Make a one-off query (e.g., strikes over Australia for September)',
	[Command.POLL]: 'Fetch all the batches of strikes since this command was last run',
	[Command.STREAM]: 'Fetch all the batches of strikes since this command was last run and continue fetching each batch as it is available'
}
interface QueryConfiguration extends ClientConfiguration {
	to: string;
}
const queryForLightningData = async (credentials: CredentialsDetails, configuration: QueryConfiguration) => {
	const {
		from,
		to,
		format,
		bbox,
		limit,
		directions,
		parallelQueries,
		chunkDuration,
		providers,
		outputDetails
	} = configuration;
	const strikeCollections = await fetchPeriodOfHistoricStrikesInChunks(format, chunkDuration, {
		apiVersion: SupportedVersion.Four,
		bbox,
		credentials,
		directions,
		providers,
		limit,
		time: {
			start: from,
			end: to
		}
	}, parallelQueries);
	await Promise.all(strikeCollections.map(async (strikeCollection) => await outputStrikeCollection(strikeCollection, configuration)));
}

interface TokenReplacement {
	token: OutputTokens,
	value: string
}
const getTokenReplacementFromConfiguration = (configuration: ClientConfiguration): TokenReplacement[] => [
	{
		token: OutputTokens.DURATION_TOKEN,
		value: configuration.chunkDuration
	},
	{
		token: OutputTokens.BBOX_TOKEN,
		value: configuration.bbox.join('_')
	}
]

const outputStrikeCollection = async (strikeCollection: StrikeCollectionAndTime<StrikeCollectionType>, configuration: ClientConfiguration) => {
	const { outputDetails, format } = configuration
	if (outputDetails.type === OutputTypes.STDOUT) {
		console.log(strikeCollection.strikeCollection.toString());
	} else {
		const start = DateTime.fromISO(strikeCollection.start.toISOString(), { zone: 'utc' }).toFormat(outputDetails.timeFormat);
		const end = DateTime.fromISO(strikeCollection.end.toISOString(), { zone: 'utc' }).toFormat(outputDetails.timeFormat);
		const fileName = replaceTokensInFileName([
			...getTokenReplacementFromConfiguration(configuration),
			{
				token: OutputTokens.START_DATE_TOKEN,
				value: start
			},
			{
				token: OutputTokens.END_DATE_TOKEN,
				value: end
			},
		], outputDetails.fileNameFormat);
		await persistStrikesToFile(
			strikeCollection.strikeCollection,
			outputDetails.directory,
			`${fileName}.${supportedMimeTypeToExtension(format)}`
		);
	}
}

const replaceTokensInFileName = (tokens: TokenReplacement[

], fileName: string) => tokens.reduce((updatedFileName, tokenDetails) => updatedFileName.replace(tokenDetails.token, tokenDetails.value), fileName);

const getTimeToGetDataFrom = async (configuration: ClientConfiguration) => {
	const { outputDetails, from, chunkDuration, bbox } = configuration;
	let startTime = DateTime.fromISO(from, { zone: 'utc' });
	if (outputDetails.type === OutputTypes.FILE) {
		const files = await listFilesInDirectory(outputDetails.directory);
		if (files.length > 0) {
			const startTimeFormatted = startTime.toFormat(outputDetails.timeFormat);
			const dateLength = startTimeFormatted.length;
			
			const startIndex = replaceTokensInFileName(
				[
					...getTokenReplacementFromConfiguration(configuration),
					{
						token: OutputTokens.END_DATE_TOKEN,
						value: startTimeFormatted
					}
				], outputDetails.fileNameFormat).indexOf(OutputTokens.START_DATE_TOKEN);
			const endIndex = replaceTokensInFileName(
				[
					...getTokenReplacementFromConfiguration(configuration),
					{
						token: OutputTokens.START_DATE_TOKEN,
						value: startTimeFormatted
					}
				], outputDetails.fileNameFormat).indexOf(OutputTokens.END_DATE_TOKEN);
			if (startIndex >= 0) {
				const startDates = files.map((fileName) => DateTime.fromFormat(fileName.substr(startIndex, dateLength), outputDetails.timeFormat, { zone: 'utc' }));
				const filteredDates = startDates.filter((date) => date.isValid).sort();
				if (startDates.length > 0 && filteredDates.length === 0) {
					throw new Error(`Failed to parse dates from file names but files present in directory.`);
				}
				startTime = filteredDates.pop()?.plus(Duration.fromISO(chunkDuration)) || startTime;
			} else if (endIndex >= 0) {
				const endDates = files.map((fileName) => DateTime.fromFormat(fileName.substr(endIndex, dateLength), outputDetails.timeFormat, { zone: 'utc' })).sort();
				const filteredDates = endDates.filter((date) => date.isValid).sort();
				if (endDates.length > 0 && filteredDates.length === 0) {
					throw new Error(`Failed to parse dates from file names but files present in directory.`);
				}
				startTime = filteredDates.pop() || startTime;
			} else {
				console.error(`No date in output format, using default from time (${from})`);
			}
		}
	} else {
		console.error(`Not using file output, using default from time (${from})`);
	}
	return startTime;
}

const getLatestStrikeBatches = async (credentials: CredentialsDetails, configuration: ClientConfiguration) => {
	const startTime = await getTimeToGetDataFrom(configuration);
	const strikeCollections = await fetchLatestHistoricStrikesInChunks(configuration.format, configuration.chunkDuration, {
		apiVersion: SupportedVersion.Four,
		bbox: configuration.bbox,
		credentials,
		directions: configuration.directions,
		providers: configuration.providers,
		limit: configuration.limit,
		time: {
			start: startTime.toISO(),
		},
	});
	await Promise.all(strikeCollections.map(async (strikeCollection) => await outputStrikeCollection(strikeCollection, configuration)));
}

const streamLatestStrikeBatches = async (credentials: CredentialsDetails, configuration: ClientConfiguration) => {
	const startTime = await getTimeToGetDataFrom(configuration);
	const strikeCollections = await fetchLatestHistoricStrikesInChunks(configuration.format, configuration.chunkDuration, {
		apiVersion: SupportedVersion.Four,
		bbox: configuration.bbox,
		credentials,
		directions: configuration.directions,
		providers: configuration.providers,
		limit: configuration.limit,
		time: {
			start: startTime.toISO(),
		},
	});
	await Promise.all(strikeCollections.map(async (strikeCollection) => await outputStrikeCollection(strikeCollection, configuration)));
	fetchStrikesWhenFinalised(
		configuration.format,
		configuration.chunkDuration,
		{
			apiVersion: SupportedVersion.Four,
			bbox: configuration.bbox,
			credentials,
			limit: configuration.limit,
			directions: configuration.directions,
			providers: configuration.providers,
			time: {
				start: startTime.toISO(),
			},
		},
		async (strikeCollection) => {
			await outputStrikeCollection(strikeCollection, configuration)
		}
	);
}

export {
	Command,
	OutputTokens,
	OutputDetails,
	OutputTypes,
	queryForLightningData,
	getLatestStrikeBatches,
	streamLatestStrikeBatches,
	commandDescriptions
}