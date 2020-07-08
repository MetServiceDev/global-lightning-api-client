import { StrikeCollection, StrikeCollectionType, KML, LightningFeatureCollectionV3 } from 'api-client/strike-collections';
import {
	SupportedMimeType,
	CredentialType,
	SupportedVersion,
	Bbox,
	LightningStrikeDirection,
	LightningDataNetworkProvider,
	fetchAndFormatStrikesAndFormatRetryingOnFail,
} from './api-client/strike-api';
import { Duration, DateTime, Interval, DateObject } from 'luxon';
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
		start = DateTime.fromISO(start);
	}
	if (typeof end === 'string') {
		end = DateTime.fromISO(end);
	}
	return Interval.fromDateTimes(start, end);
};

const transformDateTimeValueIntoDateTime = (time: DateTimeValue): DateTime => {
	if (typeof time === 'string') {
		time = DateTime.fromISO(time);
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
 * WARNING: This does not deal with out of order strikes. If a strike is not in the API as of request time (due to network propogation or other delays), then
 * this will not return it. Therefore, if you're using this for data within the last ten minutes, you will need to keep requesting that data until it is finalised.
 *
 * This should only be used for small queries and larger queries should be split up into multiple requests using this.
 *
 * Algorithm:
 * - Fetch strikes for given values
 * 		- while there are still strikes to get (link header with next present), fetch again with an incrased offset
 * 		- Aggregate strikes
 * - return
 * NOTE: If the provider is not global, there may not be data in the given area
 */
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
 * Takes a time period, breaks it into chunks and then fetches all the periods. Guarentees strikes will be in order.
 *
 * Useful for periodically fetching data, or getting data over a specific historic period.
 *
 *
 */
async function fetchAllHistoricStrikesOverAreaAndTimeInChunks(
	format: SupportedMimeType.KML,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollectionAndTime<KML>[]>;
async function fetchAllHistoricStrikesOverAreaAndTimeInChunks(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollectionAndTime<StrikeCollectionType>[]>;
async function fetchAllHistoricStrikesOverAreaAndTimeInChunks(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollectionAndTime<StrikeCollectionType>[]> {
	const queryTime = transformQueryTimeIntoInterval(query.time);
	if (queryTime.end >= DateTime.utc().minus(Duration.fromISO(FINALISED_HISTORY_TIME))) {
		throw new Error(
			`This should not be used for periods newer than ${FINALISED_HISTORY_TIME} ago. It does not deal with the complexities of out of order strikes.`
		);
	}
	const periodChunks = queryTime.splitBy(transformDurationTimeIntoDuration(chunkDuration));
	const chunkedStrikeCollections = await Promise.all(
		periodChunks.map(async (period) => {
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
	return chunkedStrikeCollections;
}

async function fetchAllFinalisedStrikesInChunks(
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
	return await fetchAllHistoricStrikesOverAreaAndTimeInChunks(format, chunk, {
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
		const path = await mkdirPromise(directoryToSaveIn, { recursive: true });
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
 * When the specified periodOfStrikes is finalised, fetches the data and returns it.
 *
 */
// function fetchStrikesWhenFinalised(
// 	format: SupportedMimeType.KML,
// 	periodOfStrikes: TimeDuration,
// 	query: OpenEndedStrikeQueryParameters,
// 	callback: (strikeCollection: StrikeCollectionAndTime<KML>) => void
// ): void;
// function fetchStrikesWhenFinalised(
// 	format: SupportedMimeType.GeoJsonV3,
// 	chunkDuration: TimeDuration,
// 	query: OpenEndedStrikeQueryParameters,
// 	callback: (strikeCollection: StrikeCollectionAndTime<LightningFeatureCollectionV3>) => void
// ): void;
// function fetchStrikesWhenFinalised(
// 	format: SupportedMimeType,
// 	chunkDuration: TimeDuration,
// 	query: OpenEndedStrikeQueryParameters,
// 	callback: (strikeCollection: StrikeCollectionAndTime<StrikeCollectionType>) => void
// ): void;
function fetchStrikesWhenFinalised<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	periodOfStrikes: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<StrikeCollectionType>) => void
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
		const strikeCollection = await fetchAllStrikesOverAreaAndTime(format, {
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

/**
 * Fetches historic strikes in chunks, and returns all new ones.
 * - Breaks the time period into the requested chunks
 * - Fetches all strikes in each chunked time period
 * - Returns all new strikes
 */
function getHistoricStrikesAndPollForNewOnes<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<T>> {
	throw new Error('Not yet implemented');
}

function getHistoricStrikesAndListenForNewOnes<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	query: ClosedIntervalStrikeQueryParameters
): Promise<StrikeCollection<T>> {
	throw new Error('Not yet implemented');
}
/**
 * Fetches historic strikes in chunks, and each time a chunk is finalized, returns it. Guarentees strikes will be in order.
 * - Breaks the time period into the requested chunks
 * - Fetches all strikes in each chunked time period
 * - When a new chunk is older than ten minutes, fetches it and returns it
 */
async function getStrikesAndReturnBatches(
	format: SupportedMimeType,
	chunkDuration: TimeDuration,
	query: OpenEndedStrikeQueryParameters,
	callback: (strikeCollection: StrikeCollectionAndTime<StrikeCollectionType>) => void
): Promise<StrikeCollectionAndTime<StrikeCollectionType>[]> {
	const now = DateTime.utc();
	// 1 hour ago
	// :10
	// 15 minute chunks
	// 1 - :45
	// :45 - :30
	// :30 - :15
	// :05 => :10, fetch
	throw new Error('Not yet implemented');
	const latestTimeAChunkCanBeFinalised = now.minus(Duration.fromISO(FINALISED_HISTORY_TIME));
	const lastChunkTime = now.minus(transformDurationTimeIntoDuration(chunkDuration));
	return await fetchAllHistoricStrikesOverAreaAndTimeInChunks(format, chunkDuration, {
		...query,
		time: {
			start: query.time.start,
			end: latestTimeAChunkCanBeFinalised,
		},
	});
	// const transformedDurationTimeIntoDuration(chunkDuration);
	// const chunks = now - fromTime / chunk
	// fetchAllHistoricStrikesOverAreaAndTime();
	//
}

export {
	fetchAllStrikesOverAreaAndTime,
	fetchAllHistoricStrikesOverAreaAndTimeInChunks,
	fetchAllFinalisedStrikesInChunks,
	fetchStrikesWhenFinalised,
	persistStrikesToFile,
};
