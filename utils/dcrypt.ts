const cryptohack = require('crypto')

function decrypt(cipherText: string) {
    const encryptionKey = 'MAKV2SPBNI99212';
    cipherText = cipherText.replace(/ /g, '+');
    const cipherBytes = Buffer.from(cipherText, 'base64');

    // Create the key and IV using the same salt and encryption key
    const salt = Buffer.from([0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76]);
    const pdb = cryptohack.pbkdf2Sync(encryptionKey, salt, 1000, 48, 'sha1');
    const key = pdb.slice(0, 32);
    const iv = pdb.slice(32, 48);

    // Create the decipher
    const decipher = cryptohack.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(cipherBytes);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // Return the decrypted text
    return decrypted.toString('utf16le');
}

// Example usage
const encryptedText = 'eHDwPFyOer9BWppun4+Fsg==';
const decryptedText = decrypt(encryptedText);
console.log(decryptedText);

module.exports = { decrypt }
