import {
	validateBbox,
	validateDateTime,
	validateDuration,
	validateFileNameFormat,
	validateLimit,
	validateParallelQueries,
	validateTimeFormat,
	validateChoiceCaseInsensitive,
	validateMultipleChoiceCaseInsensitive
} from '../input-validation';
import { DateTime, Duration } from 'luxon';
import { DEFAULT_TIME_FORMAT } from '../config';
import { SupportedMimeType } from '../../api-client/strike-api';
describe('When validating bbox', () => {
	it(`should throw an error if the values can't be parsed`, () => {
		expect(() => validateBbox(['negative one eighty', '-90', '180', '90'])).toThrowErrorMatchingInlineSnapshot(
			`"Failed to parse \\"negative one eighty\\" into a float"`
		);
		expect(() => validateBbox(['-180', 'abc', '180', '90'])).toThrowErrorMatchingInlineSnapshot(`"Failed to parse \\"abc\\" into a float"`);
		expect(() => validateBbox(['-180', '-90', '180.def', '90'])).toThrowErrorMatchingInlineSnapshot(`"Failed to parse \\"180.def\\" into a float"`);
		expect(() => validateBbox(['-180', '-90', '180', 'n.123'])).toThrowErrorMatchingInlineSnapshot(`"Failed to parse \\"n.123\\" into a float"`);
	});
	it('should throw an error if the latitudes are in the wrong order', () => {
		expect(() => validateBbox([-180, 45, 180, -45])).toThrowErrorMatchingInlineSnapshot(
			`"The upper-right latitude (-45) must be greater than the lower-left (45)"`
		);
	});
	it('should throw an error if the longitudes are in the wrong order', () => {
		expect(() => validateBbox([120, 90, -120, 90])).toThrowErrorMatchingInlineSnapshot(
			`"The upper-right longitude (-120) must be greater than the lower-left (120)"`
		);
	});
	it('should throw an error if the latitudes >90 || <-90', () => {
		expect(() => validateBbox([-90, -180, 90, 180])).toThrowErrorMatchingInlineSnapshot(
			`"The lower-left latitude (-180 must be less than 90 and greater than -90"`
		);
		expect(() => validateBbox([-180, -90, 90, 180])).toThrowErrorMatchingInlineSnapshot(
			`"The upper-right latitude (180 must be less than 90 and greater than -90"`
		);
	});
	it('should not throw an error if the longitudes exceed 180', () => {
		expect(() => validateBbox([-220.22, -45.128, 0.2, 45.3324])).not.toThrowError();
		expect(() => validateBbox([0, -90, 220, 90])).not.toThrowError();
	});
	it('should parse valid floats', () => {
		const [lllon, lllat, urlon, urlat] = validateBbox(['-100.2256789', '-22.7789123', '100.3456999', '33.445789']);
		expect(lllon).toBeCloseTo(-100.2256789, 7);
		expect(lllat).toBeCloseTo(-22.7789123, 7);
		expect(urlon).toBeCloseTo(100.3456999, 7);
		expect(urlat).toBeCloseTo(33.445789, 6);
	});
});

describe('When validating date time', () => {
	it('should validate ISO-8601 date times', () => {
		expect(validateDateTime('2020-01-01T00:00:00.000Z')).toEqual(DateTime.fromISO('2020-01-01T00:00:00.000Z', { zone: 'utc' }));
		expect(validateDateTime('2020')).toEqual(DateTime.fromISO('2020-01-01T00:00:00.000Z', { zone: 'utc' }));
	});
	it('should throw an error for an invalid date time', () => {
		expect(() => validateDateTime('01-01-2020')).toThrowErrorMatchingInlineSnapshot(`"unparsable - the input \\"01-01-2020\\" can't be parsed as ISO 8601"`);
	});
});

