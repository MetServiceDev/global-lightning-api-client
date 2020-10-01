import { DateTime, Duration } from "luxon";
import { MAXIMUM_QUERIES_AT_ONCE, MAXIMUM_STRIKES_IN_ONE_QUERY } from "../friendly-api";
import { OutputTokens } from "./commands";

const INITIAL_ISO = '2020-01-22T01:22:33.456Z';

const validateChoiceCaseInsensitive = (choices: string[]) => (choice: string) => {
	const index = choices.findIndex((value) => value === choice || value.toLowerCase() === choice.toLowerCase() || value.toUpperCase() === choice.toUpperCase())
	if (index < 0) {
		throw new Error(`Invalid format choice, given: "${choice}", choices: "${choices.join('", "')}"`);
	}
	return choices[index];
}

const validateMultipleChoiceCaseInsensitive = (choices: string[]) => {
	const choiceValidater = validateChoiceCaseInsensitive(choices);
	return (selectedChoices: string[]) => {
		if (selectedChoices.length === 0) {
			throw new Error(`You must select at least one of "${choices.join('", "')}"`)
		}
		return selectedChoices.map((choice) => choiceValidater(choice))
	}
}

const validateBbox = (bbox: (string | number)[]): [number, number, number, number] => {
	if (bbox.length !== 4) {
		throw new Error(`Bbox requires 4 parameters: lower-left-longitude lower-left-latitude upper-right-longitude upper-right-latitude`);
	}
	const [lllon, lllat, urlon, urlat] = bbox.map((lonLat: string | number): number => {
		if (!/^[-\d\.]+$/.exec(`${lonLat}`)) {
			throw new Error(`Failed to parse "${lonLat}" into a float`);
		}
		const lonLatNumber = Number.parseFloat(`${lonLat}`);
		if (Number.isNaN(lonLatNumber)) {
			throw new Error(`Failed to parse "${lonLat}" into a float`);
		}
		return lonLatNumber;
	});
	if (urlat < lllat) {
		throw new Error(`The upper-right latitude (${urlat}) must be greater than the lower-left (${lllat})`);
	}
	if (urlon < lllon) {
		throw new Error(`The upper-right longitude (${urlon}) must be greater than the lower-left (${lllon})`);
	}
	if (lllat > 90 || lllat < -90) {
		throw new Error(`The lower-left latitude (${lllat} must be less than 90 and greater than -90`);
	}
	if (urlat > 90 || urlat < -90) {
		throw new Error(`The upper-right latitude (${urlat} must be less than 90 and greater than -90`);
	}
	return [lllon, lllat, urlon, urlat];
}

const validateDateTime = (time: string) => {
	const dateTime = DateTime.fromISO(time, { zone: 'utc' });
	if (!dateTime.isValid) {
		throw new Error(`${dateTime.invalidReason} - ${dateTime.invalidExplanation}`);
	}
	return dateTime;
}

const validateDuration = (durationIso: string) => {
	const duration = Duration.fromISO(durationIso);
	if (!duration.isValid) {
		throw new Error(`${duration.invalidReason} - ${duration.invalidExplanation}`);
	}
	return duration;
}
const getRandomEpoch = () => {
	return Math.floor(Math.random() * DateTime.utc().toMillis());
}
const validateTimeFormat = (format: string) => {
	const formattedDateTime = DateTime.fromISO(INITIAL_ISO).toFormat(format);
	const parsedDateTime = DateTime.fromFormat(formattedDateTime, format);
	if (!parsedDateTime.isValid) {
		throw new Error(`${parsedDateTime.invalidReason} - ${parsedDateTime.invalidExplanation}`)
	}
	const sampleDateTimes: DateTime[] = [
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' }),
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' }),
		DateTime.fromISO('1992-08-29T23:22:11.123Z', { zone: 'utc' }),
		DateTime.fromISO('2020', { zone: 'utc' }),
		DateTime.fromISO('2018-04-02T01:43:28.976Z', { zone: 'utc' }),
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' }),
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' }),
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' }),
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' }),
		DateTime.fromMillis(getRandomEpoch(), { zone: 'utc' })
	]
	const dateLength = sampleDateTimes.map((dateTime) => dateTime.toFormat(format).length)
		.reduce(({ sameLength, length }: { sameLength: boolean, length: undefined | number }, currentLength) => {
			if (!length) {
				return {
					sameLength,
					length: currentLength
				}
			}
			return {
				sameLength: sameLength && length == currentLength,
				length: currentLength
			}
		}, { sameLength: true, length: undefined });
	if (!dateLength.sameLength) {
		throw new Error('The time format must return the same length for all dates');
	}
	return format;
}

const validateFileNameFormat = (format: string) => {
	if (!format.includes(OutputTokens.START_DATE_TOKEN) && !format.includes(OutputTokens.END_DATE_TOKEN)) {
		throw new Error(`The file name format must include either a start (${OutputTokens.START_DATE_TOKEN}) or end date (${OutputTokens.END_DATE_TOKEN})`)
	}
	return format;
}


const parsePositiveInteger = (value: string, maximum: number, argName: string) => {
	const parsedValue = Number.parseInt(value, 10);
	if (!/^[\d]+$/.exec(`${value}`) || Number.isNaN(parsedValue) || parsedValue < 0 || parsedValue > maximum) {
		throw new Error(`The maximum amount of ${argName} must be a positive integer no bigger than ${maximum}`);
	}
	return parsedValue;
}

const validateLimit = (value: string) => {
	return parsePositiveInteger(value, MAXIMUM_STRIKES_IN_ONE_QUERY, 'strikes in one query (limit)');
}

const validateParallelQueries = (value: string) => {
	return parsePositiveInteger(value, MAXIMUM_QUERIES_AT_ONCE, 'queries at once (parallel-queries)');
}

const getValidationAsEnquirerResult = (validation: () => {}): string | boolean => {
	try {
		validation();
		return true;
	} catch (error) {
		return (error as Error).message;
	}
}

const runValidationAsEnquirerPrompt = (validation: (value: string) => {}) => (value: string) => {
	return getValidationAsEnquirerResult(() => validation(value));
}

export {
	validateBbox,
	validateChoiceCaseInsensitive,
	validateDateTime,
	validateDuration,
	validateFileNameFormat,
	validateLimit,
	validateMultipleChoiceCaseInsensitive,
	validateParallelQueries,
	validateTimeFormat,
	getValidationAsEnquirerResult,
	runValidationAsEnquirerPrompt
}