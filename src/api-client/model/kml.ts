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
interface KmlDocument {
	Placemark: StrikePlacemark[];
}
export interface kml {
	kml: {
		$: {
			xmlns: 'http://www.opengis.net/kml/2.2';
		};
		Document: [KmlDocument];
	};
}