describe('When validating date time format', () => {
	it('should validate a validate format', () => {
		expect(validateTimeFormat(DEFAULT_TIME_FORMAT)).toEqual(DEFAULT_TIME_FORMAT);
	});
	it('should throw an error for a date time format that cannot be used as input only output', () => {
		expect(() => validateTimeFormat('x')).toThrowErrorMatchingInlineSnapshot(`"unparsable - the input \\"1579656153456\\" can't be parsed as format x"`);
	});
	it('should throw an error for formats that change lengths', () => {
		expect(() => validateTimeFormat('MMMM')).toThrowErrorMatchingInlineSnapshot(`"The time format must return the same length for all dates"`);
		expect(() => validateTimeFormat('S')).toThrowErrorMatchingInlineSnapshot(`"The time format must return the same length for all dates"`);
		expect(() => validateTimeFormat('m')).toThrowErrorMatchingInlineSnapshot(`"The time format must return the same length for all dates"`);
	});
});

describe('When validating a duration', () => {
	it('should validate a valid duration', () => {
		expect(validateDuration('PT15M')).toEqual(Duration.fromISO('PT15M'));
	});
	it('should not validate an invalid duration', () => {
		expect(() => validateDuration('20000')).toThrowErrorMatchingInlineSnapshot(`"unparsable - the input \\"20000\\" can't be parsed as ISO 8601"`);
	});
});

describe('When validating the file name format', () => {
	it("should throw an error if it doesn't include a date", () => {
		expect(() => validateFileNameFormat('fancy-string')).toThrowErrorMatchingInlineSnapshot(
			`"The file name format must include either a start ({START_DATE}) or end date ({END_DATE})"`
		);
	});

	it('should accept a valid file name format', () => {
		expect(validateFileNameFormat('fancy--{START_DATE}--string')).toEqual('fancy--{START_DATE}--string');
	});
});
describe('when validating the limit', () => {
	it('should throw if not positive', () => {
		expect(() => validateLimit('-1')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of strikes in one query (limit) must be a positive integer no bigger than 10000"`
		);
	});
	it('should throw if not a number', () => {
		expect(() => validateLimit('1d')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of strikes in one query (limit) must be a positive integer no bigger than 10000"`
		);
	});
	it('should throw if passed a float', () => {
		expect(() => validateLimit('22.3')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of strikes in one query (limit) must be a positive integer no bigger than 10000"`
		);
	});
	it('should throw if it exceeds 10,000', () => {
		expect(() => validateLimit('10001')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of strikes in one query (limit) must be a positive integer no bigger than 10000"`
		);
	});
	it('should accept a valid limit', () => {
		expect(validateLimit('800')).toEqual(800);
	});
});

describe('when validating the parallel queries', () => {
	it('should throw if not positive', () => {
		expect(() => validateParallelQueries('-1')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of queries at once (parallel-queries) must be a positive integer no bigger than 20"`
		);
	});
	it('should throw if not a number', () => {
		expect(() => validateParallelQueries('1d')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of queries at once (parallel-queries) must be a positive integer no bigger than 20"`
		);
	});
	it('should throw if passed a float', () => {
		expect(() => validateParallelQueries('22.3')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of queries at once (parallel-queries) must be a positive integer no bigger than 20"`
		);
	});
	it('should throw if it exceeds 20', () => {
		expect(() => validateParallelQueries('21')).toThrowErrorMatchingInlineSnapshot(
			`"The maximum amount of queries at once (parallel-queries) must be a positive integer no bigger than 20"`
		);
	});
	it('should accept a valid limit', () => {
		expect(validateParallelQueries('18')).toEqual(18);
	});
});

describe('when validating choices', () => {
	it('should accept any captilisation', () => {
		const choice = validateChoiceCaseInsensitive(Object.keys(SupportedMimeType))('gEoJSONv3') as keyof typeof SupportedMimeType
		expect(SupportedMimeType[choice]).toEqual(SupportedMimeType.GeoJsonV3);
	})
})

describe('when validating multiple choices', () => {
	it('should accept any captilisation', () => {
		const choices = validateMultipleChoiceCaseInsensitive(Object.keys(SupportedMimeType))(['gEoJSONv3', 'KmL']) as (keyof typeof SupportedMimeType)[]
		expect(choices.map((choice) => SupportedMimeType[choice])).toEqual([SupportedMimeType.GeoJsonV3, SupportedMimeType.KML])
	})
})