import {
	StrikeCollection,
	StrikeCollectionType,
	KML,
	LightningFeatureCollectionV3,
	BlitzenCollectionV1,
	BlitzenCollectionV3,
	BlitzenCollectionV2,
	CSV,
	LightningFeatureCollectionV2,
} from './api-client/strike-collections';
import {
	SupportedMimeType,
	CredentialType,
	SupportedVersion,
	Bbox,
	LightningStrikeDirection,
	LightningDataNetworkProvider,
	fetchAndFormatStrikesAndFormatRetryingOnFail,
} from './api-client/strike-api';
import { Duration, DateTime, Interval } from 'luxon';
import { mkdir, writeFile } from 'fs';
import { promisify } from 'util';

const mkdirPromise = promisify(mkdir);
const writeFilePromise = promisify(writeFile);
/**
 * A collection of helper utility methods for making interacting with the API even easier.
 *
 * TODO: Better name for this.
 */

const FINALISED_HISTORY_TIME = 'PT10M';
const MAXIMUM_QUERIES_AT_ONCE = 20;

type DateTimeValue = Date | DateTime | string;
interface TimeInterval {
	start: DateTimeValue;
	end: DateTimeValue;
}
type TimeDuration = Duration | string | number;

export interface OpenEndedStrikeQueryParameters {
	credentials: {
		type: CredentialType;
		token: string;
	};
	apiVersion: SupportedVersion;
	time: {
		start: DateTimeValue;
	};
	bbox: Bbox;
	providers?: LightningDataNetworkProvider[];
	directions?: LightningStrikeDirection[];
	limit: number;
}
export interface ClosedIntervalStrikeQueryParameters extends OpenEndedStrikeQueryParameters {
	time: TimeInterval;
}
interface StrikeCollectionAndTime<T extends StrikeCollectionType> {
	strikeCollection: StrikeCollection<T>;
	start: Date;
	end: Date;
}
/**
 * Transforms the user friendly time option into a luxon Interval.
 * NOTE: Interval adheres to the TimeInterval interface, so this can be called with its own output.
 *
 * - Assumes a string is an ISO date
 */
const transformQueryTimeIntoInterval = (time: TimeInterval): Interval => {
	let { start, end } = time;
	if (typeof start === 'string') {
		start = transformDateTimeValueIntoDateTime(start);
	}
	if (typeof end === 'string') {
		end = transformDateTimeValueIntoDateTime(end);
	}
	return Interval.fromDateTimes(start, end);
};

const transformDateTimeValueIntoDateTime = (time: DateTimeValue): DateTime => {
	if (typeof time === 'string') {
		time = DateTime.fromISO(time, { zone: 'utc' });
	}
	if (time instanceof Date) {
		time = DateTime.fromJSDate(time);
	}
	return time;
};
/**
 * Transformes a user friendly time duration into a luxon Duration.
 * - Assumes a string is an ISO Duration.
 * - Assumes a number is the amount of milliseconds
 */
const transformDurationTimeIntoDuration = (duration: TimeDuration): Duration => {
	if (typeof duration === 'string') {
		return Duration.fromISO(duration);
	}
	if (typeof duration === 'number') {
		return Duration.fromMillis(duration);
	}
	return duration;
};
/**
 * Fetches strikes from the lightning API over the given time and area in a resilient fashion until all strikes that the API knows about have been received.
 *
 * WARNING: This does not deal well with out of order/delayed strikes. If a strike is not in the API as of request time (due to network propogation or other delays), then
 * this will not return it. The merging of strike collections assumes that each collection has an entirely unique set of strikes which may not be the case in recent queries.
 * Therefore, if you're using this for data within the last ten minutes where this is not necessarily the case, you will need to keep requesting that data until it is finalised
 * and removing duplicate strikes.
 *
 * This should only be used for small queries and larger queries should be split up into multiple requests to increase the parallelism.
 *
 * Algorithm:
 * - Fetch strikes for given values
 * 		- while there are still strikes to get (link header with next present), fetch again with an increased offset
 * 		- Naively aggregate strikes (relies on the API to return strikes in order and uniquely, so it adds each subsequent collection after each other without sorting or deduplication.
 * 			This means if a strike is in multiple collections, it will be returned multiple times and strikes may appear out of order).
 * - return aggregated strikes
 *
 * NOTE: If the provider is not global, there may not be data in the given area
 */
