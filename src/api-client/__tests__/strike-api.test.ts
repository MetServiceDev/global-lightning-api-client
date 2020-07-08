import {
	fetchAndFormatStrikesAndFormatRetryingOnFail,
	fetchAndFormatStrikes,
	SupportedMimeType,
	StrikeQueryParameters,
	CredentialType,
	LightningDataNetworkProvider,
	LightningStrikeDirection,
} from '../strike-api';
import { KML } from '../strike-collections';
import parseLinkHeader from 'parse-link-header';
import {
	KML_RESPONSE_ONE,
	GeoJSONV3_RESPONSE_ONE,
	BlitzenV2_RESPONSE_ONE,
	CSV_RESPONSE_ONE,
	GeoJSONV2_RESPONSE_ONE,
	BlitzenV3_RESPONSE_ONE,
	BlitzenV1_RESPONSE_ONE,
} from './strikes-collections-test-resources';
import { Interval, DateTime } from 'luxon';
jest.mock('isomorphic-fetch');
jest.mock('parse-link-header');

const mockFetchToReturnWithNoHeaders = (text: string = KML_RESPONSE_ONE, json: boolean = false) =>
	(global.fetch as jest.Mock).mockImplementationOnce(() =>
		Promise.resolve(({
			text: () => Promise.resolve(text),
			json: () => Promise.resolve(json ? JSON.parse(text) : {}),
			headers: {
				get: () => null,
			},
		} as any) as Response)
	);

