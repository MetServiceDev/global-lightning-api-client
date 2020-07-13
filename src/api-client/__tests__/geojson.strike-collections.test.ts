import { getFormattedStrikes, SupportedMimeType } from '../strike-api';
import {
	GeoJSONV3_RESPONSE_ONE,
	GeoJSONV3_RESPONSE_TWO,
	GeoJSONV3_RESPONSE_THREE,
	GeoJSONV3_EMPTY_RESPONSE,
	GeoJSONV2_RESPONSE_ONE,
	GeoJSONV2_RESPONSE_TWO,
	GeoJSONV2_RESPONSE_THREE,
} from './strikes-collections-test-resources';

describe('When parsing GeoJSON', () => {
	// Most tests around V3, simple verification for V2
	describe('when parsing GeoJSON V3', () => {
		it('should return valid GeoJSON V3', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_ONE)),
			} as Response);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to reformat to the same string', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_ONE)),
			} as Response);
			const reformattedString = await strikeCollection.toString();
			expect(reformattedString).toEqual(GeoJSONV3_RESPONSE_ONE);
		});
		it('should be able to merge two collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_TWO)),
			} as Response);
			const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
			// const formattedStrikes = await strikeCollection.collection;
			expect(mergedCollection.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
			expect(mergedCollection).toMatchSnapshot();
		});
		it.skip('should merge collections in order', () => {});
		it.skip('should be able to calculate any new strikes', () => {});
		it('should be able to merge multiple collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_TWO)),
			} as Response);
			const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_THREE)),
			} as Response);
			strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to merge an empty collection', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_RESPONSE_ONE)),
			} as Response);
			const emptyCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_EMPTY_RESPONSE)),
			} as Response);
			strikeCollection.mergeCollections(emptyCollection);
			expect(await strikeCollection.toString()).toEqual(GeoJSONV3_RESPONSE_ONE);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
		});
		it('should be able to merge two empty collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_EMPTY_RESPONSE)),
			} as Response);
			const emptyCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV3, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV3_EMPTY_RESPONSE)),
			} as Response);
			strikeCollection.mergeCollections(emptyCollection);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.features).toEqual([]);
			expect(await strikeCollection.toString()).toEqual(GeoJSONV3_EMPTY_RESPONSE);
		});
	});

	describe('When parsing GeoJSON V2', () => {
		it('should return valid GeoJSON V2', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_ONE)),
			} as Response);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to reformat to the same string', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_ONE)),
			} as Response);
			const reformattedString = await strikeCollection.toString();
			expect(reformattedString).toEqual(GeoJSONV2_RESPONSE_ONE);
		});
		it('should be able to merge two collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_TWO)),
			} as Response);
			const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
			// const formattedStrikes = await strikeCollection.collection;
			expect(mergedCollection.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
			expect(mergedCollection).toMatchSnapshot();
		});
		it.skip('should merge collections in order', () => {});
		it.skip('should be able to calculate any new strikes', () => {});
		it('should be able to merge multiple collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_TWO)),
			} as Response);
			const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.GeoJsonV2, {
				json: () => Promise.resolve(JSON.parse(GeoJSONV2_RESPONSE_THREE)),
			} as Response);
			strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes.features[0].id).toEqual('InRvYTE1OTI2MTEyMDAzMjMtMTMuNkdST1VORDEwNS45MTEzNjkzLjc5NzcyIg==');
			expect(formattedStrikes).toMatchSnapshot();
		});
	});
});
