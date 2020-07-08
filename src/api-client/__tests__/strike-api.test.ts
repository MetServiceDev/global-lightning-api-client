import { fetchAndFormatStrikesAndFormatRetryingOnFail, fetchAndFormatStrikes, SupportedMimeType, StrikeQueryParameters, CredentialType } from '../strike-api';
import { KML } from '../strike-collections';
import parseLinkHeader from 'parse-link-header';
import { KML_RESPONSE_ONE } from './strikes-collections-test-resources';
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
	describe('it should parse the link header', () => {
		it('should return false if there is no link header', async () => {
			(global.fetch as jest.Mock).mockImplementation(() =>
				Promise.resolve(({
					text: () => Promise.resolve(KML_RESPONSE_ONE),
					headers: {
						get: () => null,
					},
				} as any) as Response)
			);
			(parseLinkHeader as jest.Mock).mockReturnValue({
				next: {
					rel: 'next',
					url: '',
				},
			});
			const { strikesRemaining } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
				time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
				credentials: {
					type: CredentialType.apiKey,
					token: '',
				},
			} as StrikeQueryParameters);
			expect(strikesRemaining).toBeFalsy();
		});
		it('should return false if there is a not a next in the link header', async () => {
			(global.fetch as jest.Mock).mockImplementation(() =>
				Promise.resolve(({
					text: () => Promise.resolve(KML_RESPONSE_ONE),
					headers: {
						get: () => '',
					},
				} as any) as Response)
			);
			(parseLinkHeader as jest.Mock).mockReturnValue({
				prev: {
					rel: 'prev',
					url: '',
				},
			});
			const { strikesRemaining } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
				time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
				credentials: {
					type: CredentialType.apiKey,
					token: '',
				},
			} as StrikeQueryParameters);
			expect(strikesRemaining).toBeFalsy();
		});
		it('should return true if there is a next in the link header', async () => {
			(global.fetch as jest.Mock).mockImplementation(() =>
				Promise.resolve(({
					text: () => Promise.resolve(KML_RESPONSE_ONE),
					headers: {
						get: () => '',
					},
				} as any) as Response)
			);
			(parseLinkHeader as jest.Mock).mockReturnValue({
				next: {
					rel: 'next',
					url: '',
				},
			});
			const { strikesRemaining } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
				time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
				credentials: {
					type: CredentialType.apiKey,
					token: '',
				},
			} as StrikeQueryParameters);
			expect(strikesRemaining).toBeTruthy();
		});
	});
	describe('it should return an appropriate collection', () => {
		it('should return KML', async () => {
			(global.fetch as jest.Mock).mockImplementation(() =>
				Promise.resolve(({
					text: () => Promise.resolve(KML_RESPONSE_ONE),
					headers: {
						get: () => '',
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
			expect(formattedStrikes.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-06-20T00:00:00.323Z, Current:-13.6kA, Type:GROUND');
		});
	});
});
