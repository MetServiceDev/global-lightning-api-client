import { fetchAllStrikesOverAreaAndTime, fetchAllHistoricStrikesOverAreaAndTimeInChunks } from '../index';
import { SupportedMimeType, SupportedVersion, CredentialType, fetchAndFormatStrikesAndFormatRetryingOnFail, ApiResponse } from '../api-client/strike-api';
import { StrikeCollection, StrikeCollectionType, CSVStrikeCollection } from '../api-client/strike-collections';

jest.mock('../api-client/strike-api');

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
			apiVersion: SupportedVersion.Four,
			bbox: [-180, -90, 180, 90],
			credentials: {
				type: CredentialType.apiKey,
				token: '',
			},
			limit: 10000,
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
			apiVersion: SupportedVersion.Four,
			bbox: [-180, -90, 180, 90],
			credentials: {
				type: CredentialType.apiKey,
				token: '',
			},
			limit: 10000,
			time: {
				start: '2020-02-01T00:00:00.000Z',
				end: '2020-02-01T00:15:00.000Z',
			},
		});
		expect(fetchAndFormatStrikesAndFormatRetryingOnFail).toHaveBeenCalledTimes(1);
	});
});
