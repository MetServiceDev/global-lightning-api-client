import { CredentialType } from '../index';
import { CredentialsDetails as CredentialDetails, CredentialsDetails } from '../api-client/strike-api';
import { createCipheriv, createDecipheriv, randomBytes, createHash, BinaryLike } from 'crypto';
import { writeConfig, ConfigType, readConfig } from './file-utils';

interface AuthenticationConfig {
	version: number;
	credentials: string;
	credentialsType: CredentialType;
	salt: string;
	iv: string;
}

const CREDENTIALS_DELIMITER = '___:___';
const PASSWORD = '4d44ecda-1178-4d84-9746-3a2d11881f02';
const HASHING_ALGORITHM = 'sha256';
const HASHING_ITERATIONS = 100;
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const BUFFER_ENCODING = 'base64';

const transformCredentialDetailsIntoAuthenticationConfig = (credentials: CredentialsDetails): AuthenticationConfig => {
	const unencryptedCredentials = credentials.type === CredentialType.clientCredentials ? `${credentials.clientId}${CREDENTIALS_DELIMITER}${credentials.clientSecret}` : credentials.token
	const { encryptedCredentials, salt, iv } = encrypt(unencryptedCredentials);
	return {
		version: 1,
		credentialsType: credentials.type,
		credentials: encryptedCredentials,
		salt,
		iv
	}
}

const transformAuthenticationConfigIntoCredentialDetails = ({ credentialsType, credentials, salt, iv }: AuthenticationConfig): CredentialsDetails => {
	const decryptedCredentials = decrypt(credentials, salt, iv);
	if (credentialsType === CredentialType.clientCredentials) {
		const [clientId, clientSecret] = decryptedCredentials.split(CREDENTIALS_DELIMITER);
		return {
			type: credentialsType,
			clientId,
			clientSecret
		}
	}
	return {
		type: credentialsType,
		token: decryptedCredentials
	}
}

const hash = (input: BinaryLike) => createHash(HASHING_ALGORITHM).update(input).digest();

const getKeyFromPassword = (salt: string, requiredKeyLength: number, iterations: number = HASHING_ITERATIONS) => {
	let key = Buffer.from(`${PASSWORD}${CREDENTIALS_DELIMITER}${salt}`);
	for (let i = 0; i < iterations; i++) {
		key = hash(key);
	}
	if (key.length < requiredKeyLength) {
		let hx = getKeyFromPassword(salt, 20, iterations - 1);
		for (let counter = 1; key.length < requiredKeyLength; ++counter) {
			key = Buffer.concat([key, hash(Buffer.concat([Buffer.from(counter.toString()), hx]))]);
		}
	}
	return Buffer.alloc(requiredKeyLength, key);
}

function encrypt(decryptedCredentials: string): { salt: string, iv: string, encryptedCredentials: string } {
	const iv = randomBytes(16);
	const salt = randomBytes(128).toString(BUFFER_ENCODING);
	const key = getKeyFromPassword(salt, 32);
	const cipher = createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key), iv);
	const encryptedCredentials = Buffer.concat([cipher.update(decryptedCredentials), cipher.final()]);
	return {
		salt,
		iv: iv.toString(BUFFER_ENCODING),
		encryptedCredentials: encryptedCredentials.toString(BUFFER_ENCODING)
	};
}

function decrypt(encrypedCredentials: string, salt: string, iv: string) {
	const key = getKeyFromPassword(salt, 32)
	const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, BUFFER_ENCODING));
	let decrypted = decipher.update(Buffer.from(encrypedCredentials, BUFFER_ENCODING));
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString();
}

const loadStoredAuthenticationDetails = async (): Promise<CredentialDetails | undefined> => {
	const authenticationDetails = await readConfig<AuthenticationConfig>(ConfigType.Credentials);
	if (!authenticationDetails) {
		return undefined;
	}
	return transformAuthenticationConfigIntoCredentialDetails(authenticationDetails);
}

const storeAuthenticationDetails = async (credentialDetails: CredentialDetails) => {
	const authenticationConfig = transformCredentialDetailsIntoAuthenticationConfig(credentialDetails);
	await writeConfig(ConfigType.Credentials, authenticationConfig);
}

export {
	loadStoredAuthenticationDetails,
	storeAuthenticationDetails,
	encrypt,
	decrypt
}