async function fetchAllStrikesOverAreaAndTime(format: SupportedMimeType.KML, query: ClosedIntervalStrikeQueryParameters): Promise<StrikeCollection<KML>>;
async function fetchAllStrikesOverAreaAndTime(format: SupportedMimeType.CSV, query: ClosedIntervalStrikeQueryParameters): Promise<StrikeCollection<CSV>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.GeoJson,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<LightningFeatureCollectionV3>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.GeoJsonV3,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<LightningFeatureCollectionV3>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.GeoJsonV2,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<LightningFeatureCollectionV2>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.Blitzen,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<BlitzenCollectionV3>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.BlitzenV3,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<BlitzenCollectionV3>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.BlitzenV2,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<BlitzenCollectionV2>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType.BlitzenV1,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<BlitzenCollectionV1>>;
async function fetchAllStrikesOverAreaAndTime<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<T>>;
async function fetchAllStrikesOverAreaAndTime(
	format: SupportedMimeType,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<StrikeCollectionType>> {
	const time = transformQueryTimeIntoInterval(query.time);
	let offset = 0;
	let { strikeCollection, strikesRemaining } = await fetchAndFormatStrikesAndFormatRetryingOnFail(format, {
		...query,
		time,
		offset,
	});
	while (strikesRemaining) {
		offset += query.limit;
		let { strikeCollection: strikeCollectionForOffset, strikesRemaining: strikesRemainingForOffset } = await fetchAndFormatStrikesAndFormatRetryingOnFail(
			format,
			{
				...query,
				time,
				offset,
			}
		);
		strikesRemaining = strikesRemainingForOffset;
		strikeCollection.mergeCollection(strikeCollectionForOffset);
	}
	return strikeCollection;
}

/**
 * Takes a time period, breaks it into smaller durations up by the given chunk period and then fetches all the periods.
 * Guarentees strikes in each duration will be in order, and it will not fetch strikes that are not finalised.
 * If the time period is not nicely divided into smaller durations, the last duration will be of an unequal size.
 *
 * Useful for getting data over a specific historic period, or periodically fetching a closed period.
 *
 * NOTE: This fetches all of the data and then returns it, which means all the data needs to be held in memory.
 * If you don't have a lot of memory, you will need to do smaller queries.
 *
 * If this is an issue for you, let us know and we will look at doing a callback version.
 *
 */
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.KML,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<KML>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.GeoJson,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<LightningFeatureCollectionV3>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.GeoJsonV3,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<LightningFeatureCollectionV3>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.GeoJsonV2,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<LightningFeatureCollectionV2>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.Blitzen,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<BlitzenCollectionV3>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.BlitzenV3,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<BlitzenCollectionV3>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.BlitzenV2,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<BlitzenCollectionV2>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType.BlitzenV1,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<BlitzenCollectionV1>[]>;
async function fetchPeriodOfHistoricStrikesInChunks<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries?: number
): Promise<StrikeCollectionAndTime<T>[]>;
async function fetchPeriodOfHistoricStrikesInChunks(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters,
	maximumQueries: number = 10
): Promise<StrikeCollectionAndTime<StrikeCollectionType>[]> {
	const queryTime = transformQueryTimeIntoInterval(query.time);
	if (queryTime.end >= DateTime.utc().minus(Duration.fromISO(FINALISED_HISTORY_TIME))) {
		throw new Error(
			`This should not be used for periods newer than ${FINALISED_HISTORY_TIME} ago. It does not deal with the complexities of out of order strikes.`
		);
	}
	if (maximumQueries > MAXIMUM_QUERIES_AT_ONCE) {
		throw new Error(`You cannot make more than ${MAXIMUM_QUERIES_AT_ONCE} queries at once`);
	}
	const periodChunks = queryTime.splitBy(transformDurationTimeIntoDuration(chunkDuration));
	let processedQueries: StrikeCollectionAndTime<StrikeCollectionType>[] = [];
	for (let index = 0; index < periodChunks.length; index += maximumQueries) {
		const periodChunksToProcess = periodChunks.slice(index, index + maximumQueries);
		console.log(`Getting data from ${periodChunksToProcess[0].start.toISO()} to ${periodChunksToProcess.slice(-1)[0].end.toISO()}`);
		const chunkedStrikeCollections = await Promise.all(
			periodChunksToProcess.map(async (period) => {
				return {
					strikeCollection: await fetchAllStrikesOverAreaAndTime(format, {
						...query,
						time: period,
					}),
					start: period.start.toJSDate(),
					end: period.end.toJSDate(),
				};
			})
		);
		processedQueries = processedQueries.concat(chunkedStrikeCollections);
	}
	return processedQueries;
}
/**
 * Works out the latest chunk that has been finalised and fetches all chunks from the start time to that chunk.
 * Guarentees strikes in each duration will be in order, and it will not fetch strikes that are not finalised.
 *
 * Useful for batch jobs where you periodically fetch all data.
 */
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.KML,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<KML>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.CSV,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<CSV>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.GeoJson,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<LightningFeatureCollectionV3>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.GeoJsonV3,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<LightningFeatureCollectionV3>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.GeoJsonV2,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<LightningFeatureCollectionV2>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.Blitzen,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<BlitzenCollectionV3>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.BlitzenV3,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<BlitzenCollectionV3>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.BlitzenV2,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<BlitzenCollectionV2>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType.BlitzenV1,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<BlitzenCollectionV1>[]>;
async function fetchLatestHistoricStrikesInChunks<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<T>[]>;
async function fetchLatestHistoricStrikesInChunks(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters
): Promise<StrikeCollectionAndTime<StrikeCollectionType>[]> {
	const now = DateTime.utc();
	const chunk = transformDurationTimeIntoDuration(chunkDuration);
	const latestTimeAChunkCanBeFinalised = now.minus(Duration.fromISO(FINALISED_HISTORY_TIME));
	let lastValidChunkEndTime = transformDateTimeValueIntoDateTime(query.time.start);
	while (lastValidChunkEndTime < latestTimeAChunkCanBeFinalised) {
		lastValidChunkEndTime = lastValidChunkEndTime.plus(chunk);
	}
	return await fetchPeriodOfHistoricStrikesInChunks(format, chunk, {
		...query,
		time: {
			start: query.time.start,
			end: lastValidChunkEndTime.minus(chunk),
		},
	});
}
/**
 * Saves the strikes to a file, creating any required directories to persist the file.
 *
 * WARNING: This will overwrite any existing files, and this is naive and does not buffer/stream the collection.
 */
