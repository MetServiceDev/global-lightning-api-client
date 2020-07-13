import { getFormattedStrikes, SupportedMimeType } from '../strike-api';
import {
	CSV_RESPONSE_ONE,
	CSV_RESPONSE_TWO,
	CSV_RESPONSE_THREE,
	CSV_EMPTY_RESPONSE,
	CSV_RESPONSE_TWO_WITH_DIFFERENT_HEADERS,
} from './strikes-collections-test-resources';

describe('When parsing CSV', () => {
	it('should return valid CSV', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_ONE),
		} as Response);
		const formattedStrikes = await strikeCollection.collection;
		expect(formattedStrikes.body[0]).toEqual('105.911369,3.79772,2020-06-20T00:00:00.323Z,-13.6,GROUND,toa,1592611200.323,1,-12,0.25,0.25');
		expect(formattedStrikes).toMatchSnapshot();
	});
	it('should be able to reformat to the same string', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_ONE),
		} as Response);
		const reformattedString = await strikeCollection.toString();
		expect(reformattedString).toEqual(CSV_RESPONSE_ONE);
	});
	it('should be able to merge two collections', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_ONE),
		} as Response);
		const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_TWO),
		} as Response);
		const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
		// const formattedStrikes = await strikeCollection.collection;
		expect(mergedCollection.body[0]).toEqual('105.911369,3.79772,2020-06-20T00:00:00.323Z,-13.6,GROUND,toa,1592611200.323,1,-12,0.25,0.25');
		expect(mergedCollection).toMatchSnapshot();
	});
	it.skip('should merge collections in order', () => {});
	it.skip('should be able to calculate any new strikes', () => {});
	it('should be able to merge multiple collections', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_ONE),
		} as Response);
		const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_TWO),
		} as Response);
		const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_THREE),
		} as Response);
		strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
		const formattedStrikes = await strikeCollection.collection;
		expect(formattedStrikes.body[0]).toEqual('105.911369,3.79772,2020-06-20T00:00:00.323Z,-13.6,GROUND,toa,1592611200.323,1,-12,0.25,0.25');
		expect(formattedStrikes).toMatchSnapshot();
	});
	it('should be able to merge an empty collection', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_ONE),
		} as Response);
		const emptyCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_EMPTY_RESPONSE),
		} as Response);
		strikeCollection.mergeCollections(emptyCollection);
		expect(await strikeCollection.toString()).toEqual(CSV_RESPONSE_ONE);
		const formattedStrikes = await strikeCollection.collection;
		expect(formattedStrikes.body[0]).toEqual('105.911369,3.79772,2020-06-20T00:00:00.323Z,-13.6,GROUND,toa,1592611200.323,1,-12,0.25,0.25');
	});
	it('should be able to merge two empty collections', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_EMPTY_RESPONSE),
		} as Response);
		const emptyCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_EMPTY_RESPONSE),
		} as Response);
		strikeCollection.mergeCollections(emptyCollection);
		const formattedStrikes = await strikeCollection.collection;
		expect(formattedStrikes.body).toEqual([]);
		expect(await strikeCollection.toString()).toEqual(CSV_EMPTY_RESPONSE);
	});
	it('should be able to handle out of order CSV headers when merging', async () => {
		const strikeCollection = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_ONE),
		} as Response);
		const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.CSV, {
			text: () => Promise.resolve(CSV_RESPONSE_TWO_WITH_DIFFERENT_HEADERS),
		} as Response);
		const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
		// const formattedStrikes = await strikeCollection.collection;
		expect(mergedCollection.body[0]).toEqual('105.911369,3.79772,2020-06-20T00:00:00.323Z,-13.6,GROUND,toa,1592611200.323,1,-12,0.25,0.25');
		expect(mergedCollection.body[10]).not.toEqual('0.25,-76.516297,39.093173,-6.4,GROUND,toa,1592611200.629,1,9,0.25,2020-06-20T00:00:00.629Z');
		expect(mergedCollection.body[10]).toEqual('-80.874821,34.163358,2020-06-20T00:01:00.385Z,0,CLOUD,toa,1592611260.385,1,-74,0.5,0.25');
		expect(mergedCollection).toMatchSnapshot();
	});
});
