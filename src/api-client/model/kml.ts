interface StrikePlacemarkExtendedData {
	$: {
		name: 'date_time';
	};
	value: [string];
}
interface StrikePlacemark {
	ExtendedData: [
		{
			Data: StrikePlacemarkExtendedData;
		}
	];
	name: [string];
	description: [string];
	Point: [
		{
			coordinates: [string];
		}
	];
}
interface KMLDocument {
	Placemark?: StrikePlacemark[];
}
export interface KML {
	kml: {
		$: {
			xmlns: 'http://www.opengis.net/kml/2.2';
		};
		Document: [KMLDocument];
	};
}
