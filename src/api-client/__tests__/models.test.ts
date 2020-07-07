import { getFormattedStrikes, SupportedMimeType } from '../strike-api';
import { KML_RESPONSE_ONE, KML_RESPONSE_TWO, KML_RESPONSE_THREE, EMPTY_KML_RESPONSE } from './models-test-resources';

describe('When parsing strikes', () => {
	describe('when parsing KML', () => {
		it('should return valid KML', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_ONE),
			} as Response);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND');
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to reformat to the same string', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_ONE),
			} as Response);
			const reformattedString = await strikeCollection.toString();
			expect(reformattedString).toEqual(KML_RESPONSE_ONE);
		});
		it('should be able to merge two collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_ONE),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_TWO),
			} as Response);
			const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
			// const formattedStrikes = await strikeCollection.collection;
			expect(mergedCollection.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND');
			expect(mergedCollection).toMatchSnapshot();
		});
		it('should be able to merge multiple collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_ONE),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_TWO),
			} as Response);
			const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_THREE),
			} as Response);
			strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND');
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to merge an empty collection', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(KML_RESPONSE_ONE),
			} as Response);
			const emptyCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(EMPTY_KML_RESPONSE),
			} as Response);
			strikeCollection.mergeCollections(emptyCollection);
			expect(await strikeCollection.toString()).toEqual(KML_RESPONSE_ONE);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.kml.Document[0].Placemark?.[0].description[0]).toEqual('Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND');
		});
		it('should be able to merge two empty collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(EMPTY_KML_RESPONSE),
			} as Response);
			const emptyCollection = await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(EMPTY_KML_RESPONSE),
			} as Response);
			strikeCollection.mergeCollections(emptyCollection);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.kml.Document[0]).toEqual({});
			expect(await strikeCollection.toString()).toEqual(EMPTY_KML_RESPONSE);
		});
	});
});
