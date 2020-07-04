/**
 * Lightning API
 * ## Lightning Data REST API ### Authorization The Lightning API accepts API Keys and JWTs. These are provided either in a header or as queryParameter for WebSockets. #### REST API The REST API expects an 'Authorization' header. Valid values are:   - Bearer `{aJwt}`   - Apikey `{anApiKey}`  #### WebSockets The WebSocket endpoint accepts Authorization as a 'token' queryStringParameter (e.g., wss://lightning-feed.api.metraweather.com?token=`{jwt|apiKey}`).  ### Response `Content-Types` header The `binary/octet-stream` response content type is GeoJSON data encoded into protocol buffers ([geobuf](https://github.com/mapbox/geobuf)). Decoded, the data is the same as the JSON/GeoJSON content types (in particular, it is a *lossless* compression). Where available, we recommend that you accept protocol buffer output for your application if you have been previously using GeoJSON responses, because it typically makes responses 6–8 times smaller (2–2.5 times smaller with gzip compression, which is also enabled by default for sufficiently large queries), and because it allows for fast, incremental parsing.  There is also a vector tile endpoint that serves protocol buffers, but these are explicitly in the [Mapbox Vector Tile specification](https://www.mapbox.com/vector-tiles/specification/). That is to say, they do not decode into GeoJSON, and that this encoding is *lossy*, due to projection transformation and quantization onto a 4096x4096 coordinate space. ### Response `Cache-Control` header Note that if you ask the API for a response that is \"closed\" (such as a defined time range in the past), then the server will respond with an aggressive `Cache-Control` such as `public, max-age=31536000`. This is because large queries are expensive to run, and very unlikely to change.  However if you make an open-ended query, or use a `time` parameter that closes in the future, then the `Cache-Control` expires much sooner: currently after 60 seconds. Note that due to latency from source to service, there is a five-minute grace period in which any data contained in the underlying database is not considered \"complete\" and a re-request is advised through the `Cache-Control` header.  This applies to all `/strikes` endpoints. This is particularly useful for ensuring that Mapbox GL maps will use vector tiles dynamically, since the `Cache-Control` header is respected in [Mapbox GL Native](https://github.com/mapbox/mapbox-gl-native/pull/2617) and in [Mapbox GL JS](https://github.com/mapbox/mapbox-gl-js/issues/1946). ## Lightning Data WebSockets This service supports providing data by WebSockets but unfortunately Open-API specs don't have WebSocket support so this is the extent of the documentation for it. **NOTE:** This service differs greatly from v2/3 of the API ### Establishing a connection and getting data When you first establish a connection to `wss://${hostDomain}?token=${jwt}` you will only receive heartbeats. The service will wait for you to specify what data you are interested in. You do so by sending it a message like so: ```json   {     \"action\": \"SET_PREFERENCES\"     \"bbox\": [-180, -90, 180, 90],     \"providers\": [\"TOA\", \"MOCK\"],     \"directions\": [\"CLOUD\"],     \"pathToGenerateAlong\": [-180,-90,-90,-45,0,0],     \"format\": \"application/vnd.google-earth.kml+xml\"   } ```  It will either respond with an error: ```json   {     type: \"SET_PREFERENCES_ERROR\"     error: \"Error parsing 'bbox': MinLon/minLat cannot be higher than maxLon/maxLat\"   } ``` Or it will send a succesful response like so: ```json   {     \"type\": \"PREFERENCES_APPLIED\",     \"preferences\": {       \"bbox\": [-180, -90, 180, 90],       \"providers\": [\"TOA\", \"MOCK\"],       \"directions\": [\"CLOUD\"],       \"pathToGenerateAlong\": [-180,-90,-90,-45,0,0],       \"fromTime\": \"2019-10-12T00:00:00.000Z\",       \"format\": \"application/vnd.google-earth.kml+xml\",       \"limit\": 10000   } ``` **NOTE:** `fromTime` and `limit` are returned but not used at this point in time. After the preferences applied message, you will immediately receive any new real-time strikes. #### Available formats You can see examples of the Mime/Media types below under the /strikes endpoint, but the WebSocket will accept the all formats except:   - application/octet-stream - GeoBuf   - application/vnd.mapbox-vector-tile - Vector Tiles  ### Disconnections The WebSockets will reset every 2 hours, this is controlled by AWS and cannot be changed. We suggest that you open a second socket when the first is due to reset to ensure there are no missed strikes. If you do suffer a disconnection use the REST API to fill in any missing data. ### When lightning data is received Lightning may be batched for performance reasons. To this end, it sends the equivalent of a collection of strikes even if an individual strike is sent, so for GeoJSON you will get a FeatureCollection that may contain only one Feature, for KML you will get a complete XML document that may only contain one Placemark, etc, etc. It is up to you to handle merging that into any data you may already have. ```json   {     \"type\": \"LIGHTNING_STRIKES_RECEIVED\",     \"lightningStrikes\": \"<?xml version=\\\"1.0\\\" encoding=\\\"UTF-8\\\"?><kml xmlns=\\\"http://www.opengis.net/kml/2.2\\\"><Document><Placemark><name>Lightning Strike</name><description>Time:2019-11-05T11:22:34.000Z, Current:-22.3kA, Type:GROUND</description><ExtendedData><Data name=\\\"date_time\\\"><value>2019-11-05T11:22:34.000Z</value></Data><Data name=\\\"ellipse_bearing\\\"><value>3</value></Data><Data name=\\\"ellipse_major_axis\\\"><value>2</value></Data><Data name=\\\"ellipse_minor_axis\\\"><value>1.2</value></Data><Data name=\\\"kA\\\"><value>-22.3</value></Data><Data name=\\\"strike_type\\\"><value>GROUND</value></Data><Data name=\\\"GDOP\\\"><value>2.3</value></Data><Data name=\\\"source\\\"><value>toa</value></Data><Data name=\\\"name\\\"><value>Lightning Strike</value></Data><Data name=\\\"description\\\"><value>Time:2019-11-05T11:22:34.000Z, Current:-22.3kA, Type:GROUND</value></Data></ExtendedData><Point><coordinates>-130,25</coordinates></Point></Placemark></Document></kml>\"   } ``` or in GeoJSON (**note:** this will usually have whitespace stripped out): ```json   {     \"type\": \"LIGHTNING_STRIKES_RECEIVED\",     \"lightningStrikes\": {       \"type\": \"FeatureCollection\",       \"features\": [         {           \"type\": \"Feature\",           \"properties\": {             \"dateTime\": \"2019-11-05T11:22:34.000Z\",             \"unixTime\": 1,             \"GDOP\": 2.3,             \"ellipse_bearing\": 3,             \"ellipse_major_axis\": 2,             \"ellipse_minor_axis\": 1.2,             \"kA\": 22.3,             \"source\": \"toa\",             \"strike_type\": \"GROUND\",             \"sensor_degrees_freedom\": 3           },           \"geometry\": {             \"type\": \"Point\",             \"coordinates\": [               -130,               25               ]           },           \"id\": \"InRvYTE1NzI5NTI5NTQwMDAtMjIuM0dST1VORC0xMzAyNSI=\"         }       ]     }   } ``` Strikes from toa or transpower are sent as soon as we receive it, but they are not guarenteed to be in order as there may be propogation delays further upstream and strikes may be delayed by up to 5 minutes. Mock strikes are generated and sent every minute. ### Heartbeats The service will send a heartbeat every 2 minutes to tell you the service and connection is still alive ```json   {     \"type\": \"HEARTBEAT\",     \"rate\": \"cron(0/2 * * * ? *)\"   } ``` You may test this earlier by sending an `ECHO` message: #### ECHO ```json   {     \"action\": \"ECHO\",     \"payload\": \"Are you there?\"   } ``` The service will respond with the payload of the message back. ```json   {     \"type\": \"ECHO\",     \"payload\": \"Are you there?\"   } ```
 *
 * OpenAPI spec version: 4.0.0
 * Contact: PlatformsDev@metservice.com
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { ModelObject } from './modelObject';

/**
 * a json object containing details about the sensors used to record the strike
 */
export interface BlitzenVersion3SensorDetails {
	/**
	 * a decimal value of the chi-squared confidence value for the strike
	 */
	chiSquared?: number;
	/**
	 * an integer count of the number of sensors that reported the strike
	 */
	reportingSensors?: number;
	/**
	 * an integer value representing the number of degrees of freedom used when calculating the strike location
	 */
	degreesFreedom?: number;
	/**
	 * a decimal value of the signal normalized for range
	 */
	rangeNormalizedSignal?: number;
	/**
	 * a string describing the kind of sensor information used in computing the strike location (This could be a combination of ’A’ angle,’S’ signal or ’T’ time, with 'x' representing not used)
	 */
	sensorInformation?: string;
	/**
	 * Risetime of the waveform in microseconds
	 */
	riseTime?: number;
	/**
	 * Peak-to-zero time of the waveform in microseconds
	 */
	peakTime?: ModelObject;
}