describe('When fetching strikes', () => {
	let actualFetch = global.fetch;
	beforeEach(() => {
		actualFetch = global.fetch;
		global.fetch = jest.fn();
	});
	afterEach(() => {
		global.fetch = actualFetch;
	});
	describe('it should retry if the query fails', () => {
		it('should retry 3 times and then fail', async () => {
			let count = 0;
			(global.fetch as jest.Mock).mockImplementation(() => {
				count++;
				return (Promise.reject('Failed to fetch') as any) as Response;
			});
			try {
				await fetchAndFormatStrikesAndFormatRetryingOnFail(SupportedMimeType.KML, {
					time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
					credentials: {
						type: CredentialType.apiKey,
						token: '',
					},
				} as StrikeQueryParameters);
				expect(true).toBeFalsy();
			} catch (error) {
				expect(count).toEqual(3);
				expect(error).toMatch('Failed to fetch');
			}
		});
		it('should succeed on the first attempt', async () => {
			mockFetchToReturnWithNoHeaders();
			const { strikesRemaining, strikeCollection } = await fetchAndFormatStrikesAndFormatRetryingOnFail(SupportedMimeType.KML, {
				time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
				credentials: {
					type: CredentialType.apiKey,
					token: '',
				},
			} as StrikeQueryParameters);
			expect(strikesRemaining).toBeFalsy();
			const collection = await strikeCollection.collection;
			expect(collection.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-06-20T00:00:00.323Z, Current:-13.6kA, Type:GROUND');
		});
		it('should succeed on the final attempt', async () => {
			let count = 0;
			(global.fetch as jest.Mock).mockImplementation(() => {
				count++;
				if (count === 3) {
					return Promise.resolve(({
						json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_ONE)),
						headers: {
							get: () => null,
						},
					} as any) as Response);
				}
				return (Promise.reject('Failed to fetch') as any) as Response;
			});

			const { strikesRemaining, strikeCollection } = await fetchAndFormatStrikesAndFormatRetryingOnFail(SupportedMimeType.GeoJsonV2, {
				time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
				credentials: {
					type: CredentialType.apiKey,
					token: '',
				},
			} as StrikeQueryParameters);
			expect(count).toEqual(3);
			expect(strikesRemaining).toBeFalsy();
			const collection = await strikeCollection.collection;
			expect(collection.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
		});
	});
	describe('it should parse the link header', () => {
		it('should return false if there is no link header', async () => {
			mockFetchToReturnWithNoHeaders();
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
	describe('it should call fetch correctly', () => {
		describe('it should format the URL', () => {
			it('should format the query arguments correctly', async () => {
				mockFetchToReturnWithNoHeaders();
				const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
					time: Interval.fromDateTimes(DateTime.fromISO('2020-06-20T00:00:00.000Z'), DateTime.fromISO('2020-06-20T00:15:00.000Z')),
					apiVersion: 'v4',
					bbox: [0, 0, -50, -45],
					limit: 10,
					offset: 10,
					credentials: {
						type: CredentialType.apiKey,
						token: '',
					},
				} as StrikeQueryParameters);
				expect((global.fetch as jest.Mock).mock.calls[0][0]).toEqual(
					`https://lightning.api.metraweather.com/v4/strikes?time=2020-06-20T00:00:00.000Z--2020-06-20T00:15:00.000Z&bbox=0,0,-50,-45&limit=10&offset=10`
				);
			});
			describe('when passed a provider', () => {
				it('should add a provider', async () => {
					mockFetchToReturnWithNoHeaders();
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.apiKey,
							token: '',
						},
						providers: [LightningDataNetworkProvider.toa],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch('provider=toa');
				});
				it('should add multiple providers', async () => {
					mockFetchToReturnWithNoHeaders();
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.apiKey,
							token: '',
						},
						providers: [LightningDataNetworkProvider.toa, LightningDataNetworkProvider.transpower],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch('provider=toa,transpower');
				});
			});
			describe('when passed a direction', () => {
				it('should add a direction', async () => {
					mockFetchToReturnWithNoHeaders();
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.apiKey,
							token: '',
						},
						directions: [LightningStrikeDirection.GROUND],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][0] as string).toMatch('direction=GROUND');
				});
				it('should add multiple directions', async () => {
					mockFetchToReturnWithNoHeaders();
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.apiKey,
							token: '',
						},
						directions: [LightningStrikeDirection.CLOUD, LightningStrikeDirection.GROUND],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch('direction=CLOUD,GROUND');
				});
			});
		});
		describe('it should set the headers', () => {
			describe('it should set the Authorization header', () => {
				it('should add an API Key', async () => {
					mockFetchToReturnWithNoHeaders();
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.apiKey,
							token: 'abc',
						},
						directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toEqual('ApiKey abc');
				});
				it('should add a JWT', async () => {
					mockFetchToReturnWithNoHeaders();
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.jwt,
							token: 'abc',
						},
						directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toEqual('Bearer abc');
				});
			});
			describe('it should set the Accept header and return an appropriate collection', () => {
				it('should handle KML', async () => {
					mockFetchToReturnWithNoHeaders(KML_RESPONSE_ONE);
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.KML, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.jwt,
							token: 'abc',
						},
						directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.KML);
					const formattedStrikes = await strikeCollection.collection;
					expect(formattedStrikes.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-06-20T00:00:00.323Z, Current:-13.6kA, Type:GROUND');
				});
				it('should handle CSV', async () => {
					mockFetchToReturnWithNoHeaders(CSV_RESPONSE_ONE);
					const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.CSV, {
						time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
						credentials: {
							type: CredentialType.jwt,
							token: 'abc',
						},
						directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
					} as StrikeQueryParameters);
					expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.CSV);
					const formattedStrikes = await strikeCollection.collection;
					expect(formattedStrikes.body[0]).toEqual('105.911369,3.79772,2020-06-20T00:00:00.323Z,-13.6,GROUND,toa,1592611200.323,1,-12,0.25,0.25');
				});
				describe('when given GeoJSON types', () => {
					it('should handle GeoJSON', async () => {
						// TODO: Should we just limit this to V3?
						mockFetchToReturnWithNoHeaders(GeoJSONV3_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.GeoJson, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.GeoJson);
						const formattedStrikes = await strikeCollection.collection;
						expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
					});
					it('should handle GeoJSON v3', async () => {
						mockFetchToReturnWithNoHeaders(GeoJSONV3_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.GeoJsonV3, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.GeoJsonV3);
						const formattedStrikes = await strikeCollection.collection;
						expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
					});
					it('should handle GeoJSON v2', async () => {
						mockFetchToReturnWithNoHeaders(GeoJSONV2_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.GeoJsonV2, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.GeoJsonV2);
						const formattedStrikes = await strikeCollection.collection;
						expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
					});
				});
				describe('when given Blitzen types', () => {
					it('should handle Blitzen', async () => {
						// TODO: Should we remove this and just force v3?
						mockFetchToReturnWithNoHeaders(BlitzenV3_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.Blitzen, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.Blitzen);
						const formattedStrikes = await strikeCollection.collection;
						expect(JSON.stringify(formattedStrikes[0])).toEqual(
							'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25},"nanosecondsRemainder":0,"sensorDetails":{"chiSquared":0,"reportingSensors":0,"degreesFreedom":0,"rangeNormalizedSignal":0,"sensorInformation":"","riseTime":0,"peakTime":0}}'
						);
					});
					it('should handle Blitzen v3', async () => {
						mockFetchToReturnWithNoHeaders(BlitzenV3_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.BlitzenV3, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.BlitzenV3);
						const formattedStrikes = await strikeCollection.collection;
						expect(JSON.stringify(formattedStrikes[0])).toEqual(
							'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25},"nanosecondsRemainder":0,"sensorDetails":{"chiSquared":0,"reportingSensors":0,"degreesFreedom":0,"rangeNormalizedSignal":0,"sensorInformation":"","riseTime":0,"peakTime":0}}'
						);
					});
					it('should handle Blitzen v2', async () => {
						mockFetchToReturnWithNoHeaders(BlitzenV2_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.BlitzenV2, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.BlitzenV2);
						const formattedStrikes = await strikeCollection.collection;
						expect(JSON.stringify(formattedStrikes[0])).toEqual(
							'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25}}'
						);
					});
					it('should handle Blitzen v1', async () => {
						mockFetchToReturnWithNoHeaders(BlitzenV1_RESPONSE_ONE, true);
						const { strikeCollection } = await fetchAndFormatStrikes(SupportedMimeType.BlitzenV1, {
							time: Interval.fromDateTimes(DateTime.utc(), DateTime.utc()),
							credentials: {
								type: CredentialType.jwt,
								token: 'abc',
							},
							directions: [LightningStrikeDirection.GROUND, LightningStrikeDirection.CLOUD],
						} as StrikeQueryParameters);
						expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Accept).toEqual(SupportedMimeType.BlitzenV1);
						const formattedStrikes = await strikeCollection.collection;
						expect(JSON.stringify(formattedStrikes[0])).toEqual(
							'{"current":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323}'
						);
					});
				});
			});
		});
	});
});
