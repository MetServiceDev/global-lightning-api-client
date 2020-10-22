import { fetchAllStrikesOverAreaAndTime, fetchPeriodOfHistoricStrikesInChunks } from '../index';
import { SupportedMimeType, SupportedVersion, CredentialType, fetchAndFormatStrikesAndFormatRetryingOnFail, ApiResponse } from '../api-client/strike-api';
import { StrikeCollection, StrikeCollectionType, CSVStrikeCollection } from '../api-client/strike-collections';
import { fetchLatestHistoricStrikesInChunks, OpenEndedStrikeQueryParameters, fetchStrikesWhenFinalised } from '../friendly-api';
import { Interval, Duration, DateTime } from 'luxon';

jest.mock('../api-client/strike-api');
jest.useFakeTimers();

const basicQuery: OpenEndedStrikeQueryParameters = {
	apiVersion: SupportedVersion.Four,
	bbox: [-180, -90, 180, 90],
	credentials: {
		type: CredentialType.apiKey,
		token: '',
	},
	limit: 10000,
	time: {
		start: '2020-02-01T00:00:00.000Z',
	},
};

describe('When fetching all strikes', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});
	it('should call the fetch function until there are no more strikes to get', async () => {
		let callCount = 0;
		(fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mockImplementation(
			(): Promise<ApiResponse<StrikeCollectionType>> => {
				callCount++;
				return Promise.resolve({
					strikeCollection: new CSVStrikeCollection({
						text: () => Promise.resolve(``),
					} as Response),
					strikesRemaining: callCount <= 3,
				});
			}
		);
		const strikes = await fetchAllStrikesOverAreaAndTime(SupportedMimeType.KML, {
			...basicQuery,
			time: {
				start: '2020-02-01T00:00:00.000Z',
				end: '2020-02-01T00:15:00.000Z',
			},
		});
		expect(fetchAndFormatStrikesAndFormatRetryingOnFail).toHaveBeenCalledTimes(4);
	});
	it('should call the fetch function once if there are only limited strikes to get', async () => {
		(fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mockImplementation(
			(): Promise<ApiResponse<StrikeCollectionType>> => {
				return Promise.resolve({
					strikeCollection: new CSVStrikeCollection({
						text: () => Promise.resolve(``),
					} as Response),
					strikesRemaining: false,
				});
			}
		);
		const strikes = await fetchAllStrikesOverAreaAndTime(SupportedMimeType.KML, {
			...basicQuery,
			time: {
				start: '2020-02-01T00:00:00.000Z',
				end: '2020-02-01T00:15:00.000Z',
			},
		});
		expect(fetchAndFormatStrikesAndFormatRetryingOnFail).toHaveBeenCalledTimes(1);
	});
});

