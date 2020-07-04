import { getFormattedStrikes, SupportedMimeType } from '../strikes';
import { kml } from 'api-client/model/kml';

describe('When parsing strikes', () => {
	describe('when parsing KML', () => {
		it('should return valid KML', async () => {
			const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Lightning Strike</name><description>Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND</description><ExtendedData><Data name="date_time"><value>2020-07-01T03:06:46.589Z</value></Data><Data name="kA"><value>-15.2</value></Data><Data name="ellipse_bearing"><value>68</value></Data><Data name="GDOP"><value>1</value></Data><Data name="ellipse_major_axis"><value>0.5</value></Data><Data name="ellipse_minor_axis"><value>0.25</value></Data><Data name="strike_type"><value>GROUND</value></Data><Data name="source"><value>toa</value></Data><Data name="name"><value>Lightning Strike</value></Data><Data name="description"><value>Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND</value></Data></ExtendedData><Point><coordinates>-98.274532,40.896946</coordinates></Point></Placemark><Placemark><name>Lightning Strike</name><description>Time:2020-07-01T03:06:46.703Z, Current:-21.2kA, Type:GROUND</description><ExtendedData><Data name="date_time"><value>2020-07-01T03:06:46.703Z</value></Data><Data name="kA"><value>-21.2</value></Data><Data name="ellipse_bearing"><value>-4</value></Data><Data name="GDOP"><value>1</value></Data><Data name="ellipse_major_axis"><value>0.25</value></Data><Data name="ellipse_minor_axis"><value>0.25</value></Data><Data name="strike_type"><value>GROUND</value></Data><Data name="source"><value>toa</value></Data><Data name="name"><value>Lightning Strike</value></Data><Data name="description"><value>Time:2020-07-01T03:06:46.703Z, Current:-21.2kA, Type:GROUND</value></Data></ExtendedData><Point><coordinates>-76.992327,32.189369</coordinates></Point></Placemark><Placemark><name>Lightning Strike</name><description>Time:2020-07-01T03:06:46.921Z, Current:-28kA, Type:GROUND</description><ExtendedData><Data name="date_time"><value>2020-07-01T03:06:46.921Z</value></Data><Data name="kA"><value>-28</value></Data><Data name="ellipse_bearing"><value>-76</value></Data><Data name="GDOP"><value>3</value></Data><Data name="ellipse_major_axis"><value>1</value></Data><Data name="ellipse_minor_axis"><value>0.25</value></Data><Data name="strike_type"><value>GROUND</value></Data><Data name="source"><value>toa</value></Data><Data name="name"><value>Lightning Strike</value></Data><Data name="description"><value>Time:2020-07-01T03:06:46.921Z, Current:-28kA, Type:GROUND</value></Data></ExtendedData><Point><coordinates>-76.895099,32.195193</coordinates></Point></Placemark></Document></kml>`;
			const formattedStrikes = (await getFormattedStrikes(SupportedMimeType.KML, {
				text: () => Promise.resolve(kml),
			} as Response)) as kml;
			console.log(JSON.stringify(formattedStrikes.kml.Document[0].Placemark[0], null, 2));
			expect(formattedStrikes.kml.Document[0].Placemark[0].description[0]).toEqual('Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND');
			expect(formattedStrikes).toMatchInlineSnapshot(`
			Object {
			  "kml": Object {
			    "$": Object {
			      "xmlns": "http://www.opengis.net/kml/2.2",
			    },
			    "Document": Array [
			      Object {
			        "Placemark": Array [
			          Object {
			            "ExtendedData": Array [
			              Object {
			                "Data": Array [
			                  Object {
			                    "$": Object {
			                      "name": "date_time",
			                    },
			                    "value": Array [
			                      "2020-07-01T03:06:46.589Z",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "kA",
			                    },
			                    "value": Array [
			                      "-15.2",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_bearing",
			                    },
			                    "value": Array [
			                      "68",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "GDOP",
			                    },
			                    "value": Array [
			                      "1",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_major_axis",
			                    },
			                    "value": Array [
			                      "0.5",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_minor_axis",
			                    },
			                    "value": Array [
			                      "0.25",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "strike_type",
			                    },
			                    "value": Array [
			                      "GROUND",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "source",
			                    },
			                    "value": Array [
			                      "toa",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "name",
			                    },
			                    "value": Array [
			                      "Lightning Strike",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "description",
			                    },
			                    "value": Array [
			                      "Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND",
			                    ],
			                  },
			                ],
			              },
			            ],
			            "Point": Array [
			              Object {
			                "coordinates": Array [
			                  "-98.274532,40.896946",
			                ],
			              },
			            ],
			            "description": Array [
			              "Time:2020-07-01T03:06:46.589Z, Current:-15.2kA, Type:GROUND",
			            ],
			            "name": Array [
			              "Lightning Strike",
			            ],
			          },
			          Object {
			            "ExtendedData": Array [
			              Object {
			                "Data": Array [
			                  Object {
			                    "$": Object {
			                      "name": "date_time",
			                    },
			                    "value": Array [
			                      "2020-07-01T03:06:46.703Z",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "kA",
			                    },
			                    "value": Array [
			                      "-21.2",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_bearing",
			                    },
			                    "value": Array [
			                      "-4",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "GDOP",
			                    },
			                    "value": Array [
			                      "1",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_major_axis",
			                    },
			                    "value": Array [
			                      "0.25",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_minor_axis",
			                    },
			                    "value": Array [
			                      "0.25",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "strike_type",
			                    },
			                    "value": Array [
			                      "GROUND",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "source",
			                    },
			                    "value": Array [
			                      "toa",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "name",
			                    },
			                    "value": Array [
			                      "Lightning Strike",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "description",
			                    },
			                    "value": Array [
			                      "Time:2020-07-01T03:06:46.703Z, Current:-21.2kA, Type:GROUND",
			                    ],
			                  },
			                ],
			              },
			            ],
			            "Point": Array [
			              Object {
			                "coordinates": Array [
			                  "-76.992327,32.189369",
			                ],
			              },
			            ],
			            "description": Array [
			              "Time:2020-07-01T03:06:46.703Z, Current:-21.2kA, Type:GROUND",
			            ],
			            "name": Array [
			              "Lightning Strike",
			            ],
			          },
			          Object {
			            "ExtendedData": Array [
			              Object {
			                "Data": Array [
			                  Object {
			                    "$": Object {
			                      "name": "date_time",
			                    },
			                    "value": Array [
			                      "2020-07-01T03:06:46.921Z",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "kA",
			                    },
			                    "value": Array [
			                      "-28",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_bearing",
			                    },
			                    "value": Array [
			                      "-76",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "GDOP",
			                    },
			                    "value": Array [
			                      "3",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_major_axis",
			                    },
			                    "value": Array [
			                      "1",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "ellipse_minor_axis",
			                    },
			                    "value": Array [
			                      "0.25",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "strike_type",
			                    },
			                    "value": Array [
			                      "GROUND",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "source",
			                    },
			                    "value": Array [
			                      "toa",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "name",
			                    },
			                    "value": Array [
			                      "Lightning Strike",
			                    ],
			                  },
			                  Object {
			                    "$": Object {
			                      "name": "description",
			                    },
			                    "value": Array [
			                      "Time:2020-07-01T03:06:46.921Z, Current:-28kA, Type:GROUND",
			                    ],
			                  },
			                ],
			              },
			            ],
			            "Point": Array [
			              Object {
			                "coordinates": Array [
			                  "-76.895099,32.195193",
			                ],
			              },
			            ],
			            "description": Array [
			              "Time:2020-07-01T03:06:46.921Z, Current:-28kA, Type:GROUND",
			            ],
			            "name": Array [
			              "Lightning Strike",
			            ],
			          },
			        ],
			      },
			    ],
			  },
			}
		`);
		});
	});
});
