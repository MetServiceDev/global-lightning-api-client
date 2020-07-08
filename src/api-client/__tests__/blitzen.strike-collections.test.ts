import { getFormattedStrikes, SupportedMimeType } from '../strike-api';
import {
	BlitzenV2_RESPONSE_ONE,
	BlitzenV2_RESPONSE_TWO,
	BlitzenV2_RESPONSE_THREE,
	BlitzenV2_EMPTY_RESPONSE,
	BlitzenV3_RESPONSE_ONE,
	BlitzenV3_RESPONSE_TWO,
	BlitzenV3_RESPONSE_THREE,
	BlitzenV3_EMPTY_RESPONSE,
	BlitzenV1_RESPONSE_ONE,
	BlitzenV1_RESPONSE_TWO,
	BlitzenV1_RESPONSE_THREE,
} from './strikes-collections-test-resources';

describe('When parsing Blitzen', () => {
	// Most tests around V3, simple verification for V2, V1
	describe('when parsing Blitzen V3', () => {
		it('should return valid Blitzen V3', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_ONE)),
			} as Response);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25},"nanosecondsRemainder":0,"sensorDetails":{"chiSquared":0,"reportingSensors":0,"degreesFreedom":0,"rangeNormalizedSignal":0,"sensorInformation":"","riseTime":0,"peakTime":0}}'
			);
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to reformat to the same string', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_ONE)),
			} as Response);
			const reformattedString = await strikeCollection.toString();
			expect(reformattedString).toEqual(BlitzenV3_RESPONSE_ONE);
		});
		it('should be able to merge two collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_TWO)),
			} as Response);
			const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
			// const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(mergedCollection[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25},"nanosecondsRemainder":0,"sensorDetails":{"chiSquared":0,"reportingSensors":0,"degreesFreedom":0,"rangeNormalizedSignal":0,"sensorInformation":"","riseTime":0,"peakTime":0}}'
			);
			expect(mergedCollection).toMatchSnapshot();
		});
		it.skip('should merge collections in order', () => {});
		it.skip('should be able to calculate any new strikes', () => {});
		it('should be able to merge multiple collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_TWO)),
			} as Response);
			const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_THREE)),
			} as Response);
			strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25},"nanosecondsRemainder":0,"sensorDetails":{"chiSquared":0,"reportingSensors":0,"degreesFreedom":0,"rangeNormalizedSignal":0,"sensorInformation":"","riseTime":0,"peakTime":0}}'
			);
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to merge an empty collection', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_RESPONSE_ONE)),
			} as Response);
			const emptyCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_EMPTY_RESPONSE)),
			} as Response);
			strikeCollection.mergeCollections(emptyCollection);
			expect(await strikeCollection.toString()).toEqual(BlitzenV3_RESPONSE_ONE);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25},"nanosecondsRemainder":0,"sensorDetails":{"chiSquared":0,"reportingSensors":0,"degreesFreedom":0,"rangeNormalizedSignal":0,"sensorInformation":"","riseTime":0,"peakTime":0}}'
			);
		});
		it('should be able to merge two empty collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_EMPTY_RESPONSE)),
			} as Response);
			const emptyCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV3, {
				json: () => Promise.resolve(JSON.parse(BlitzenV3_EMPTY_RESPONSE)),
			} as Response);
			strikeCollection.mergeCollections(emptyCollection);
			const formattedStrikes = await strikeCollection.collection;
			expect(formattedStrikes).toEqual([]);
			expect(await strikeCollection.toString()).toEqual(BlitzenV2_EMPTY_RESPONSE);
		});
	});

	describe('When parsing Blitzen V2', () => {
		it('should return valid Blitzen V2', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_ONE)),
			} as Response);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25}}'
			);
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to reformat to the same string', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_ONE)),
			} as Response);
			const reformattedString = await strikeCollection.toString();
			expect(reformattedString).toEqual(BlitzenV2_RESPONSE_ONE);
		});
		it('should be able to merge two collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_TWO)),
			} as Response);
			const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
			// const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(mergedCollection[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25}}'
			);
			expect(mergedCollection).toMatchSnapshot();
		});
		it.skip('should merge collections in order', () => {});
		it.skip('should be able to calculate any new strikes', () => {});
		it('should be able to merge multiple collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_TWO)),
			} as Response);
			const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV2_RESPONSE_THREE)),
			} as Response);
			strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"amplitude":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323,"dateTime":"2020-06-20T00:00:00.323Z","ellipse":{"bearing":-12,"major":0.25,"minor":0.25}}'
			);
			expect(formattedStrikes).toMatchSnapshot();
		});
	});

	describe('When parsing Blitzen V1', () => {
		it('should return valid Blitzen V1', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV1, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_ONE)),
			} as Response);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"current":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323}'
			);
			expect(formattedStrikes).toMatchSnapshot();
		});
		it('should be able to reformat to the same string', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV1, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_ONE)),
			} as Response);
			const reformattedString = await strikeCollection.toString();
			expect(reformattedString).toEqual(BlitzenV1_RESPONSE_ONE);
		});
		it('should be able to merge two collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV1, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.BlitzenV2, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_TWO)),
			} as Response);
			const mergedCollection = await strikeCollection.mergeCollection(strikeCollectionTwo);
			// const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(mergedCollection[0])).toEqual(
				'{"current":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323}'
			);
			expect(mergedCollection).toMatchSnapshot();
		});
		it.skip('should merge collections in order', () => {});
		it.skip('should be able to calculate any new strikes', () => {});
		it('should be able to merge multiple collections', async () => {
			const strikeCollection = await getFormattedStrikes(SupportedMimeType.BlitzenV1, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_ONE)),
			} as Response);
			const strikeCollectionTwo = await getFormattedStrikes(SupportedMimeType.BlitzenV1, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_TWO)),
			} as Response);
			const strikeCollectionThree = await getFormattedStrikes(SupportedMimeType.BlitzenV1, {
				json: () => Promise.resolve(JSON.parse(BlitzenV1_RESPONSE_THREE)),
			} as Response);
			strikeCollection.mergeCollections(strikeCollectionTwo, strikeCollectionThree);
			const formattedStrikes = await strikeCollection.collection;
			expect(JSON.stringify(formattedStrikes[0])).toEqual(
				'{"current":-13.6,"direction":"GROUND","latitude":3.79772,"longitude":105.911369,"timeMillis":1592611200323}'
			);
			expect(formattedStrikes).toMatchSnapshot();
		});
	});
});
