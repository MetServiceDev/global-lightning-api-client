import { parseStringPromise as parseXml, Builder } from 'xml2js';

import { LightningFeatureCollectionV3, LightningFeatureCollectionV2, KML, BlitzenCollectionV1, BlitzenCollectionV2, BlitzenCollectionV3 } from './model/models';

interface CSV {
	header: string;
	body: string[];
}

type GeoJsonTypes = LightningFeatureCollectionV3 | LightningFeatureCollectionV2;
type BlitzenTypes = BlitzenCollectionV1 | BlitzenCollectionV2 | BlitzenCollectionV3;
type JsonTypes = GeoJsonTypes | BlitzenTypes;

type StrikeCollectionType = JsonTypes | KML | CSV;

abstract class StrikeCollection<T extends StrikeCollectionType> {
	public collection: Promise<T>;
	constructor(response: Response) {
		this.collection = this.parseResponse(response);
	}
	setCollection(collection: Promise<T>) {
		this.collection = collection;
	}
	/**
	 * Naively merges the collections. Postpends each collection after each other
	 */
	mergeCollections(...collectionsToMerge: StrikeCollection<T>[]): StrikeCollection<T> {
		collectionsToMerge.reduce((collection: StrikeCollection<T>, collectionToMerge: StrikeCollection<T>, index) => {
			const mergedCollection = collection.mergeCollection(collectionToMerge);
			collection.setCollection(mergedCollection);
			return collection;
		}, this);
		return this;
	}
	abstract async parseResponse(response: Response): Promise<T>;
	/**
	 * Naively merges the collections, just puts items from one collection after each otheru
	 */
	abstract async mergeCollection(collectionToMerge: StrikeCollection<T>): Promise<T>;
	abstract async toString(): Promise<string>;
}

class KMLStrikeCollection extends StrikeCollection<KML> {
	constructor(collection: Response) {
		super(collection);
	}
	async parseResponse(response: Response) {
		const rawText = await response.text();
		try {
			const parsedKml: KML = await parseXml(rawText, {});
			return parsedKml;
		} catch (error) {
			console.error(`Failed to parse KML. Raw input:`, rawText);
			throw new Error(`Failed to parse KML. ${error}`);
		}
	}
	async mergeCollection(collectionToMerge: StrikeCollection<KML>) {
		const collection = await this.collection;
		const nextCollection = await collectionToMerge.collection;
		const currentPlacemarks = collection.kml.Document[0].Placemark;
		const placemarksToMerge = nextCollection.kml.Document[0].Placemark || [];
		const mergedPlacemarkDocument = currentPlacemarks
			? {
					Placemark: currentPlacemarks.concat(placemarksToMerge),
			  }
			: {};
		const mergedCollection: KML = {
			kml: {
				$: collection.kml.$,
				Document: [mergedPlacemarkDocument],
			},
		};
		return mergedCollection;
	}
	async toString() {
		const builder = new Builder({
			renderOpts: {
				pretty: false,
			},
			xmldec: {
				version: '1.0',
				encoding: 'UTF-8',
			},
		});
		return builder.buildObject(await this.collection);
	}
}

class CSVStrikeCollection extends StrikeCollection<CSV> {
	constructor(response: Response) {
		super(response);
	}
	async parseResponse(response: Response) {
		const text = await response.text();
		const [header, ...body] = text.split('\n');
		return {
			header,
			body,
		};
	}
	async mergeCollection(collectionToMerge: StrikeCollection<CSV>) {
		const collection = await this.collection;
		const nextCollection = await collectionToMerge.collection;
		let rowsToAdd = nextCollection.body;
		if (collection.header !== nextCollection.header) {
			const originalHeader = collection.header.split(',');
			const getHeaderOrder = (acc: { [key: string]: number }, headerName: string, index: number) => {
				acc[headerName] = index;
				return acc;
			};
			const headerOrderToSwapTo = originalHeader.reduce(getHeaderOrder, {});
			const currentHeaderOrder = nextCollection.header.split(',').reduce(getHeaderOrder, {});

			// for each row of collection, swap indicies
			rowsToAdd = rowsToAdd.map((row) => {
				const currentColumns = row.split(',');

				const updatedColumns = Object.keys(headerOrderToSwapTo).reduce((newItem: string[], headerName) => {
					const newIndex = headerOrderToSwapTo[headerName];
					const actualIndex = currentHeaderOrder[headerName];
					newItem[newIndex] = currentColumns[actualIndex];
					return newItem;
				}, []);

				return updatedColumns.join(',');
			});
		}
		return {
			header: collection.header,
			body: collection.body.concat(rowsToAdd),
		};
	}
	async toString() {
		const { header, body } = await this.collection;
		return [header, ...body].join('\n');
	}
}

abstract class JsonStrikeCollection<SC extends JsonTypes> extends StrikeCollection<SC> {
	constructor(response: Response) {
		super(response);
	}
	async parseResponse(response: Response) {
		const json = (await response.json()) as SC;
		return json;
	}
	async toString() {
		const json = await this.collection;
		return JSON.stringify(json);
	}
}

class BlitzenStrikeCollection<SC extends BlitzenTypes> extends JsonStrikeCollection<SC> {
	constructor(response: Response) {
		super(response);
	}
	async mergeCollection(collectionToMerge: JsonStrikeCollection<SC>) {
		const currentCollection = await this.collection;
		const nextCollection = await collectionToMerge.collection;
		return [...currentCollection, ...nextCollection] as SC;
	}
}

class GeoJsonStrikeCollection<SC extends GeoJsonTypes> extends JsonStrikeCollection<SC> {
	constructor(response: Response) {
		super(response);
	}
	async mergeCollection(collectionToMerge: JsonStrikeCollection<SC>) {
		const currentCollection = await this.collection;
		const nextCollection = await collectionToMerge.collection;
		return {
			...currentCollection,
			features: [...currentCollection.features, ...nextCollection.features],
		};
	}
}

type StrikeCollections = KMLStrikeCollection | CSVStrikeCollection | GeoJsonStrikeCollection<GeoJsonTypes> | BlitzenStrikeCollection<BlitzenTypes>;
export {
	CSVStrikeCollection,
	KMLStrikeCollection,
	StrikeCollection,
	StrikeCollectionType,
	StrikeCollections,
	GeoJsonStrikeCollection,
	BlitzenStrikeCollection,
	LightningFeatureCollectionV3,
	LightningFeatureCollectionV2,
	BlitzenCollectionV1,
	BlitzenCollectionV2,
	BlitzenCollectionV3,
	KML,
	CSV,
};