const persistStrikesToFile = async (collectionToPersist: StrikeCollection<StrikeCollectionType>, directoryToSaveIn: string, fileName: string) => {
	try {
		await mkdirPromise(directoryToSaveIn, { recursive: true });
		const collectionAsString = await collectionToPersist.toString();
		await writeFilePromise(`${directoryToSaveIn}/${fileName}`, collectionAsString);
	} catch (error) {
		console.error(`Failed to write collection to disk`, error);
		throw error;
	}
};

/**
 * NOT IMPLEMENTED:
 * Replaces polling. Good idea? Look at how hard this is first.
 * Creates a WebSocket to listen to all new strikes
 */
function listenForNewStrikesInArea<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<T>> {
	throw new Error('Not yet implemented');
}
/**
 * Polls for new strikes and returns an event stream of new ones
 * Maintains its own list of strikes it has observed
 * - Every minute:
 * 		- Request strikes for ten minutes
 * 		- Returns all new strikes
 */
function pollForNewStrikesInArea<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<T>> {
	throw new Error('Not yet implemented');
}
/**
 * When the specified periodOfStrikes is finalised, fetches the data and calls the callback.
 *
 * Best used for long-running jobs.
 */
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.KML,
	periodOfStrikes: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<KML>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.GeoJson,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<LightningFeatureCollectionV3>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.GeoJsonV3,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<LightningFeatureCollectionV3>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.GeoJsonV2,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<LightningFeatureCollectionV3>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.Blitzen,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<BlitzenCollectionV3>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.BlitzenV3,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<BlitzenCollectionV3>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.BlitzenV2,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<BlitzenCollectionV2>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.BlitzenV1,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<BlitzenCollectionV1>) => void
): void;
function fetchStrikesWhenFinalised(
	format: SupportedMimeType.CSV,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<CSV>) => void
): void;
function fetchStrikesWhenFinalised<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<T>) => void
): void;
function fetchStrikesWhenFinalised<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	periodOfStrikes: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<T>) => void
): void {
	const finalisedHistoryTimeDuration = Duration.fromISO(FINALISED_HISTORY_TIME);
	const now = DateTime.utc();
	const chunkDuration = transformDurationTimeIntoDuration(periodOfStrikes);
	const latestTimeAChunkCanBeFinalised = now.minus(finalisedHistoryTimeDuration);
	let nextChunkEndTime = transformDateTimeValueIntoDateTime(query.time.start);
	while (nextChunkEndTime < latestTimeAChunkCanBeFinalised) {
		nextChunkEndTime = nextChunkEndTime.plus(chunkDuration);
	}
	const timeToDoNextFetch = nextChunkEndTime.plus(finalisedHistoryTimeDuration);
	const timeUntilNextFetch = timeToDoNextFetch.diff(now);

	let start = nextChunkEndTime.minus(chunkDuration);
	let end = nextChunkEndTime;
	const timeAfterAChunkFetchUntilNextChunkValid = chunkDuration.plus(finalisedHistoryTimeDuration);
	const fetchStrikesForChunk = async (start: DateTime, end: DateTime) => {
		const strikeCollection = await fetchAllStrikesOverAreaAndTime<T>(format, {
			...query,
			time: {
				start,
				end,
			},
		});
		const nextStart = end;
		const nextEnd = end.plus(chunkDuration);
		setTimeout(async () => await fetchStrikesForChunk(nextStart, nextEnd), timeAfterAChunkFetchUntilNextChunkValid.as('milliseconds'));
		callback({
			strikeCollection,
			start: start.toJSDate(),
			end: end.toJSDate(),
		});
	};
	setTimeout(async () => await fetchStrikesForChunk(start, end), timeUntilNextFetch.as('milliseconds'));
}

export {
	fetchAllStrikesOverAreaAndTime,
	fetchPeriodOfHistoricStrikesInChunks,
	fetchLatestHistoricStrikesInChunks,
	fetchStrikesWhenFinalised,
	persistStrikesToFile,
};