describe('When fetching all chunks in a query', () => {
	it('should throw an error if try to fetch unfinalised strikes', async () => {
		expect(
			fetchPeriodOfHistoricStrikesInChunks(
					SupportedMimeType.CSV,
					'PT15M',
					{
						...basicQuery,
						time: {
							start: '2020-02-01T00:00:00.000Z',
							end: new Date(Date.now()),
						},
					},
					10
				)
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`"This should not be used for periods newer than PT5M ago. It does not deal with the complexities of out of order strikes."`
		);
	});
	it('should throw an error if more than 20 queries at once are requested', () => {
		expect(
			fetchPeriodOfHistoricStrikesInChunks(
					SupportedMimeType.CSV,
					'PT15M',
					{
						...basicQuery,
						time: {
							start: '2020-02-01T00:00:00.000Z',
							end: '2020-02-01T00:30:00.000Z',
						},
					},
				22
				)
		).rejects.toThrowErrorMatchingInlineSnapshot(`"You cannot make more than 20 queries at once"`);
	});
	it('should only make at most 10 queries at once', async () => {
		(fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mockImplementation(
			(): Promise<ApiResponse<StrikeCollectionType>> => {
				return Promise.resolve({
					strikeCollection: new CSVStrikeCollection({
						text: () => Promise.resolve(``),
					} as Response),
					strikesRemaining: false,
				});
			}
		);
		await fetchPeriodOfHistoricStrikesInChunks(
			SupportedMimeType.CSV,
			'PT15M',
			{
				...basicQuery,
				time: {
					start: '2020-02-01T00:00:00.000Z',
					end: '2020-02-01T00:15:00.000Z',
				},
			},
			10
		);
	});
});

describe('When fetching all finalised chunks', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});
	it('should only fetch finalised chunks', async () => {
		// Finalised is currently five minutes, will need to adjust timestamp below if this is adjusted
		jest.spyOn(global.Date, 'now').mockImplementationOnce(() => new Date('2020-02-01T00:49:24.042Z').valueOf());
		(fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mockImplementation(
			(): Promise<ApiResponse<StrikeCollectionType>> => {
				return Promise.resolve({
					strikeCollection: new CSVStrikeCollection({
						text: () => Promise.resolve(``),
					} as Response),
					strikesRemaining: false,
				});
			}
		);
		const response = await fetchLatestHistoricStrikesInChunks(SupportedMimeType.GeoJsonV3, 'PT15M', {
			...basicQuery,
			time: {
				start: '2020-02-01T00:00:00.000Z',
			},
		});
		expect(response.length).toEqual(2);
		expect(response[0].end.toISOString()).toEqual('2020-02-01T00:15:00.000Z');
		expect(response[1].end.toISOString()).toEqual('2020-02-01T00:30:00.000Z');
		expect(fetchAndFormatStrikesAndFormatRetryingOnFail).toHaveBeenCalledTimes(2);
		expect(((fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mock.calls[0][1].time as Interval).end.setZone('utc').toISO()).toEqual(
			'2020-02-01T00:15:00.000Z'
		);
		expect(((fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mock.calls[1][1].time as Interval).end.setZone('utc').toISO()).toEqual(
			'2020-02-01T00:30:00.000Z'
		);
	});
});

describe('When fetching chunks when finalised', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});
	it('should fetch chunks when finalised and run the callback', async () => {
		// Finalised is currently ten minutes, will need to adjust timestamp and durations below if this is adjusted
		jest.spyOn(global.Date, 'now').mockImplementationOnce(() => new Date('2020-02-01T00:49:24.042Z').valueOf());
		jest.useFakeTimers();
		(fetchAndFormatStrikesAndFormatRetryingOnFail as jest.Mock).mockImplementation(
			(): Promise<ApiResponse<StrikeCollectionType>> => {
				return Promise.resolve({
					strikeCollection: new CSVStrikeCollection({
						text: () => Promise.resolve(``),
					} as Response),
					strikesRemaining: false,
				});
			}
		);
		// Need to wait for the callback to finish. Hacking so that we can await the callback.
		let resolveCallback = (collection: any) => {};
		let promiseOfNextCallback = () =>
			new Promise((temporaryResolve) => {
				resolveCallback = temporaryResolve;
			});
		let collections: { start: Date; end: Date }[] = [];

		fetchStrikesWhenFinalised(
			SupportedMimeType.GeoJsonV3,
			'PT15M',
			{
				...basicQuery,
				time: {
					start: '2020-02-01T00:00:00.000Z',
				},
			},
			(collection) => {
				resolveCallback(collection);
				collections.push(collection);
			}
		);
		expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 35958);
		expect(setTimeout).toHaveBeenCalledTimes(1);
		// Checking first response does what it should do
		let callbackResponse = promiseOfNextCallback();
		jest.runOnlyPendingTimers();
		await callbackResponse;
		expect(fetchAndFormatStrikesAndFormatRetryingOnFail).toHaveBeenCalledTimes(1);
		expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), Duration.fromISO('PT20M').as('milliseconds'));
		expect(setTimeout).toHaveBeenCalledTimes(2);
		callbackResponse = promiseOfNextCallback();

		// Checking second response does what it should do
		jest.runOnlyPendingTimers();
		await callbackResponse;
		expect(fetchAndFormatStrikesAndFormatRetryingOnFail).toHaveBeenCalledTimes(2);
		expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), Duration.fromISO('PT20M').as('milliseconds'));
		expect(setTimeout).toHaveBeenCalledTimes(3);
		expect(collections[0].start.toISOString()).toEqual('2020-02-01T00:30:00.000Z');
		expect(collections[0].end.toISOString()).toEqual('2020-02-01T00:45:00.000Z');
		expect(collections[1].start.toISOString()).toEqual('2020-02-01T00:45:00.000Z');
		expect(collections[1].end.toISOString()).toEqual('2020-02-01T01:00:00.000Z');
	});
});
