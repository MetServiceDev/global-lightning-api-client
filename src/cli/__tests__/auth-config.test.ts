import { encrypt, decrypt } from '../auth-config'
describe('When encrypting credentials', () => {
	it('should be able to decrypt them again', () => {
		const credentials = 'someRandomCredentials';
		const { salt, encryptedCredentials, iv } = encrypt(credentials);
		const decryptedCredentials = decrypt(encryptedCredentials, salt, iv);
		expect(decryptedCredentials).toEqual(credentials);
	});
	it('should encrypt them differently each time', () => {
		const credentials = 'someRandomCredentials';
		const { salt, encryptedCredentials, iv } = encrypt(credentials);
		const { salt: saltTwo, encryptedCredentials: encryptedCredentialsTwo, iv: ivTwo } = encrypt(credentials);
		expect(encryptedCredentials).not.toEqual(encryptedCredentialsTwo);
		expect(salt).not.toEqual(saltTwo);
		expect(iv).not.toEqual(ivTwo);

		const decryptedCredentials = decrypt(encryptedCredentials, salt, iv);
		const decryptedCredentialsTwo = decrypt(encryptedCredentialsTwo, saltTwo, ivTwo);
		expect(decryptedCredentials).toEqual(decryptedCredentialsTwo);
		expect(decryptedCredentials).toEqual(credentials);

		// const decryptedCredentialsThree = decrypt(encryptedCredentialsTwo, salt, iv);
		// expect(decryptedCredentialsThree).not.toEqual(credentials);
	});
});