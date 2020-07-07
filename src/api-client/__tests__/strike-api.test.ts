import { fetchAndFormatStrikesAndFormatRetryingOnFail, fetchAndFormatStrikes, SupportedMimeType, StrikeQueryParameters, CredentialType } from '../strike-api';
import { KML } from '../strike-collections';
import parseLinkHeader from 'parse-link-header';
import { KML_RESPONSE_ONE } from './models-test-resources';
import { Interval, DateTime } from 'luxon';
jest.mock('isomorphic-fetch');
jest.mock('parse-link-header');

describe('When fetching strikes', () => {
	let actualFetch = global.fetch;
	beforeEach(() => {
		actualFetch = global.fetch;
		global.fetch = jest.fn();
	});
	afterEach(() => {
		global.fetch = actualFetch;
	});
	describe('it should return an appropriate collection', () => {
		it('should return KML', async () => {
			(global.fetch as jest.Mock).mockImplementation(() =>
				Promise.resolve(({
					text: () => Promise.resolve(KML_RESPONSE_ONE),
					headers: {
						get: () => Promise.resolve(null),
					},
				} as any) as Response)
			);
			const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
				time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
				credentials: {
					type: CredentialType.apiKey,
					token: '',
				},
			} as StrikeQueryParameters);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND');
		});
	});
});
